import 'package:firebase_messaging/firebase_messaging.dart';

/// Turns a push notification into the screen its tap should open.
///
/// The mapping lives in the app rather than the server, and the server sends facts
/// (`type`, `competition_id`) rather than a route. That split is deliberate: a route
/// chosen server-side would be a route chosen for app versions that do not exist yet, and
/// the ones already on people's phones cannot be corrected. Sending facts lets an old app
/// do the best it can with a notification type it has never heard of, which is the [_default]
/// case below.
///
/// Kept as pure functions over [RemoteMessage.data] so the routing decision can be reasoned
/// about — and changed — without a device, which matters because the path that produces
/// these messages is close to untestable outside a real signed build on a real phone.
String? routeForNotification(RemoteMessage message) {
  final data = message.data;

  final competitionId = data['competition_id'];
  if (competitionId == null || competitionId.isEmpty) {
    // Nothing to open. Better to leave the player wherever they were than to bounce them
    // to a dashboard they did not ask for — the app was already open behind the tap.
    return null;
  }

  switch (data['type']) {
    // "Don't forget to make your pick before it locks" — the pick screen is the whole
    // point of the message, so the tap has to land on it and not one tap short.
    case 'pick_reminder':
      return '/competition/$competitionId?tab=play';

    // "Results are in - see how you did!" — the competition's own summary, where the
    // result and their status are. They may well pick next, but that is their decision.
    case 'new_round':
      return '/competition/$competitionId';

    default:
      return _default(competitionId);
  }
}

/// A type this build does not recognise, sent by a server newer than the app. The
/// competition is still the right place to land: it is where every current notification
/// points, and it is where a player who has just been told something about a competition
/// expects to end up.
String _default(String competitionId) => '/competition/$competitionId';
