/// A route the app was asked to open before it was able to.
///
/// Two things ask: a `lmslocal.co.uk/join/<code>` link, and a tapped push notification.
/// Both can arrive when there is no signed-in user to open them for — a cold start whose
/// auth check has not finished, an expired session bouncing to `/login`, or someone who
/// signed out. On the web the target survives in the URL; the app has no URL to come back
/// to, so without somewhere to put it the request is simply lost. §8 of
/// docs/player-onboarding.md calls that the worst kind of drop-off for a join link, and a
/// notification is no better: the player did what they were asked and landed nowhere.
///
/// Deliberately in memory only. This is worth surviving a sign-in, not an app restart. A
/// destination persisted to disk would reopen days later over whatever the player actually
/// opened the app to do.
class PendingDestination {
  static String? _route;

  /// Remember a route to open once there is a session to open it with.
  ///
  /// Last one wins: if two notifications are tapped before sign-in completes, the player
  /// most recently expressed interest in the second.
  static void remember(String route) {
    _route = route;
  }

  /// Read and clear. Always taken rather than peeked, so a route can only ever fire once —
  /// otherwise a competition the player looked at and left would ambush them on every
  /// future sign-in.
  static String? take() {
    final route = _route;
    _route = null;
    return route;
  }
}
