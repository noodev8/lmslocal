import 'package:equatable/equatable.dart';

/// Matchday, the second game (docs/matchday.md, docs/matchday-app.md).
///
/// These mirror the server's responses field for field, and each carries its
/// own `fromJson`: they are read-only views of what the server decided. The app
/// never adds points up to make a total, ranks a table or decides what may be
/// seen when - totals, positions and the tie-break come from
/// `services/matchdayTable.js` (docs/matchday-app.md §9).

int? _int(dynamic value) {
  if (value == null) return null;
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value.toString());
}

DateTime? _date(dynamic value) =>
    value == null ? null : DateTime.tryParse(value.toString());

/// The dashboard's per-competition Matchday block (`get-user-dashboard`).
class MatchdayStanding extends Equatable {
  final int players;

  /// Null when the user organises without playing.
  final int? position;
  final int? total;

  /// The total includes a round still being played.
  final bool provisional;

  /// Matches this user has predicted in the latest round.
  final int predicted;
  final int roundsSettled;
  final String? leaderName;
  final int? leaderTotal;

  /// Everyone in first place; more than one at the end is a shared win.
  final List<String> firstPlace;

  const MatchdayStanding({
    required this.players,
    this.position,
    this.total,
    this.provisional = false,
    this.predicted = 0,
    this.roundsSettled = 0,
    this.leaderName,
    this.leaderTotal,
    this.firstPlace = const [],
  });

  factory MatchdayStanding.fromJson(Map<String, dynamic> json) {
    final leader = json['leader'] as Map<String, dynamic>?;
    return MatchdayStanding(
      players: _int(json['players']) ?? 0,
      position: _int(json['position']),
      total: _int(json['total']),
      provisional: json['provisional'] == true,
      predicted: _int(json['predicted']) ?? 0,
      roundsSettled: _int(json['rounds_settled']) ?? 0,
      leaderName: leader?['display_name'] as String?,
      leaderTotal: _int(leader?['total']),
      firstPlace: ((json['first_place'] as List?) ?? const [])
          .map((e) => e.toString())
          .toList(),
    );
  }

  /// The same shape the server sends, so the cached dashboard re-reads through
  /// [MatchdayStanding.fromJson] (docs/matchday-app.md §15).
  Map<String, dynamic> toJson() => {
        'players': players,
        'position': position,
        'total': total,
        'provisional': provisional,
        'predicted': predicted,
        'rounds_settled': roundsSettled,
        'leader': leaderName == null
            ? null
            : {'display_name': leaderName, 'total': leaderTotal},
        'first_place': firstPlace,
      };

  @override
  List<Object?> get props => [
        players,
        position,
        total,
        provisional,
        predicted,
        roundsSettled,
        leaderName,
        leaderTotal,
        firstPlace,
      ];
}

/// One match on a player's coupon (`get-predictions`), or on everyone's
/// (`get-round-predictions`, where [myTeam] and [myPoints] are always null).
class MatchdayFixture {
  final int fixtureId;
  final String homeTeam;
  final String homeTeamShort;
  final String awayTeam;
  final String awayTeamShort;
  final DateTime kickoffTime;

  /// A team short code or 'DRAW'; null until the result is in.
  final String? result;
  final bool settled;

  /// Null means not predicted.
  final String? myTeam;

  /// 3, 1 or 0; null until settled.
  final int? myPoints;

  const MatchdayFixture({
    required this.fixtureId,
    required this.homeTeam,
    required this.homeTeamShort,
    required this.awayTeam,
    required this.awayTeamShort,
    required this.kickoffTime,
    this.result,
    this.settled = false,
    this.myTeam,
    this.myPoints,
  });

  factory MatchdayFixture.fromJson(Map<String, dynamic> json) => MatchdayFixture(
        fixtureId: _int(json['fixture_id'])!,
        homeTeam: json['home_team'] as String? ?? '',
        homeTeamShort: json['home_team_short'] as String? ?? '',
        awayTeam: json['away_team'] as String? ?? '',
        awayTeamShort: json['away_team_short'] as String? ?? '',
        kickoffTime: _date(json['kickoff_time']) ?? DateTime.now(),
        result: json['result'] as String?,
        settled: json['settled'] == true,
        myTeam: json['my_team'] as String?,
        myPoints: _int(json['my_points']),
      );

  /// This match with the player's prediction changed - after the server said
  /// yes, never before (docs/matchday-app.md §4).
  MatchdayFixture withMyTeam(String? team) => MatchdayFixture(
        fixtureId: fixtureId,
        homeTeam: homeTeam,
        homeTeamShort: homeTeamShort,
        awayTeam: awayTeam,
        awayTeamShort: awayTeamShort,
        kickoffTime: kickoffTime,
        result: result,
        settled: settled,
        myTeam: team,
        myPoints: myPoints,
      );

  /// The full name of the team with [shortCode], or null if neither side.
  String? teamName(String? shortCode) {
    if (shortCode == homeTeamShort) return homeTeam;
    if (shortCode == awayTeamShort) return awayTeam;
    return null;
  }

  /// "Nottm Forest won", "Draw", or null before the result.
  String? get resultText {
    if (result == null) return null;
    if (result == 'DRAW') return 'Draw';
    return '${teamName(result) ?? result} won';
  }
}

/// The round a coupon belongs to.
class MatchdayRound {
  final int roundNumber;
  final DateTime lockTime;
  final bool locked;

  /// This is the competition's latest round.
  final bool latest;

  const MatchdayRound({
    required this.roundNumber,
    required this.lockTime,
    required this.locked,
    required this.latest,
  });

  factory MatchdayRound.fromJson(Map<String, dynamic> json) => MatchdayRound(
        roundNumber: _int(json['round_number']) ?? 0,
        lockTime: _date(json['lock_time']) ?? DateTime.now(),
        locked: json['locked'] == true,
        latest: json['latest'] != false,
      );
}

/// A player's coupon for one round (`get-predictions`).
class MatchdayCoupon {
  final bool isPlayer;

  /// Null before the competition's first round exists - a normal state.
  final MatchdayRound? round;
  final List<MatchdayFixture> fixtures;
  final String status;
  final String? endRule;
  final int? endValue;

  const MatchdayCoupon({
    required this.isPlayer,
    required this.round,
    required this.fixtures,
    required this.status,
    this.endRule,
    this.endValue,
  });

  factory MatchdayCoupon.fromJson(Map<String, dynamic> json) {
    final competition = json['competition'] as Map<String, dynamic>? ?? const {};
    final round = json['round'] as Map<String, dynamic>?;
    return MatchdayCoupon(
      isPlayer: json['is_player'] == true,
      round: round == null ? null : MatchdayRound.fromJson(round),
      fixtures: ((json['fixtures'] as List?) ?? const [])
          .map((e) => MatchdayFixture.fromJson(e as Map<String, dynamic>))
          .toList(),
      status: (competition['status'] as String? ?? '').toUpperCase(),
      endRule: competition['end_rule'] as String?,
      endValue: _int(competition['end_value']),
    );
  }

  MatchdayCoupon withFixtures(List<MatchdayFixture> next) => MatchdayCoupon(
        isPlayer: isPlayer,
        round: round,
        fixtures: next,
        status: status,
        endRule: endRule,
        endValue: endValue,
      );

  int get predicted => fixtures.where((f) => f.myTeam != null).length;
  int get totalFixtures => fixtures.length;
  int get settledCount => fixtures.where((f) => f.settled).length;

  /// This round's score so far: the sum of points the server has already
  /// given each settled match. A round score, never a total - totals come
  /// from the server.
  int get roundPoints =>
      fixtures.fold(0, (sum, f) => sum + (f.myPoints ?? 0));

  bool get isComplete => status == 'COMPLETE';
}

/// One row of the table (`get-matchday-table`).
class MatchdayTableRow {
  final int position;
  final int userId;
  final String displayName;
  final int total;
  final int wins;
  final int draws;
  final int losses;
  final int predictions;
  final bool provisional;
  final bool isMe;

  const MatchdayTableRow({
    required this.position,
    required this.userId,
    required this.displayName,
    required this.total,
    required this.wins,
    required this.draws,
    required this.losses,
    required this.predictions,
    required this.provisional,
    required this.isMe,
  });

  factory MatchdayTableRow.fromJson(Map<String, dynamic> json) =>
      MatchdayTableRow(
        position: _int(json['position']) ?? 0,
        userId: _int(json['user_id']) ?? 0,
        displayName: json['display_name'] as String? ?? '',
        total: _int(json['total']) ?? 0,
        wins: _int(json['wins']) ?? 0,
        draws: _int(json['draws']) ?? 0,
        losses: _int(json['losses']) ?? 0,
        predictions: _int(json['predictions']) ?? 0,
        provisional: json['provisional'] == true,
        isMe: json['is_me'] == true,
      );
}

/// The league table (`get-matchday-table`). Already ranked, ties already
/// shared: shown as given.
class MatchdayTable {
  final String status;
  final String? endRule;
  final int? endValue;
  final int? winnerId;
  final int roundsSettled;
  final int? latestRoundNumber;
  final List<MatchdayTableRow> rows;

  const MatchdayTable({
    required this.status,
    this.endRule,
    this.endValue,
    this.winnerId,
    required this.roundsSettled,
    this.latestRoundNumber,
    required this.rows,
  });

  factory MatchdayTable.fromJson(Map<String, dynamic> json) {
    final competition = json['competition'] as Map<String, dynamic>? ?? const {};
    return MatchdayTable(
      status: (competition['status'] as String? ?? '').toUpperCase(),
      endRule: competition['end_rule'] as String?,
      endValue: _int(competition['end_value']),
      winnerId: _int(competition['winner_id']),
      roundsSettled: _int(json['rounds_settled']) ?? 0,
      latestRoundNumber: _int(json['latest_round_number']),
      rows: ((json['table'] as List?) ?? const [])
          .map((e) => MatchdayTableRow.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }

  bool get isComplete => status == 'COMPLETE';

  MatchdayTableRow? get me {
    for (final row in rows) {
      if (row.isMe) return row;
    }
    return null;
  }

  MatchdayTableRow? rowFor(int userId) {
    for (final row in rows) {
      if (row.userId == userId) return row;
    }
    return null;
  }

  List<MatchdayTableRow> get firstPlace =>
      rows.where((row) => row.position == 1).toList();
}

/// A member of the competition, as everyone's predictions list them.
class MatchdayPlayer {
  final int userId;
  final String displayName;
  final bool isMe;

  const MatchdayPlayer({
    required this.userId,
    required this.displayName,
    required this.isMe,
  });
}

/// One player's prediction on one match, from everyone's.
class MatchdayPrediction {
  final int userId;
  final int fixtureId;
  final String team;

  /// Null until the match is settled.
  final int? points;

  const MatchdayPrediction({
    required this.userId,
    required this.fixtureId,
    required this.team,
    this.points,
  });
}

/// Everyone's predictions for one LOCKED round (`get-round-predictions`,
/// docs/matchday.md §8.6). [roundNumber] is null while no round has locked.
class MatchdayRoundPredictions {
  final int? roundNumber;
  final int? latestLockedRoundNumber;
  final List<MatchdayFixture> fixtures;

  /// Every member, predicted or not, by name.
  final List<MatchdayPlayer> players;
  final List<MatchdayPrediction> predictions;

  const MatchdayRoundPredictions({
    this.roundNumber,
    this.latestLockedRoundNumber,
    required this.fixtures,
    required this.players,
    required this.predictions,
  });

  factory MatchdayRoundPredictions.fromJson(Map<String, dynamic> json) {
    final round = json['round'] as Map<String, dynamic>?;
    return MatchdayRoundPredictions(
      roundNumber: _int(round?['round_number']),
      latestLockedRoundNumber: _int(round?['latest_locked_round_number']),
      fixtures: ((json['fixtures'] as List?) ?? const [])
          .map((e) => MatchdayFixture.fromJson(e as Map<String, dynamic>))
          .toList(),
      players: ((json['players'] as List?) ?? const []).map((e) {
        final p = e as Map<String, dynamic>;
        return MatchdayPlayer(
          userId: _int(p['user_id']) ?? 0,
          displayName: p['display_name'] as String? ?? '',
          isMe: p['is_me'] == true,
        );
      }).toList(),
      predictions: ((json['predictions'] as List?) ?? const []).map((e) {
        final p = e as Map<String, dynamic>;
        return MatchdayPrediction(
          userId: _int(p['user_id']) ?? 0,
          fixtureId: _int(p['fixture_id']) ?? 0,
          team: p['team'] as String? ?? '',
          points: _int(p['points']),
        );
      }).toList(),
    );
  }
}
