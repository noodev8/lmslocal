import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:lmslocal_flutter/core/errors/failures.dart';
import 'package:lmslocal_flutter/core/router/pending_destination.dart';
import 'package:lmslocal_flutter/core/theme/coupon_theme.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/api_client.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/dashboard_remote_data_source.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/user_remote_data_source.dart';
import 'package:lmslocal_flutter/presentation/bloc/auth/auth_bloc.dart';
import 'package:lmslocal_flutter/presentation/bloc/auth/auth_state.dart';

/// The in-app half of a `lmslocal.co.uk/join/<code>` link.
///
/// Reached only when the app is already installed — Universal Links cannot install
/// anything — so the player this serves is someone already using LMS Local who has been
/// sent a second competition. A player without the app gets the web join page, which is
/// the right outcome and needs nothing from here.
///
/// The order is the web page's and the reason is §4.4 of docs/player-onboarding.md: look
/// the code up FIRST and show what is behind it, then ask for the join. It matters even
/// for a signed-in player, because a wrong code should cost a glance rather than a
/// membership in someone else's competition.
class JoinPage extends StatefulWidget {
  final String code;

  const JoinPage({super.key, required this.code});

  @override
  State<JoinPage> createState() => _JoinPageState();
}

/// A competition that has started is indistinguishable from a typo — both land on
/// [notFound] with no detail, because telling them apart would turn the code space into a
/// directory of every venue on the platform. [full] is the deliberate exception: it is the
/// one closed state a player can do something about, so it says so and names the
/// organiser. See §4.3 of docs/player-onboarding.md.
enum _Stage { lookingUp, ready, notFound, full, lookupFailed }

class _JoinPageState extends State<JoinPage> {
  /// Guards against the auth state arriving twice — once from the post-frame read and
  /// once from the listener — and starting two lookups.
  bool _started = false;

  _Stage _stage = _Stage.lookingUp;
  Map<String, dynamic>? _competition;

  /// All a full competition tells us about itself, and the whole point of that response:
  /// the player needs someone to go and ask.
  String? _fullOrganiser;

  bool _busy = false;
  String? _error;

  String get _code => widget.code.trim().toUpperCase();

  @override
  void initState() {
    super.initState();
    // A deep link can build this screen before AuthCheckRequested has settled, so the
    // decision is driven off whichever auth state lands first: this read, or the listener.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _onAuthState(context.read<AuthBloc>().state);
    });
  }

  void _onAuthState(AuthState state) {
    if (_started) return;

    if (state is AuthAuthenticated) {
      _started = true;
      _lookUp();
    } else if (state is AuthUnauthenticated || state is AuthSessionExpiredState) {
      _started = true;
      // The code would otherwise die here: there is no URL to come back to, unlike the
      // web. PendingDestination carries it through sign-in; the login page spends it.
      PendingDestination.remember('/join/$_code');
      context.go('/login');
    }
  }

  Future<void> _lookUp() async {
    final dataSource = UserRemoteDataSource(apiClient: context.read<ApiClient>());

    try {
      // Both at once. Membership only matters because an existing member should never be
      // shown a Join button for something they already joined, and firing it alongside
      // the lookup rather than after means they are redirected without paying for a
      // second round trip first.
      final results = await Future.wait([
        dataSource.getCompetitionByCode(competitionCode: _code),
        dataSource
            .getJoinStatus(competitionCode: _code)
            .catchError((_) => <String, dynamic>{}),
      ]);

      if (!mounted) return;

      final lookup = results[0];
      final membership = results[1];

      // Already in? Then there is nothing to decide. Straight through, no card, no button.
      if (membership['return_code'] == 'SUCCESS' &&
          membership['is_member'] == true &&
          membership['competition_id'] != null) {
        context.go('/game/${membership['competition_id']}');
        return;
      }

      switch (lookup['return_code']) {
        case 'SUCCESS':
          // SUCCESS is only ever returned for a competition that can still be joined.
          setState(() {
            _competition = lookup['competition'] as Map<String, dynamic>?;
            _stage = _competition == null ? _Stage.lookupFailed : _Stage.ready;
          });
        case 'COMPETITION_FULL':
          setState(() {
            _fullOrganiser = lookup['organiser_name'] as String?;
            _stage = _Stage.full;
          });
        case 'COMPETITION_NOT_FOUND':
          setState(() => _stage = _Stage.notFound);
        default:
          setState(() => _stage = _Stage.lookupFailed);
      }
    } catch (_) {
      if (mounted) setState(() => _stage = _Stage.lookupFailed);
    }
  }

  Future<void> _join() async {
    setState(() {
      _busy = true;
      _error = null;
    });

    final apiClient = context.read<ApiClient>();
    final dataSource = UserRemoteDataSource(apiClient: apiClient);

    try {
      final result = await dataSource.joinCompetitionByCode(competitionCode: _code);
      final id = (result['competition'] as Map<String, dynamic>?)?['id'] ?? _competition?['id'];
      await _enterCompetition(apiClient, id);
    } on AuthFailure catch (e) {
      // A join that races another device, or a stale membership check, lands here having
      // achieved exactly what was asked for. Treating it as an error would send the
      // player back to a button that can never succeed.
      if (e.code == 'ALREADY_JOINED') {
        await _enterCompetition(apiClient, _competition?['id']);
        return;
      }
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = 'Could not join this competition. Please try again.';
      });
    }
  }

  Future<void> _enterCompetition(ApiClient apiClient, dynamic competitionId) async {
    // The dashboard holds a five-minute cache that was written before this membership
    // existed. Without clearing it, a player who joins and then taps back finds their new
    // competition missing and no reason for it.
    try {
      final prefs = await SharedPreferences.getInstance();
      await DashboardRemoteDataSource(apiClient: apiClient, prefs: prefs).clearCache();
    } catch (_) {
      // A stale list is a far smaller problem than blocking entry to a competition the
      // player has genuinely joined.
    }

    if (!mounted) return;
    context.go(competitionId != null ? '/game/$competitionId' : '/dashboard');
  }

  // ---------------------------------------------------------------- chrome

  Widget _shell(Widget child) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.close),
          // Nothing to pop when a deep link started the app cold, so this goes rather
          // than pops.
          onPressed: _busy ? null : () => context.go('/dashboard'),
        ),
        title: Text('JOIN', style: CouponTheme.heading(28)),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
          child: child,
        ),
      ),
    );
  }

  Widget _eyebrow(String text) => Text(text.toUpperCase(), style: CouponTheme.eyebrow);

  Widget _ledgerRow(String key, String value, {bool last = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        border: Border(bottom: last ? BorderSide.none : CouponTheme.rule()),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        children: [
          Text(key.toUpperCase(), style: CouponTheme.label),
          const Spacer(),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: CouponTheme.dataText,
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<AuthBloc, AuthState>(
      listener: (context, state) => _onAuthState(state),
      child: _buildStage(),
    );
  }

  Widget _buildStage() {
    switch (_stage) {
      case _Stage.lookingUp:
        return _shell(
          Padding(
            padding: const EdgeInsets.only(top: 40),
            child: Text('LOOKING UP $_code…', style: CouponTheme.label),
          ),
        );

      case _Stage.full:
        // The organiser's name is the only thing the server gives up here, and it is the
        // whole point: a full competition is fixable, so the player needs someone to ask.
        final organiser = _fullOrganiser ?? 'Whoever runs it';
        return _shell(
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _eyebrow('No room'),
              const SizedBox(height: 16),
              Text('THIS ONE IS FULL', style: CouponTheme.heading(48)),
              const SizedBox(height: 24),
              Text(
                '$organiser has as many players as their competitions can take at the '
                'moment. Let them know you are trying to join — they can make room from '
                'their end in a couple of minutes.',
                style: CouponTheme.intro,
              ),
              const SizedBox(height: 16),
              Text(
                'Nothing has gone wrong at your end. Worth trying this code again once '
                'they have sorted it.',
                style: CouponTheme.bodyText.copyWith(color: CouponTheme.inkFade),
              ),
            ],
          ),
        );

      case _Stage.notFound:
      case _Stage.lookupFailed:
        final notFound = _stage == _Stage.notFound;
        return _shell(
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _eyebrow(notFound ? 'No match' : 'Try again'),
              const SizedBox(height: 16),
              Text(
                notFound ? 'THAT CODE IS NOT WORKING' : 'WE COULD NOT CHECK THAT CODE',
                style: CouponTheme.heading(48),
              ),
              const SizedBox(height: 24),
              // One message covers a typo and a competition that has already started. The
              // server does not tell us which, on purpose (§4.3), so this copy has to stay
              // true of both: nothing is open under this code, not that nothing exists.
              Text(
                notFound
                    ? 'Nothing is open under $_code. It may have been typed wrong, or that '
                        'competition may already be under way — codes stop letting people '
                        'in once round one locks.'
                    : 'Something went wrong at our end, not yours. Give it a moment and '
                        'try again.',
                style: CouponTheme.intro,
              ),
              const SizedBox(height: 16),
              Text(
                notFound
                    ? 'Ask whoever sent it to you — they will know which it is, and when '
                        'the next one opens.'
                    : 'Nothing has been joined.',
                style: CouponTheme.bodyText.copyWith(color: CouponTheme.inkFade),
              ),
              const SizedBox(height: 32),
              ElevatedButton(
                onPressed: () => context.go('/dashboard'),
                child: const Text('BACK'),
              ),
            ],
          ),
        );

      case _Stage.ready:
        final competition = _competition!;
        final venue = competition['venue_name'] as String?;
        final organiser = competition['organiser_name'] as String?;

        return _shell(
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _eyebrow('You have been invited'),
              const SizedBox(height: 16),
              Text(
                (competition['name'] as String? ?? '').toUpperCase(),
                style: CouponTheme.heading(48),
              ),
              const SizedBox(height: 28),
              Container(
                decoration: BoxDecoration(
                  border: Border(
                    top: CouponTheme.rule(),
                    bottom: CouponTheme.rule(),
                  ),
                ),
                child: Column(
                  children: [
                    if (venue != null && venue.isNotEmpty) _ledgerRow('Venue', venue),
                    if (organiser != null && organiser.isNotEmpty)
                      _ledgerRow('Run by', organiser),
                    _ledgerRow('Playing so far', '${competition['player_count'] ?? 0}'),
                    _ledgerRow('Code', _code, last: true),
                  ],
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: 24),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: const BoxDecoration(
                    color: CouponTheme.stockLit,
                    border: Border(
                      left: BorderSide(color: CouponTheme.overprint, width: 2),
                    ),
                  ),
                  child: Text(_error!, style: CouponTheme.bodyText),
                ),
              ],
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _busy ? null : _join,
                  child: Text(_busy ? 'JOINING…' : 'JOIN'),
                ),
              ),
            ],
          ),
        );
    }
  }
}
