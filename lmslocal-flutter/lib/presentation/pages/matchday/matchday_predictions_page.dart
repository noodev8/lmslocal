import 'dart:async';

import 'package:material_ui/material_ui.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:lmslocal_flutter/core/errors/failures.dart';
import 'package:lmslocal_flutter/core/game/games.dart';
import 'package:lmslocal_flutter/core/theme/coupon_theme.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/api_client.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/dashboard_remote_data_source.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/matchday_remote_data_source.dart';
import 'package:lmslocal_flutter/domain/entities/competition.dart';
import 'package:lmslocal_flutter/domain/entities/matchday.dart';
import 'package:lmslocal_flutter/presentation/pages/matchday/matchday_player_page.dart';
import 'package:lmslocal_flutter/presentation/pages/matchday/widgets/matchday_ui.dart';

/// A Matchday player's predictions for a round - the Play tab. The web's
/// `/game/[id]/coupon`; docs/matchday-app.md §7 and docs/matchday.md §8.2.
///
/// ONE VIEW: A STRIP OF CARDS, one per match in kickoff order, with a tracker
/// above it. These were decided with the owner on 2026-11-22, not suggestions:
///
///  - TAP A TEAM to predict it. It saves, the tile turns moss-wash, and about
///    350 ms later the strip moves to the next match. Tapping the predicted
///    team again takes it back - that is how a match is skipped. No Skip button.
///  - MOVING BETWEEN CARDS NEVER CHOOSES ANYTHING. A swipe moves the strip, and
///    so do Previous / Next. No copy anywhere says "swipe".
///  - ANY MANUAL MOVE CANCELS A PENDING AUTO-ADVANCE. A player who taps a team
///    and at once taps Previous, the tracker or starts a swipe must not be
///    carried forward a moment later (a real bug, found and fixed on the web).
///  - SAVING IS NOT OPTIMISTIC. The card changes once the server has said yes,
///    because a prediction that silently failed costs real points. Nothing is
///    queued offline either: a lock can pass in between.
class MatchdayPredictionsPage extends StatefulWidget {
  const MatchdayPredictionsPage({
    super.key,
    required this.competition,
    required this.onBack,
  });

  final Competition competition;
  final VoidCallback onBack;

  @override
  State<MatchdayPredictionsPage> createState() => _MatchdayPredictionsPageState();
}

// Long enough to see the team turn green before the strip moves on, short
// enough not to wait for.
const _advanceDelay = Duration(milliseconds: 350);

class _MatchdayPredictionsPageState extends State<MatchdayPredictionsPage> {
  late final MatchdayRemoteDataSource _dataSource =
      MatchdayRemoteDataSource(apiClient: context.read<ApiClient>());

  /// The round being shown; null is the latest.
  int? _roundNumber;

  MatchdayCoupon? _coupon;
  String? _loadError;
  String? _saveError;
  int? _busyFixture;

  /// Everyone's predictions once the round has locked (§10). Null before then,
  /// and if it fails to load the cards go without it - it is extra, not the page.
  MatchdayRoundPredictions? _everyone;

  PageController? _pager;
  int _current = 0;
  Timer? _advanceTimer;

  @override
  void initState() {
    super.initState();
    _load(place: true);
  }

  @override
  void dispose() {
    _advanceTimer?.cancel();
    _pager?.dispose();
    super.dispose();
  }

  /// Loads the round. With [place], the strip is (re)built and opens on the
  /// first match still to predict - once per round, so a player coming back
  /// mid-week lands on what is missing; after that, where they are is where
  /// they put it.
  Future<void> _load({bool place = false}) async {
    try {
      final coupon = await _dataSource.getPredictions(
        widget.competition.id,
        roundNumber: _roundNumber,
      );
      if (!mounted) return;
      setState(() {
        _coupon = coupon;
        _loadError = null;
        if (place || _pager == null) {
          final open = _isOpen(coupon);
          final firstMissing =
              open ? coupon.fixtures.indexWhere((f) => f.myTeam == null) : -1;
          _current = firstMissing > 0 ? firstMissing : 0;
          _pager?.dispose();
          _pager = PageController(initialPage: _current);
        }
      });
      _loadEveryone(coupon);
    } on Failure catch (e) {
      if (mounted) setState(() => _loadError = e.message);
    }
  }

  Future<void> _loadEveryone(MatchdayCoupon coupon) async {
    final round = coupon.round;
    if (round == null || !round.locked) {
      if (_everyone != null) setState(() => _everyone = null);
      return;
    }
    try {
      final everyone = await _dataSource.getRoundPredictions(
        widget.competition.id,
        roundNumber: round.roundNumber,
      );
      if (mounted) setState(() => _everyone = everyone);
    } catch (_) {
      // The cards work without it.
    }
  }

  bool _isOpen(MatchdayCoupon coupon) =>
      coupon.round != null && !coupon.round!.locked && coupon.isPlayer;

  void _showRound(int? roundNumber) {
    _advanceTimer?.cancel();
    setState(() {
      _roundNumber = roundNumber;
      _coupon = null;
      _everyone = null;
      _saveError = null;
    });
    _load(place: true);
  }

  /// Every deliberate move goes through here, and every one cancels a pending
  /// auto-advance.
  void _goTo(int index, {bool animate = true}) {
    _advanceTimer?.cancel();
    _advanceTimer = null;
    final count = _coupon?.fixtures.length ?? 0;
    if (count == 0 || _pager == null || !_pager!.hasClients) return;
    final target = index.clamp(0, count - 1);
    if (animate && !MediaQuery.of(context).disableAnimations) {
      _pager!.animateToPage(
        target,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOutCubic,
      );
    } else {
      _pager!.jumpToPage(target);
    }
    setState(() => _current = target);
  }

  /// A tap on a team. The team already predicted is taken back (the match then
  /// scores 0, and the strip stays put); any other is predicted, and the strip
  /// moves on to the next match.
  Future<void> _tapTeam(int index, String team) async {
    final coupon = _coupon;
    if (coupon == null || _busyFixture != null) return;
    final fixture = coupon.fixtures[index];
    final takingBack = fixture.myTeam == team;

    setState(() {
      _busyFixture = fixture.fixtureId;
      _saveError = null;
    });

    try {
      if (takingBack) {
        await _dataSource.clearPrediction(fixture.fixtureId);
      } else {
        await _dataSource.setPrediction(fixture.fixtureId, team);
      }
      _clearDashboardCache();
      if (!mounted) return;
      setState(() {
        _coupon = coupon.withFixtures([
          for (final f in _coupon!.fixtures)
            f.fixtureId == fixture.fixtureId ? f.withMyTeam(takingBack ? null : team) : f,
        ]);
      });
      // Only if the player is still on the card they tapped. A move made while
      // the save was in flight came before there was a timer to cancel, and
      // must win all the same.
      if (!takingBack && index + 1 < coupon.fixtures.length && _current == index) {
        _advanceTimer?.cancel();
        _advanceTimer = Timer(_advanceDelay, () {
          _advanceTimer = null;
          if (mounted && _current == index) _goTo(index + 1);
        });
      }
    } on ServerFailure catch (e) {
      if (!mounted) return;
      if (e.code == 'ROUND_LOCKED') {
        // The round locked while the screen was open. Say so plainly and show
        // the locked view - never fail silently (§4).
        setState(() => _saveError = 'This round has locked — predictions can no longer change.');
        _load();
      } else {
        setState(() => _saveError = e.message);
      }
    } on Failure {
      if (mounted) {
        setState(() => _saveError = 'That did not save. Check your connection and try again.');
      }
    } finally {
      if (mounted) setState(() => _busyFixture = null);
    }
  }

  /// The dashboard card says "Make your predictions" or "Predictions made"
  /// from a five-minute cache written before this save. Dropped after every
  /// save, as the LMS pick screen does after a pick, so Done lands on a card
  /// that tells the truth.
  Future<void> _clearDashboardCache() async {
    try {
      final apiClient = context.read<ApiClient>();
      final prefs = await SharedPreferences.getInstance();
      await DashboardRemoteDataSource(apiClient: apiClient, prefs: prefs).clearCache();
    } catch (_) {
      // A stale card is far smaller than a save reported as failed.
    }
  }

  /// Who predicted the home team, who the away team, who neither - per match.
  /// Every member is in exactly one list, so "not predicted" is a real count.
  Map<int, _Crowd> _crowds() {
    final everyone = _everyone;
    if (everyone == null) return const {};
    final byFixture = <int, Map<int, String>>{};
    for (final p in everyone.predictions) {
      (byFixture[p.fixtureId] ??= {})[p.userId] = p.team;
    }
    final out = <int, _Crowd>{};
    for (final f in everyone.fixtures) {
      final teams = byFixture[f.fixtureId] ?? const {};
      final crowd = _Crowd();
      for (final player in everyone.players) {
        final team = teams[player.userId];
        if (team == f.homeTeamShort) {
          crowd.home.add(player);
        } else if (team == f.awayTeamShort) {
          crowd.away.add(player);
        } else {
          crowd.none.add(player);
        }
      }
      out[f.fixtureId] = crowd;
    }
    return out;
  }

  void _openPlayer(MatchdayPlayer player, int roundNumber) {
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => MatchdayPlayerPage(
        competition: widget.competition,
        userId: player.userId,
        initialName: player.displayName,
        roundNumber: roundNumber,
      ),
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        MatchdayHeader(backLabel: widget.competition.name, onBack: widget.onBack),
        Expanded(child: _buildBody()),
      ],
    );
  }

  Widget _buildBody() {
    final coupon = _coupon;
    if (_loadError != null && coupon == null) {
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [MatchdayLoadFailed(message: _loadError!, onRetry: () => _load(place: true))],
      );
    }
    if (coupon == null) {
      return ListView(
        padding: const EdgeInsets.all(16),
        children: const [MatchdayLoading(line: 'Fetching this round\'s matches…')],
      );
    }
    final round = coupon.round;
    if (round == null || coupon.fixtures.isEmpty) {
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: matchdayPanel(),
            child: Column(
              children: [
                const Text('NO ROUND YET', style: CouponTheme.eyebrow),
                const SizedBox(height: 8),
                Text(
                  'The first round\'s matches aren\'t out yet.',
                  textAlign: TextAlign.center,
                  style: CouponTheme.bodyText,
                ),
                const SizedBox(height: 4),
                Text(
                  'They\'ll appear here as soon as they are.',
                  textAlign: TextAlign.center,
                  style: CouponTheme.bodyText.copyWith(fontSize: 15, color: CouponTheme.inkFade),
                ),
              ],
            ),
          ),
        ],
      );
    }

    final fixtures = coupon.fixtures;
    final open = _isOpen(coupon);
    final allPredicted = coupon.predicted == fixtures.length;
    final crowds = _crowds();
    // The scoring is explained once, in round 1. By round 2 everyone playing
    // has seen it, and it stays on the home masthead and under the table.
    final explainScoring = round.roundNumber == 1 && open;
    final left = fixtures.length - coupon.predicted;
    // Held back on an open last card until that match is predicted: offered
    // before the tap, it reads as the way to finish and the last match gets skipped.
    final onLast = _current == fixtures.length - 1;
    final showDone = (onLast && (!open || fixtures[_current].myTeam != null)) ||
        (open && allPredicted);

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // The round, the heading, and the lock on a line of its own - side by
          // side they collide on a phone.
          Text('ROUND ${round.roundNumber}', style: CouponTheme.eyebrow),
          const SizedBox(height: 6),
          matchdayHeading(coupon.isPlayer ? 'Your predictions' : 'The matches', size: 30),
          const SizedBox(height: 6),
          Text.rich(TextSpan(children: [
            TextSpan(text: round.locked ? 'LOCKED  ' : 'LOCKS  ', style: CouponTheme.label),
            TextSpan(text: formatKickoff(round.lockTime), style: CouponTheme.dataText.copyWith(fontSize: 14)),
          ])),
          const SizedBox(height: 8),

          if (_saveError != null) ...[
            MatchdayErrorLine(message: _saveError!),
            const SizedBox(height: 12),
          ],

          // The tracker: segments, not a count. Moss once predicted, a ring on
          // the current one, a tap to jump. The word is in each segment's
          // semantics label for a screen reader - state is never colour alone.
          if (coupon.isPlayer)
            Row(
              children: [
                for (var i = 0; i < fixtures.length; i++)
                  Expanded(
                    child: Semantics(
                      button: true,
                      selected: i == _current,
                      label: 'Match ${i + 1}: ${fixtures[i].homeTeam} v ${fixtures[i].awayTeam}, '
                          '${fixtures[i].myTeam != null ? 'predicted' : 'not predicted'}',
                      child: GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: () => _goTo(i),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 1.5, vertical: 8),
                          // A ring on the current one: an ink outline with a
                          // gap, never a fill - the segment's own colour is
                          // what says predicted or not.
                          child: Container(
                            padding: const EdgeInsets.all(2),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(7),
                              border: Border.all(
                                color: i == _current ? CouponTheme.ink : Colors.transparent,
                                width: 1.5,
                              ),
                            ),
                            child: Container(
                              height: 8,
                              decoration: BoxDecoration(
                                color: fixtures[i].myTeam != null
                                    ? CouponTheme.moss
                                    : CouponTheme.stockDeep,
                                borderRadius: BorderRadius.circular(4),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),

          // One line on where the round stands.
          Padding(
            padding: const EdgeInsets.only(top: 4, bottom: 8),
            child: Text(
              _statusLine(coupon, open, allPredicted),
              style: CouponTheme.bodyText.copyWith(fontSize: 15, color: CouponTheme.inkFade),
            ),
          ),

          // The strip. A swipe moves it; nothing chooses a team but a tap.
          Expanded(
            child: NotificationListener<ScrollStartNotification>(
              // A finger starting a swipe is a manual move like any other.
              onNotification: (n) {
                if (n.dragDetails != null) {
                  _advanceTimer?.cancel();
                  _advanceTimer = null;
                }
                return false;
              },
              child: PageView.builder(
                controller: _pager,
                itemCount: fixtures.length,
                onPageChanged: (index) => setState(() => _current = index),
                itemBuilder: (context, index) {
                  final fixture = fixtures[index];
                  return SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(1, 2, 8, 10),
                    child: _MatchCard(
                      fixture: fixture,
                      position: index + 1,
                      count: fixtures.length,
                      editable: open,
                      busy: _busyFixture == fixture.fixtureId,
                      isPlayer: coupon.isPlayer,
                      explainScoring: explainScoring,
                      onTap: (team) => _tapTeam(index, team),
                      crowd: crowds[fixture.fixtureId],
                      onPlayer: (player) => _openPlayer(player, round.roundNumber),
                    ),
                  );
                },
              ),
            ),
          ),

          // Previous / next. Cost nothing on a phone, and are the way for
          // anyone who does not think to swipe.
          Row(
            children: [
              Opacity(
                opacity: _current == 0 ? 0 : 1,
                child: TextButton.icon(
                  onPressed: _current == 0 ? null : () => _goTo(_current - 1),
                  icon: const Icon(Icons.chevron_left, size: 18),
                  label: Text('PREVIOUS', style: CouponTheme.label.copyWith(color: CouponTheme.ink)),
                ),
              ),
              Expanded(
                child: Text(
                  '${_current + 1} of ${fixtures.length}',
                  textAlign: TextAlign.center,
                  style: CouponTheme.dataText.copyWith(fontSize: 13, color: CouponTheme.inkFade),
                ),
              ),
              Opacity(
                opacity: _current >= fixtures.length - 1 ? 0 : 1,
                child: TextButton(
                  onPressed: _current >= fixtures.length - 1 ? null : () => _goTo(_current + 1),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('NEXT', style: CouponTheme.label.copyWith(color: CouponTheme.ink)),
                      const Icon(Icons.chevron_right, size: 18),
                    ],
                  ),
                ),
              ),
            ],
          ),

          // Done. On the last match, and on every match once all are
          // predicted. Red while the round is open - finishing is the screen's
          // next action - ink once it is locked, when it is only the way out.
          // Nothing to save: every tap was saved as it was made.
          if (showDone) ...[
            if (open && !allPredicted)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  '$left ${left == 1 ? 'match' : 'matches'} not predicted — '
                  '${left == 1 ? 'it scores' : 'they score'} 0. You can come back to '
                  '${left == 1 ? 'it' : 'them'} until the lock.',
                  textAlign: TextAlign.center,
                  style: CouponTheme.bodyText.copyWith(fontSize: 15, color: CouponTheme.inkFade),
                ),
              ),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: open
                    ? null
                    : ElevatedButton.styleFrom(
                        backgroundColor: CouponTheme.ink,
                        foregroundColor: CouponTheme.stockLit,
                      ),
                onPressed: widget.onBack,
                child: const Text('DONE'),
              ),
            ),
          ],

          // Earlier rounds: a link per direction rather than a picker.
          Container(
            margin: const EdgeInsets.only(top: 8),
            decoration: BoxDecoration(border: Border(top: CouponTheme.rule())),
            child: Row(
              children: [
                if (round.roundNumber > 1)
                  MatchdayTextLink(
                    label: '← Round ${round.roundNumber - 1}',
                    onTap: () => _showRound(round.roundNumber - 1),
                  ),
                const Spacer(),
                if (!round.latest)
                  MatchdayTextLink(label: 'Latest round →', onTap: () => _showRound(null)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _statusLine(MatchdayCoupon coupon, bool open, bool allPredicted) {
    final total = coupon.fixtures.length;
    if (!coupon.isPlayer) return 'You organise this one without playing.';
    if (open) {
      if (allPredicted) return 'All $total predicted. You can change any of them until the lock.';
      if (coupon.predicted == 0) return 'Tap the team you think will win.';
      return '${total - coupon.predicted} still to predict.';
    }
    if (coupon.settledCount == 0) {
      return 'You predicted ${coupon.predicted} of $total. Matches in play.';
    }
    return 'This round: ${signedPoints(coupon.roundPoints)} · ${coupon.settledCount} of $total results in';
  }
}

class _Crowd {
  final List<MatchdayPlayer> home = [];
  final List<MatchdayPlayer> away = [];
  final List<MatchdayPlayer> none = [];
}

/// One match. The two teams ARE the choice: home first, a small v, then away -
/// no Home / Away labels and no fixture line above them, which said the same
/// thing twice.
class _MatchCard extends StatelessWidget {
  const _MatchCard({
    required this.fixture,
    required this.position,
    required this.count,
    required this.editable,
    required this.busy,
    required this.isPlayer,
    required this.explainScoring,
    required this.onTap,
    required this.crowd,
    required this.onPlayer,
  });

  final MatchdayFixture fixture;
  final int position;
  final int count;
  final bool editable;
  final bool busy;

  /// False for an organiser who is not playing: they see the matches, and
  /// nothing on them speaks as if they had predictions to make.
  final bool isPlayer;
  final bool explainScoring;
  final ValueChanged<String> onTap;
  final _Crowd? crowd;
  final ValueChanged<MatchdayPlayer> onPlayer;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: CouponTheme.stockLit,
        border: Border.fromBorderSide(CouponTheme.rule()),
        // The one print-offset shadow belongs to "the sheet", and a card is
        // exactly that.
        boxShadow: CouponTheme.printOffset,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Text('MATCH $position OF $count', style: CouponTheme.label),
              const Spacer(),
              Text(
                formatKickoff(fixture.kickoffTime),
                style: CouponTheme.dataText.copyWith(fontSize: 13, color: CouponTheme.inkFade),
              ),
            ],
          ),
          if (editable) ...[
            const SizedBox(height: 14),
            Text(
              'WHO WINS?',
              textAlign: TextAlign.center,
              style: CouponTheme.label.copyWith(color: CouponTheme.ink),
            ),
          ],
          const SizedBox(height: 14),
          _TeamButton(
            name: fixture.homeTeam,
            chosen: fixture.myTeam == fixture.homeTeamShort,
            editable: editable,
            busy: busy,
            onTap: () => onTap(fixture.homeTeamShort),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Text('V', textAlign: TextAlign.center, style: CouponTheme.label),
          ),
          _TeamButton(
            name: fixture.awayTeam,
            chosen: fixture.myTeam == fixture.awayTeamShort,
            editable: editable,
            busy: busy,
            onTap: () => onTap(fixture.awayTeamShort),
          ),
          const SizedBox(height: 14),
          ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 20),
            child: Center(child: _statement()),
          ),
          if (crowd != null) _CrowdLine(fixture: fixture, crowd: crowd!, onPlayer: onPlayer),
        ],
      ),
    );
  }

  /// One statement under the teams. Every state carries its word as well as
  /// its colour (design-system §8).
  Widget _statement() {
    final fade = CouponTheme.bodyText.copyWith(fontSize: 13, color: CouponTheme.inkFade);
    final resultText = fixture.resultText;
    if (busy) return Text('Saving…', style: fade);
    if (fixture.settled && fixture.myTeam != null && fixture.myPoints != null) {
      return Text.rich(
        TextSpan(children: [
          if (resultText != null) TextSpan(text: '$resultText  ·  ', style: fade),
          TextSpan(
            text: outcomeWord(fixture.myTeam, fixture.result).toUpperCase(),
            style: CouponTheme.label.copyWith(color: CouponTheme.ink),
          ),
          TextSpan(
            text: ' ${signedPoints(fixture.myPoints!)}',
            style: CouponTheme.dataText.copyWith(fontSize: 14),
          ),
        ]),
        textAlign: TextAlign.center,
      );
    }
    if (resultText != null) {
      return Text(
        '$resultText${fixture.myTeam == null && isPlayer ? '  ·  not predicted' : ''}',
        textAlign: TextAlign.center,
        style: fade,
      );
    }
    if (editable) {
      if (fixture.myTeam != null) return Text('Tap it again to take it back', style: fade);
      if (explainScoring) {
        return Text(
          matchdayScoring.toUpperCase(),
          style: CouponTheme.label.copyWith(color: CouponTheme.ink),
        );
      }
      return const SizedBox.shrink();
    }
    if (fixture.myTeam == null && isPlayer) return Text('Not predicted  ·  scores 0', style: fade);
    return const SizedBox.shrink();
  }
}

class _TeamButton extends StatelessWidget {
  const _TeamButton({
    required this.name,
    required this.chosen,
    required this.editable,
    required this.busy,
    required this.onTap,
  });

  final String name;
  final bool chosen;
  final bool editable;
  final bool busy;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final border = chosen
        ? const BorderSide(color: CouponTheme.moss, width: 2)
        : BorderSide(color: CouponTheme.ink.withValues(alpha: editable ? 0.3 : 0.15));
    return Semantics(
      button: editable,
      selected: chosen,
      label: chosen
          ? '$name, your prediction${editable ? ', tap to take it back' : ''}'
          : editable
              ? '$name to win'
              : name,
      excludeSemantics: true,
      child: Material(
        color: chosen ? CouponTheme.mossWash : Colors.transparent,
        child: InkWell(
          onTap: editable && !busy ? onTap : null,
          child: Container(
            constraints: const BoxConstraints(minHeight: 64),
            decoration: BoxDecoration(border: Border.fromBorderSide(border)),
            child: Stack(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
                  child: Center(
                    child: Text(
                      name,
                      textAlign: TextAlign.center,
                      style: CouponTheme.dataText.copyWith(fontSize: 20, height: 1.15),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Who predicted what on one match - only ever given for a locked round (§10).
/// One line of counts, the names behind a tap; each name opens that player's
/// predictions.
class _CrowdLine extends StatefulWidget {
  const _CrowdLine({required this.fixture, required this.crowd, required this.onPlayer});

  final MatchdayFixture fixture;
  final _Crowd crowd;
  final ValueChanged<MatchdayPlayer> onPlayer;

  @override
  State<_CrowdLine> createState() => _CrowdLineState();
}

class _CrowdLineState extends State<_CrowdLine> {
  bool _showNames = false;

  /// What a prediction on [team] scored, once settled - read from the result,
  /// never from points.
  String? _sideWord(String team) {
    final f = widget.fixture;
    if (!f.settled || f.result == null) return null;
    return outcomeWord(team, f.result);
  }

  Widget _column(String label, String? team, List<MatchdayPlayer> players) {
    final word = team == null ? null : _sideWord(team);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text.rich(TextSpan(children: [
          TextSpan(text: label.toUpperCase(), style: CouponTheme.label),
          if (word != null)
            TextSpan(
              text: ' · ${word.toUpperCase()}',
              style: CouponTheme.label.copyWith(color: CouponTheme.ink),
            ),
        ])),
        const SizedBox(height: 4),
        if (players.isEmpty)
          Text('Nobody', style: CouponTheme.bodyText.copyWith(fontSize: 13, color: CouponTheme.inkFade))
        else
          for (final player in players)
            InkWell(
              onTap: () => widget.onPlayer(player),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Text(
                  player.displayName,
                  overflow: TextOverflow.ellipsis,
                  style: CouponTheme.dataText.copyWith(
                    fontSize: 14,
                    fontWeight: player.isMe ? FontWeight.bold : FontWeight.normal,
                    decoration: TextDecoration.underline,
                    decorationStyle: TextDecorationStyle.dotted,
                  ),
                ),
              ),
            ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final f = widget.fixture;
    final crowd = widget.crowd;
    final small = CouponTheme.dataText.copyWith(fontSize: 13);
    final fade = CouponTheme.bodyText.copyWith(fontSize: 13, color: CouponTheme.inkFade);
    return Container(
      margin: const EdgeInsets.only(top: 14),
      padding: const EdgeInsets.only(top: 10),
      decoration: BoxDecoration(border: Border(top: CouponTheme.rule())),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InkWell(
            onTap: () => setState(() => _showNames = !_showNames),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Text.rich(
                TextSpan(children: [
                  TextSpan(text: '${f.homeTeam} ${crowd.home.length}', style: small),
                  TextSpan(text: '  ·  ', style: fade),
                  TextSpan(text: '${f.awayTeam} ${crowd.away.length}', style: small),
                  if (crowd.none.isNotEmpty) ...[
                    TextSpan(text: '  ·  ', style: fade),
                    TextSpan(text: 'not predicted ${crowd.none.length}', style: fade),
                  ],
                  TextSpan(
                    text: _showNames ? '   HIDE' : '   WHO',
                    style: CouponTheme.label.copyWith(
                      decoration: TextDecoration.underline,
                      decorationStyle: TextDecorationStyle.dotted,
                    ),
                  ),
                ]),
                textAlign: TextAlign.center,
              ),
            ),
          ),
          if (_showNames) ...[
            const SizedBox(height: 8),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: _column(f.homeTeam, f.homeTeamShort, crowd.home)),
                const SizedBox(width: 16),
                Expanded(child: _column(f.awayTeam, f.awayTeamShort, crowd.away)),
              ],
            ),
            if (crowd.none.isNotEmpty) ...[
              const SizedBox(height: 12),
              _column('Not predicted', null, crowd.none),
            ],
          ],
        ],
      ),
    );
  }
}
