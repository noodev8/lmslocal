import 'package:material_ui/material_ui.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:lmslocal_flutter/core/game/games.dart';
import 'package:lmslocal_flutter/core/game/round_state.dart' show joiningOpen;
import 'package:lmslocal_flutter/core/theme/coupon_theme.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/api_client.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/matchday_remote_data_source.dart';
import 'package:lmslocal_flutter/domain/entities/competition.dart';
import 'package:lmslocal_flutter/domain/entities/matchday.dart';
import 'package:lmslocal_flutter/presentation/pages/competition/widgets/invite_block.dart';
import 'package:lmslocal_flutter/presentation/pages/matchday/widgets/matchday_ui.dart';

/// A Matchday competition's home - the Dashboard tab. The web's
/// `components/matchday/MatchdayHome.tsx`; docs/matchday-app.md §6.
///
/// What it answers, in order: which game this is; what to do now (the round,
/// the one thing a player can act on, so it comes first); where you stand; how
/// the table looks. The app is player-only, so none of the web's organiser
/// tiles: a Matchday organiser has nothing to run - the matches and results
/// are ours.
class MatchdayHomePage extends StatefulWidget {
  const MatchdayHomePage({
    super.key,
    required this.competition,
    required this.onGoToPredictions,
    required this.onGoToTable,
  });

  final Competition competition;
  final VoidCallback onGoToPredictions;
  final VoidCallback onGoToTable;

  @override
  State<MatchdayHomePage> createState() => _MatchdayHomePageState();
}

// How much of the table the home shows: enough to see the race.
const _tablePreviewRows = 5;

class _MatchdayHomePageState extends State<MatchdayHomePage> {
  late final MatchdayRemoteDataSource _dataSource =
      MatchdayRemoteDataSource(apiClient: context.read<ApiClient>());

  MatchdayCoupon? _coupon;
  MatchdayTable? _table;
  bool _loadFailed = false;
  bool _loaded = false;
  bool _aboutOpen = false;

  Competition get _competition => widget.competition;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    MatchdayCoupon? coupon;
    MatchdayTable? table;
    var failed = false;
    await Future.wait([
      _dataSource.getPredictions(_competition.id).then((c) => coupon = c).catchError((Object e) {
        failed = true;
        return MatchdayCoupon(isPlayer: false, round: null, fixtures: const [], status: '');
      }),
      _dataSource.getTable(_competition.id).then((t) => table = t).catchError((Object e) {
        failed = true;
        return const MatchdayTable(roundsSettled: 0, rows: [], status: '');
      }),
    ]);
    if (!mounted) return;
    setState(() {
      _coupon = coupon ?? _coupon;
      _table = table ?? _table;
      _loadFailed = failed;
      _loaded = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        MatchdayHeader(backLabel: 'Dashboard', onBack: () => context.go('/dashboard')),
        Expanded(
          child: RefreshIndicator(
            onRefresh: _load,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
              children: [
                _masthead(),
                const SizedBox(height: 16),
                if (_loadFailed) ...[
                  const MatchdayErrorLine(
                    message: 'Part of this screen didn\'t load. Pull down to try again.',
                  ),
                  const SizedBox(height: 16),
                ],
                // Everything below the masthead waits for both requests, so the
                // invite block does not paint first and then jump down the page
                // as the round and the table land above it.
                if (!_loaded) const MatchdayLoading() else ..._content(),
              ],
            ),
          ),
        ),
      ],
    );
  }

  /// The game is the eyebrow, and its scoring is on the screen itself, so a
  /// player who only ever sees this page still knows the rules.
  Widget _masthead() {
    final ending = endingLabel(_competition.endRule, _competition.endValue);
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
      decoration: matchdayPanel(),
      child: Column(
        children: [
          Text(gameNames[GameType.matchday]!.toUpperCase(), style: CouponTheme.eyebrow),
          const SizedBox(height: 8),
          Text(
            _competition.name.toUpperCase(),
            textAlign: TextAlign.center,
            style: CouponTheme.heading(32),
          ),
          if (_competition.personalName != null) ...[
            const SizedBox(height: 4),
            Text(
              _competition.personalName!,
              textAlign: TextAlign.center,
              style: CouponTheme.dataText.copyWith(fontStyle: FontStyle.italic, color: CouponTheme.inkFade),
            ),
          ],
          if (_competition.venueName != null && _competition.venueName!.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              _competition.venueName!,
              textAlign: TextAlign.center,
              style: CouponTheme.bodyText.copyWith(fontSize: 15, color: CouponTheme.inkFade),
            ),
          ],
          const SizedBox(height: 16),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.only(top: 14),
            decoration: BoxDecoration(border: Border(top: CouponTheme.rule())),
            child: Text.rich(
              TextSpan(children: [
                TextSpan(
                  text: matchdayScoring.toUpperCase(),
                  style: CouponTheme.label.copyWith(color: CouponTheme.ink),
                ),
                if (ending.isNotEmpty)
                  TextSpan(text: ' · ${ending.toUpperCase()}', style: CouponTheme.label),
              ]),
              textAlign: TextAlign.center,
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _content() {
    final coupon = _coupon;
    final table = _table;
    final isComplete = (table?.isComplete ?? false) ||
        (coupon?.isComplete ?? false) ||
        _competition.status.toUpperCase() == 'COMPLETE';
    final me = table?.me;
    final round = coupon?.round;

    return [
      if (isComplete && table != null) ...[_result(table), const SizedBox(height: 16)],
      if (!isComplete && coupon != null) ...[_roundPanel(coupon), const SizedBox(height: 16)],
      if (!isComplete && me != null) ...[_position(me, table!), const SizedBox(height: 16)],
      if (!isComplete && table != null && table.rows.isNotEmpty) ...[
        _tablePreview(table),
        const SizedBox(height: 16),
      ],
      // Recruiting, while there is still time: joining closes when round 1
      // locks, exactly as LMS (docs/matchday.md §6).
      if (joiningOpen(
        currentRound: round?.roundNumber ?? _competition.currentRound,
        currentRoundLockTime: round?.lockTime ?? _competition.currentRoundLockTime,
      )) ...[
        InviteBlock(competition: _competition),
        const SizedBox(height: 16),
      ],
      _about(),
    ];
  }

  Widget _roundPanel(MatchdayCoupon coupon) {
    final round = coupon.round;
    final fade = CouponTheme.bodyText.copyWith(fontSize: 15, color: CouponTheme.inkFade);

    Widget panel(List<Widget> children) => Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: matchdayPanel(),
          child: Column(children: children),
        );

    if (round == null) {
      return panel([
        const Text('ROUND 1', style: CouponTheme.eyebrow),
        const SizedBox(height: 8),
        Text('Waiting for the first round\'s matches.',
            textAlign: TextAlign.center, style: CouponTheme.bodyText),
        const SizedBox(height: 4),
        Text(
          'We add them for you — they\'ll appear here, and everyone can make their predictions.',
          textAlign: TextAlign.center,
          style: fade,
        ),
      ]);
    }

    if (!round.locked) {
      if (!coupon.isPlayer) {
        return panel([
          Text('ROUND ${round.roundNumber}', style: CouponTheme.eyebrow),
          const SizedBox(height: 8),
          Text('${coupon.totalFixtures} matches this round.',
              textAlign: TextAlign.center, style: CouponTheme.bodyText),
          const SizedBox(height: 4),
          Text('Players can predict until ${formatKickoff(round.lockTime)}.',
              textAlign: TextAlign.center, style: fade),
        ]);
      }
      // Red only while nothing is predicted, the same rule as the dashboard
      // card: the screen's one red action means "this is on you". A player who
      // predicted some and skipped the rest has made their predictions.
      final nothingYet = coupon.predicted == 0;
      return panel([
        Text('ROUND ${round.roundNumber}', style: CouponTheme.eyebrow),
        const SizedBox(height: 8),
        Text.rich(
          TextSpan(children: [
            TextSpan(
              text: '${coupon.predicted}',
              style: CouponTheme.heading(64).copyWith(color: CouponTheme.overprint, height: 1.1),
            ),
            TextSpan(
              text: '/${coupon.totalFixtures}',
              style: CouponTheme.heading(64)
                  .copyWith(color: CouponTheme.ink.withValues(alpha: 0.4), height: 1.1),
            ),
          ]),
        ),
        const SizedBox(height: 4),
        const Text('MATCHES PREDICTED', style: CouponTheme.label),
        const SizedBox(height: 12),
        Text(
          'Locks ${formatKickoff(round.lockTime)}. Change any of them until then.',
          textAlign: TextAlign.center,
          style: fade,
        ),
        const SizedBox(height: 16),
        SizedBox(
          width: double.infinity,
          child: nothingYet
              ? ElevatedButton(
                  onPressed: widget.onGoToPredictions,
                  child: const Text('MAKE YOUR PREDICTIONS'),
                )
              : OutlinedButton(
                  onPressed: widget.onGoToPredictions,
                  child: const Text('YOUR PREDICTIONS'),
                ),
        ),
      ]);
    }

    final resultsIn = coupon.settledCount;
    final total = coupon.totalFixtures;
    return panel([
      Text('ROUND ${round.roundNumber}', style: CouponTheme.eyebrow),
      const SizedBox(height: 8),
      Text(
        resultsIn == 0
            ? 'Predictions locked. Matches in play.'
            : resultsIn < total
                ? 'Results coming in: $resultsIn of $total.'
                : 'All results in.',
        textAlign: TextAlign.center,
        style: CouponTheme.bodyText,
      ),
      if (coupon.isPlayer) ...[
        const SizedBox(height: 4),
        Text.rich(
          TextSpan(children: [
            TextSpan(text: 'You predicted ${coupon.predicted} of $total', style: fade),
            if (resultsIn > 0) ...[
              TextSpan(text: '  ·  ', style: fade),
              TextSpan(text: signedPoints(coupon.roundPoints), style: CouponTheme.dataText),
              TextSpan(text: resultsIn < total ? ' this round so far' : ' this round', style: fade),
            ],
          ]),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 16),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton(
            onPressed: widget.onGoToPredictions,
            child: const Text('YOUR PREDICTIONS'),
          ),
        ),
      ],
    ]);
  }

  /// Where you stand. A stat block, tapping through to the table.
  Widget _position(MatchdayTableRow me, MatchdayTable table) {
    return Material(
      color: CouponTheme.stockLit,
      child: InkWell(
        onTap: widget.onGoToTable,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(border: Border.fromBorderSide(CouponTheme.rule())),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('YOUR POSITION', style: CouponTheme.label),
                    const SizedBox(height: 4),
                    Text.rich(TextSpan(children: [
                      TextSpan(text: ordinal(me.position).toUpperCase(), style: CouponTheme.heading(30)),
                      TextSpan(
                        text: ' OF ${table.rows.length}',
                        style: CouponTheme.heading(30).copyWith(color: CouponTheme.inkFade),
                      ),
                      TextSpan(
                        text: '  ·  ',
                        style: CouponTheme.heading(30).copyWith(color: CouponTheme.ink.withValues(alpha: 0.3)),
                      ),
                      TextSpan(text: '${me.total} PTS', style: CouponTheme.heading(30)),
                    ])),
                    if (me.provisional) ...[
                      const SizedBox(height: 2),
                      Text(
                        'Includes this round so far',
                        style: CouponTheme.bodyText.copyWith(fontSize: 13, color: CouponTheme.inkFade),
                      ),
                    ],
                  ],
                ),
              ),
              const Text('THE TABLE', style: CouponTheme.label),
              const Icon(Icons.chevron_right, size: 18, color: CouponTheme.inkFade),
            ],
          ),
        ),
      ),
    );
  }

  /// The top of the table: dotted leaders, names in the typewriter face - the
  /// survival sheet's pattern, which design-system §8 makes the model.
  Widget _tablePreview(MatchdayTable table) {
    final endValue = _competition.endValue;
    final played = _competition.endRule == 'rounds' && endValue != null
        ? '${table.roundsSettled} of $endValue rounds played'
        : endValue != null
            ? 'First to $endValue'
            : '';
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 4),
      decoration: matchdayPanel(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text('THE TABLE', style: CouponTheme.label),
              const Spacer(),
              Text(played.toUpperCase(), style: CouponTheme.label),
            ],
          ),
          const SizedBox(height: 6),
          for (final row in table.rows.take(_tablePreviewRows))
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 5),
              child: Row(
                children: [
                  SizedBox(
                    width: 24,
                    child: Text(
                      '${row.position}',
                      textAlign: TextAlign.right,
                      style: CouponTheme.dataText.copyWith(color: CouponTheme.inkFade),
                    ),
                  ),
                  const SizedBox(width: 12),
                  // Name and points sit on a dotted rule that runs the full
                  // width, each on a patch of paper - so the points line up
                  // down the right edge however long the name.
                  Expanded(
                    child: CustomPaint(
                      painter: const _DotsPainter(),
                      child: Row(
                        children: [
                          Flexible(
                            flex: 4,
                            child: Container(
                              color: CouponTheme.stockLit,
                              padding: const EdgeInsets.only(right: 6),
                              child: Text(
                                row.displayName,
                                overflow: TextOverflow.ellipsis,
                                style: CouponTheme.dataText.copyWith(
                                  fontSize: 16,
                                  fontWeight: row.isMe ? FontWeight.bold : FontWeight.normal,
                                ),
                              ),
                            ),
                          ),
                          const Spacer(),
                          Container(
                            color: CouponTheme.stockLit,
                            padding: const EdgeInsets.only(left: 6),
                            child: Text(
                              '${row.total}${row.provisional ? '*' : ''}',
                              style: CouponTheme.dataText.copyWith(fontSize: 16),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          MatchdayTextLink(label: 'Full table', onTap: widget.onGoToTable),
        ],
      ),
    );
  }

  /// The result, once there is one. A field, so moss-wash with ink on top.
  Widget _result(MatchdayTable table) {
    final first = table.firstPlace;
    final me = table.me;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: CouponTheme.mossWash,
        border: Border.fromBorderSide(CouponTheme.rule()),
      ),
      child: Column(
        children: [
          Text(
            first.length > 1 ? 'SHARED WIN' : 'WINNER',
            style: CouponTheme.eyebrow.copyWith(color: CouponTheme.ink),
          ),
          const SizedBox(height: 8),
          Text(
            first.isEmpty ? '—' : first.map((r) => r.displayName).join(' and '),
            textAlign: TextAlign.center,
            style: CouponTheme.dataText.copyWith(fontSize: 24),
          ),
          if (first.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text('${first.first.total} POINTS', style: CouponTheme.label.copyWith(color: CouponTheme.ink)),
          ],
          if (me != null && !first.any((r) => r.isMe)) ...[
            const SizedBox(height: 12),
            Text(
              'You finished ${ordinal(me.position)} on ${me.total} points.',
              textAlign: TextAlign.center,
              style: CouponTheme.bodyText.copyWith(fontSize: 15),
            ),
          ],
          const SizedBox(height: 16),
          OutlinedButton(onPressed: widget.onGoToTable, child: const Text('FINAL TABLE')),
        ],
      ),
    );
  }

  /// The organiser's blurb, collapsed: it holds the entry fee and the prize,
  /// so it is never more than one tap away.
  Widget _about() {
    final description = _competition.description;
    final prize = _competition.prizeStructure;
    final text = [
      if (prize != null && prize.isNotEmpty) prize,
      if (description != null && description.isNotEmpty) description,
    ].join('\n\n');
    if (text.isEmpty) return const SizedBox.shrink();
    return Container(
      decoration: matchdayPanel(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InkWell(
            onTap: () => setState(() => _aboutOpen = !_aboutOpen),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  const Expanded(child: Text('ABOUT THIS COMPETITION', style: CouponTheme.label)),
                  Icon(
                    _aboutOpen ? Icons.expand_less : Icons.expand_more,
                    size: 20,
                    color: CouponTheme.inkFade,
                  ),
                ],
              ),
            ),
          ),
          if (_aboutOpen)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(border: Border(top: CouponTheme.rule())),
              child: Text(text, style: CouponTheme.bodyText.copyWith(fontSize: 15)),
            ),
        ],
      ),
    );
  }
}

/// The dotted leader under a name and its points, drawn near the baseline.
class _DotsPainter extends CustomPainter {
  const _DotsPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = CouponTheme.ink.withValues(alpha: 0.35);
    final y = size.height - 5;
    for (double x = 1; x < size.width; x += 5) {
      canvas.drawCircle(Offset(x, y), 0.8, paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
