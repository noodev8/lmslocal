import 'package:material_ui/material_ui.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:lmslocal_flutter/core/theme/coupon_theme.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/api_client.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/dashboard_remote_data_source.dart';
import 'package:lmslocal_flutter/domain/entities/competition.dart';
import 'package:lmslocal_flutter/presentation/pages/competition/competition_navigation_page.dart';
import 'package:lmslocal_flutter/presentation/pages/matchday/matchday_navigation_page.dart';

/// The door into a competition: `/competition/:id` and the `/game/:id` deep
/// link both arrive here, and this decides - once - which game's screens open
/// (docs/matchday.md §3.2, docs/matchday-app.md §3). Below it each shell runs
/// code written for its own game only; the LMS screens are unchanged.
///
/// From the dashboard the competition arrives with the navigation, so the
/// choice is immediate. A deep link carries only the id, so the game is looked
/// up in the dashboard - the cached copy first, then a fresh one, since a
/// cache written before this build knew Matchday would not list a Matchday
/// competition at all. Anything not found there opens the LMS shell, exactly
/// as before this page existed.
class CompetitionEntryPage extends StatefulWidget {
  const CompetitionEntryPage({
    super.key,
    required this.competitionId,
    this.competition,
    this.initialTab = 0,
  });

  final String competitionId;
  final Object? competition;
  final int initialTab;

  @override
  State<CompetitionEntryPage> createState() => _CompetitionEntryPageState();
}

class _CompetitionEntryPageState extends State<CompetitionEntryPage> {
  Competition? _competition;
  bool _resolved = false;

  @override
  void initState() {
    super.initState();
    if (widget.competition is Competition) {
      _competition = widget.competition as Competition;
      _resolved = true;
    } else {
      _lookUp();
    }
  }

  Future<void> _lookUp() async {
    Competition? found;
    try {
      final apiClient = context.read<ApiClient>();
      final dataSource = DashboardRemoteDataSource(
        apiClient: apiClient,
        prefs: await SharedPreferences.getInstance(),
      );
      found = _find((await dataSource.getUserDashboard()).competitions);
      found ??= _find((await dataSource.getUserDashboard(forceRefresh: true)).competitions);
    } catch (_) {
      // Unreachable or signed out: the LMS shell has its own failure handling.
    }
    if (!mounted) return;
    setState(() {
      _competition = found;
      _resolved = true;
    });
  }

  Competition? _find(List<Competition> competitions) {
    for (final c in competitions) {
      if (c.id.toString() == widget.competitionId) return c;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    if (!_resolved) {
      return const Scaffold(
        backgroundColor: CouponTheme.stock,
        body: Center(
          child: SizedBox(width: 28, height: 28, child: CircularProgressIndicator(strokeWidth: 2)),
        ),
      );
    }
    final competition = _competition;
    if (competition != null && competition.isMatchday) {
      return MatchdayNavigationPage(competition: competition, initialTab: widget.initialTab);
    }
    return CompetitionNavigationPage(
      competitionId: widget.competitionId,
      competition: widget.competition,
      initialTab: widget.initialTab,
    );
  }
}
