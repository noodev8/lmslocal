import 'package:material_ui/material_ui.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:lmslocal_flutter/core/errors/failures.dart';
import 'package:lmslocal_flutter/core/game/games.dart';
import 'package:lmslocal_flutter/core/theme/coupon_theme.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/api_client.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/matchday_remote_data_source.dart';
import 'package:lmslocal_flutter/domain/entities/competition.dart';
import 'package:lmslocal_flutter/domain/entities/matchday.dart';
import 'package:lmslocal_flutter/presentation/pages/matchday/matchday_player_page.dart';
import 'package:lmslocal_flutter/presentation/pages/matchday/widgets/matchday_ui.dart';

/// The Matchday league table - the Table tab. The web's `/game/[id]/table`;
/// docs/matchday-app.md §8, docs/matchday.md §8.3.
///
/// Position, name, W / D / L, predictions made and points: the figures that
/// break a tie are shown so nobody argues. Already ranked by the server, ties
/// already shared (1, 2, 2, 4) - shown exactly as given.
class MatchdayTablePage extends StatefulWidget {
  const MatchdayTablePage({super.key, required this.competition, required this.onBack});

  final Competition competition;
  final VoidCallback onBack;

  @override
  State<MatchdayTablePage> createState() => _MatchdayTablePageState();
}

// A big competition opens trimmed: the top TOP_ROWS, a row of dots, your own
// row with NEIGHBOURS either side, and the rest a tap away. Under SHOW_ALL_UNDER
// players it shows everyone - cutting a 25-row table to 20 saves nothing.
const _topRows = 20;
const _neighbours = 2;
const _showAllUnder = 30;

class _MatchdayTablePageState extends State<MatchdayTablePage> {
  late final MatchdayRemoteDataSource _dataSource =
      MatchdayRemoteDataSource(apiClient: context.read<ApiClient>());

  MatchdayTable? _data;
  String? _error;
  bool _showAll = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final table = await _dataSource.getTable(widget.competition.id);
      if (mounted) {
        setState(() {
          _data = table;
          _error = null;
        });
      }
    } on Failure catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  void _openPlayer(MatchdayTableRow row) {
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => MatchdayPlayerPage(
        competition: widget.competition,
        userId: row.userId,
        initialName: row.displayName,
      ),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final data = _data;
    final ending = endingLabel(
      data?.endRule ?? widget.competition.endRule,
      data?.endValue ?? widget.competition.endValue,
    );
    final eyebrow = data == null
        ? 'The table'
        : data.isComplete
            ? 'Final'
            : data.latestRoundNumber == null
                ? 'Before round 1'
                // "After round 0" in the middle of round 1 says nothing true.
                : data.roundsSettled == 0
                    ? 'Round 1'
                    : 'After round ${data.roundsSettled}';

    return Column(
      children: [
        MatchdayHeader(backLabel: widget.competition.name, onBack: widget.onBack),
        Expanded(
          child: RefreshIndicator(
            onRefresh: _load,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 40),
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(eyebrow.toUpperCase(), style: CouponTheme.eyebrow),
                          const SizedBox(height: 6),
                          matchdayHeading('The table', size: 30),
                        ],
                      ),
                    ),
                    if (ending.isNotEmpty)
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          const Text('GAME LENGTH', style: CouponTheme.label),
                          const SizedBox(height: 2),
                          Text(ending, style: CouponTheme.bodyText.copyWith(fontSize: 15)),
                        ],
                      ),
                  ],
                ),
                const SizedBox(height: 20),
                if (_error != null && data == null)
                  MatchdayLoadFailed(message: _error!, onRetry: _load)
                else if (data == null)
                  const MatchdayLoading()
                else if (data.rows.isEmpty)
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: matchdayPanel(),
                    child: Column(
                      children: [
                        Text('Nobody has joined yet.', style: CouponTheme.bodyText),
                        const SizedBox(height: 4),
                        Text(
                          'The table fills in as players join.',
                          style: CouponTheme.bodyText.copyWith(fontSize: 15, color: CouponTheme.inkFade),
                        ),
                      ],
                    ),
                  )
                else
                  LayoutBuilder(
                    builder: (context, constraints) =>
                        _buildTable(data, showPredicted: constraints.maxWidth >= 400),
                  ),
                if (data != null) ...[
                  const SizedBox(height: 20),
                  // The rules of the table, in words, so a tie never becomes an
                  // argument.
                  for (final line in [
                    if (data.rows.any((r) => r.provisional))
                      '* Includes the round still being played - it can still move.',
                    '$matchdayScoring. Nothing takes points away, so a total only goes up.',
                    'Level on points? More wins goes ahead, then more predictions made. Still '
                        'level means sharing the place.',
                    'Tap a name to see their predictions. Nobody\'s are shown until the round locks.',
                  ])
                    Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Text(
                        line,
                        style: CouponTheme.bodyText.copyWith(fontSize: 15, color: CouponTheme.inkFade),
                      ),
                    ),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildTable(MatchdayTable data, {required bool showPredicted}) {
    final rows = data.rows;
    final myIndex = rows.indexWhere((r) => r.isMe);
    final trimmed = !_showAll && rows.length >= _showAllUnder;
    final shown = <int>{};
    for (var i = 0; i < rows.length; i++) {
      if (!trimmed || i < _topRows) shown.add(i);
    }
    if (trimmed && myIndex >= _topRows) {
      for (var i = (myIndex - _neighbours).clamp(_topRows, rows.length - 1);
          i <= (myIndex + _neighbours).clamp(0, rows.length - 1);
          i++) {
        shown.add(i);
      }
    }

    final head = CouponTheme.label;
    Widget cell(Widget child, double width, {TextAlign align = TextAlign.right}) =>
        SizedBox(width: width, child: Align(alignment: align == TextAlign.right ? Alignment.centerRight : Alignment.centerLeft, child: child));

    final children = <Widget>[
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
        decoration: BoxDecoration(border: Border(bottom: CouponTheme.rule())),
        child: Row(
          children: [
            cell(Text('POS', style: head), 34),
            const SizedBox(width: 10),
            Expanded(child: Text('PLAYER', style: head)),
            cell(Text('W', style: head), 26),
            cell(Text('D', style: head), 26),
            cell(Text('L', style: head), 26),
            if (showPredicted) cell(Text('PREDICTED', style: head), 84),
            cell(Text('PTS', style: head), 52),
          ],
        ),
      ),
    ];

    for (var i = 0; i < rows.length; i++) {
      if (!shown.contains(i)) continue;
      final row = rows[i];
      // A row of dots where rows are skipped, so the jump from 20th to 47th
      // is visible.
      if (i > 0 && !shown.contains(i - 1)) {
        children.add(Container(
          padding: const EdgeInsets.symmetric(vertical: 4),
          decoration: BoxDecoration(border: Border(bottom: CouponTheme.rule())),
          child: Text('·  ·  ·',
              textAlign: TextAlign.center,
              style: CouponTheme.dataText.copyWith(color: CouponTheme.inkFade)),
        ));
      }
      final winner = data.isComplete && row.position == 1;
      final figure = CouponTheme.dataText;
      children.add(Material(
        color: winner ? CouponTheme.mossWash : Colors.transparent,
        child: InkWell(
          onTap: () => _openPlayer(row),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
            decoration: BoxDecoration(
              border: Border(bottom: i == rows.length - 1 ? BorderSide.none : CouponTheme.rule()),
            ),
            child: Row(
              children: [
                cell(Text('${row.position}', style: figure.copyWith(color: CouponTheme.inkFade)), 34),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // The name opens their predictions (§10).
                      Text(
                        row.displayName,
                        overflow: TextOverflow.ellipsis,
                        style: figure.copyWith(
                          fontSize: 16,
                          fontWeight: row.isMe ? FontWeight.bold : FontWeight.normal,
                          decoration: TextDecoration.underline,
                          decorationStyle: TextDecorationStyle.dotted,
                          decorationColor: CouponTheme.ink.withValues(alpha: 0.5),
                        ),
                      ),
                      if (row.isMe || winner)
                        Text(
                          [if (row.isMe) 'YOU', if (winner) 'WINNER'].join(' · '),
                          style: CouponTheme.label.copyWith(
                            fontSize: 10,
                            color: winner ? CouponTheme.ink : CouponTheme.inkFade,
                          ),
                        ),
                    ],
                  ),
                ),
                cell(Text('${row.wins}', style: figure), 26),
                cell(Text('${row.draws}', style: figure), 26),
                cell(Text('${row.losses}', style: figure), 26),
                if (showPredicted) cell(Text('${row.predictions}', style: figure), 84),
                cell(
                  Text.rich(TextSpan(children: [
                    TextSpan(text: '${row.total}', style: CouponTheme.heading(24)),
                    if (row.provisional)
                      TextSpan(
                        text: '*',
                        style: CouponTheme.heading(24).copyWith(color: CouponTheme.inkFade),
                      ),
                  ])),
                  52,
                ),
              ],
            ),
          ),
        ),
      ));
    }

    if (trimmed) {
      children.add(Container(
        decoration: BoxDecoration(border: Border(top: CouponTheme.rule())),
        child: Center(
          child: MatchdayTextLink(
            label: 'Show all ${rows.length} players',
            onTap: () => setState(() => _showAll = true),
          ),
        ),
      ));
    }

    return Container(decoration: matchdayPanel(), child: Column(children: children));
  }
}
