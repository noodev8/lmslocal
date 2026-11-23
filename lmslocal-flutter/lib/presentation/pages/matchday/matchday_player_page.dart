import 'package:material_ui/material_ui.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:lmslocal_flutter/core/errors/failures.dart';
import 'package:lmslocal_flutter/core/game/games.dart';
import 'package:lmslocal_flutter/core/theme/coupon_theme.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/api_client.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/matchday_remote_data_source.dart';
import 'package:lmslocal_flutter/domain/entities/competition.dart';
import 'package:lmslocal_flutter/domain/entities/matchday.dart';
import 'package:lmslocal_flutter/presentation/pages/matchday/widgets/matchday_ui.dart';

/// One player's Matchday predictions, round by round - the web's
/// `/game/[id]/table/[userId]` (docs/matchday-app.md §10, docs/matchday.md
/// §8.6). Reached from the table and from the names on a locked card. View only.
///
/// LOCKED ROUNDS ONLY, for anyone's predictions including your own: nobody sees
/// anyone else's before the lock, and the server enforces it - this page never
/// asks for an open round. Your own open round is on the Play tab.
class MatchdayPlayerPage extends StatefulWidget {
  const MatchdayPlayerPage({
    super.key,
    required this.competition,
    required this.userId,
    this.initialName,
    this.roundNumber,
  });

  final Competition competition;
  final int userId;

  /// Shown while the page loads, so the heading does not flash "Player".
  final String? initialName;

  /// The round to open on; null is the latest locked round.
  final int? roundNumber;

  @override
  State<MatchdayPlayerPage> createState() => _MatchdayPlayerPageState();
}

class _MatchdayPlayerPageState extends State<MatchdayPlayerPage> {
  late final MatchdayRemoteDataSource _dataSource =
      MatchdayRemoteDataSource(apiClient: context.read<ApiClient>());

  late int? _roundNumber = widget.roundNumber;
  MatchdayRoundPredictions? _data;
  MatchdayTable? _table;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _data = null;
      _error = null;
    });
    try {
      final results = await Future.wait([
        _dataSource.getRoundPredictions(widget.competition.id, roundNumber: _roundNumber),
        _dataSource.getTable(widget.competition.id).then<MatchdayTable?>((t) => t).catchError((_) => null),
      ]);
      if (!mounted) return;
      setState(() {
        _data = results[0] as MatchdayRoundPredictions;
        _table = results[1] as MatchdayTable?;
      });
    } on Failure catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  void _showRound(int roundNumber) {
    _roundNumber = roundNumber;
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final data = _data;
    MatchdayPlayer? player;
    for (final p in data?.players ?? const <MatchdayPlayer>[]) {
      if (p.userId == widget.userId) player = p;
    }
    final tableRow = _table?.rowFor(widget.userId);
    final name = player?.displayName ?? tableRow?.displayName ?? widget.initialName ?? 'Player';
    final mine = <int, MatchdayPrediction>{
      for (final p in data?.predictions ?? const <MatchdayPrediction>[])
        if (p.userId == widget.userId) p.fixtureId: p,
    };
    final roundPoints = mine.values.fold<int>(0, (sum, p) => sum + (p.points ?? 0));
    final unsettled = (data?.fixtures ?? const <MatchdayFixture>[]).any((f) => !f.settled);
    final roundNumber = data?.roundNumber;

    return Scaffold(
      backgroundColor: CouponTheme.stock,
      body: Column(
        children: [
          MatchdayHeader(backLabel: 'Back', onBack: () => Navigator.of(context).pop()),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 40),
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            roundNumber != null ? 'ROUND $roundNumber' : 'PREDICTIONS',
                            style: CouponTheme.eyebrow,
                          ),
                          const SizedBox(height: 6),
                          Text(
                            name.toUpperCase(),
                            style: CouponTheme.heading(30),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    if (tableRow != null)
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            '${ordinal(tableRow.position)} of ${_table!.rows.length}'.toUpperCase(),
                            style: CouponTheme.label,
                          ),
                          Text(
                            '${tableRow.total} PTS${tableRow.provisional ? '*' : ''}',
                            style: CouponTheme.heading(24),
                          ),
                        ],
                      ),
                  ],
                ),
                const SizedBox(height: 20),
                if (_error != null)
                  MatchdayLoadFailed(message: _error!, onRetry: _load)
                else if (data == null)
                  const MatchdayLoading()
                else if (roundNumber == null)
                  _note(
                    'Everyone\'s predictions appear here once round 1 locks.',
                    'Until then, nobody can see anyone else\'s.',
                  )
                else if (player == null)
                  _note('This player isn\'t in the competition.', null)
                else ...[
                  // A ledger, like the table: one row per match.
                  Container(
                    decoration: matchdayPanel(),
                    child: Column(
                      children: [
                        for (var i = 0; i < data.fixtures.length; i++)
                          _ledgerRow(data.fixtures[i], mine[data.fixtures[i].fixtureId],
                              last: i == data.fixtures.length - 1),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  Align(
                    alignment: Alignment.centerRight,
                    child: Text.rich(TextSpan(children: [
                      TextSpan(text: 'This round: ', style: CouponTheme.bodyText.copyWith(fontSize: 15)),
                      TextSpan(text: signedPoints(roundPoints), style: CouponTheme.dataText),
                      if (unsettled)
                        TextSpan(
                          text: ' so far',
                          style: CouponTheme.bodyText.copyWith(fontSize: 15, color: CouponTheme.inkFade),
                        ),
                    ])),
                  ),
                  // Round by round, between locked rounds only.
                  Container(
                    margin: const EdgeInsets.only(top: 20),
                    decoration: BoxDecoration(border: Border(top: CouponTheme.rule())),
                    child: Row(
                      children: [
                        if (roundNumber > 1)
                          MatchdayTextLink(
                            label: '← Round ${roundNumber - 1}',
                            onTap: () => _showRound(roundNumber - 1),
                          ),
                        const Spacer(),
                        if (roundNumber < (data.latestLockedRoundNumber ?? roundNumber))
                          MatchdayTextLink(
                            label: 'Round ${roundNumber + 1} →',
                            onTap: () => _showRound(roundNumber + 1),
                          ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _note(String line, String? sub) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: matchdayPanel(),
      child: Column(
        children: [
          Text(line, textAlign: TextAlign.center, style: CouponTheme.bodyText),
          if (sub != null) ...[
            const SizedBox(height: 4),
            Text(
              sub,
              textAlign: TextAlign.center,
              style: CouponTheme.bodyText.copyWith(fontSize: 15, color: CouponTheme.inkFade),
            ),
          ],
        ],
      ),
    );
  }

  Widget _ledgerRow(MatchdayFixture fixture, MatchdayPrediction? prediction, {required bool last}) {
    final teamName = prediction == null ? null : fixture.teamName(prediction.team);
    // Every state carries its word as well as its number (design-system §8).
    final Widget right;
    if (prediction != null && prediction.points != null) {
      right = Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(
            outcomeWord(prediction.team, fixture.result).toUpperCase(),
            style: CouponTheme.label.copyWith(color: CouponTheme.ink),
          ),
          Text(signedPoints(prediction.points!), style: CouponTheme.dataText),
        ],
      );
    } else if (prediction != null) {
      right = Text('IN PLAY', style: CouponTheme.label);
    } else {
      right = Text('0', style: CouponTheme.dataText.copyWith(color: CouponTheme.inkFade));
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(border: Border(bottom: last ? BorderSide.none : CouponTheme.rule())),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${fixture.homeTeam} v ${fixture.awayTeam}',
                  overflow: TextOverflow.ellipsis,
                  style: CouponTheme.bodyText.copyWith(fontSize: 13, color: CouponTheme.inkFade),
                ),
                const SizedBox(height: 2),
                Text(
                  teamName ?? 'Not predicted',
                  overflow: TextOverflow.ellipsis,
                  style: CouponTheme.dataText.copyWith(
                    fontSize: 16,
                    color: teamName != null ? CouponTheme.ink : CouponTheme.inkFade,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          right,
        ],
      ),
    );
  }
}
