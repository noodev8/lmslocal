import 'package:flutter_test/flutter_test.dart';
import 'package:lmslocal_flutter/core/game/invite.dart';

/// The invitation is the one piece of text this app puts into someone else's
/// inbox, and it is assembled from optional parts — a missing prize or a
/// competition with no round yet must not leave a dangling label or a blank
/// gap. Checked here because the share sheet shows only the first line.
void main() {
  group('buildInviteMessage', () {
    test('carries the name, the link, the money and the deadline', () {
      final message = buildInviteMessage(
        competitionName: 'The Red Barn',
        joinUrl: 'https://www.lmslocal.co.uk/join/98919',
        lockTime: DateTime(2026, 8, 21, 20),
        entryFee: 5,
        prizeStructure: 'Winner takes all',
      );

      expect(message, contains('The Red Barn — Last Man Standing'));
      expect(message, contains('https://www.lmslocal.co.uk/join/98919'));
      expect(message, contains('Entry: £5.00'));
      expect(message, contains('Prizes: Winner takes all'));
      expect(message, contains('First round locks Friday 21 August, 8pm.'));
    });

    test('says nothing about a free entry', () {
      final message = buildInviteMessage(
        competitionName: 'The Red Barn',
        joinUrl: 'https://www.lmslocal.co.uk/join/98919',
        entryFee: 0,
      );

      expect(message, isNot(contains('Entry')));
      expect(message, isNot(contains('£')));
    });

    test('drops the deadline rather than promising something vague', () {
      final message = buildInviteMessage(
        competitionName: 'The Red Barn',
        joinUrl: 'https://www.lmslocal.co.uk/join/98919',
      );

      expect(message, isNot(contains('First round locks')));
      // And no trailing blank left where the omitted lines were.
      expect(message, message.trim());
      expect(message, isNot(contains('\n\n\n')));
    });
  });
}
