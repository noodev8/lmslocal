import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';

import 'package:lmslocal_flutter/core/game/invite.dart';
import 'package:lmslocal_flutter/core/game/round_state.dart';
import 'package:lmslocal_flutter/core/theme/coupon_theme.dart';
import 'package:lmslocal_flutter/domain/entities/competition.dart';

/// The link that gets people into the competition, on the screen an organiser
/// is already looking at.
///
/// It was on the website only, behind Promote, and organisers running their
/// competition from the phone could not find it — which is the whole failure:
/// the invitation is not a desk job. It is handed out standing in the pub, so
/// it belongs on the phone, and **Share** opens the OS sheet rather than
/// copying to a clipboard the player then has to find a home for. WhatsApp is
/// where these actually go, and that is one tap from here.
///
/// **Shown to players, not just organisers.** A player bringing their own mates
/// in is good for the competition, and the dashboard card has always shown them
/// the code anyway — hiding it here while showing it there was drift, not a
/// rule. An organiser who does not want someone can remove them. When that
/// becomes a setting the organiser chooses, this is where the gate goes.
///
/// Only while joining is open. The code outlives the competition, so an
/// invitation sent after round 1 locks leads someone to a door that will not
/// open — see [joiningOpen].
///
/// The deliberately smaller half of the web's `/promote`: the templates, the
/// generated images and the printable leaflet stay there. Two of those are
/// rendered by Next.js routes this app cannot call, and all three are desk
/// work. This is the part you need in your hand.
class InviteBlock extends StatelessWidget {
  const InviteBlock({super.key, required this.competition});

  final Competition competition;

  @override
  Widget build(BuildContext context) {
    final code = competition.inviteCode;
    if (code == null || code.isEmpty) return const SizedBox.shrink();

    final joinUrl = buildJoinUrl(code);
    final lockTime = competition.currentRoundLockTime;

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: CouponTheme.stockLit,
        border: Border.fromBorderSide(CouponTheme.rule()),
      ),
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            competition.isOrganiser ? 'INVITE PLAYERS' : 'INVITE A FRIEND',
            style: CouponTheme.label,
          ),
          const SizedBox(height: 8),

          // The deadline said out loud, on the screen where recruiting happens.
          // Everyone has to start together, so joining shuts when round 1 locks
          // — an organiser who does not know that finds out by having someone
          // turned away.
          Text(
            lockTime != null
                ? 'Joining closes ${formatLong(lockTime)}, when round 1 locks.'
                : 'Anyone with the link can join until round 1 locks.',
            style: CouponTheme.bodyText.copyWith(color: CouponTheme.inkFade),
          ),
          const SizedBox(height: 14),

          // The link itself, in font-data: it is a value, and seeing it is what
          // tells an organiser the button is going to send the right thing.
          //
          // 13 rather than the default 15 so it holds one line on a 411dp phone
          // — at 14 a five-digit code goes over by a few pixels and the URL
          // breaks after the slash, which reads as two links rather than one.
          Text(
            joinUrl,
            style: CouponTheme.dataText.copyWith(fontSize: 13),
          ),
          const SizedBox(height: 14),

          Row(
            children: [
              Expanded(
                child: ElevatedButton(
                  onPressed: () => _share(context, joinUrl),
                  child: const Text('SHARE'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton(
                  onPressed: () => _copy(context, joinUrl, 'Join link copied'),
                  // "COPY", not "COPY LINK": the pair splits the row in half and
                  // the longer label wrapped to two lines, leaving one button
                  // taller than the other. The link is set directly above the
                  // row, so there is nothing else this could be copying.
                  child: const Text('COPY'),
                ),
              ),
            ],
          ),

          const SizedBox(height: 14),
          // The code is the fallback for someone being told over a bar, not the
          // main route — the link carries the code already, so leading with
          // both would offer a choice nobody needs.
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => _copy(context, code, 'Invite code copied'),
            child: Row(
              children: [
                Expanded(
                  child: Text.rich(
                    TextSpan(
                      style: CouponTheme.bodyText.copyWith(
                        fontSize: 14,
                        color: CouponTheme.inkFade,
                      ),
                      children: [
                        const TextSpan(text: 'Or give them the code '),
                        TextSpan(
                          text: code,
                          style: CouponTheme.dataText.copyWith(
                            fontSize: 15,
                            color: CouponTheme.ink,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                Icon(
                  Icons.copy,
                  size: 16,
                  color: CouponTheme.inkFade,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// The OS share sheet, carrying the full invitation rather than a bare link.
  ///
  /// `sharePositionOrigin` is required on iPad, where the sheet is a popover
  /// that has to be anchored to something — without it the share throws there
  /// and works everywhere else, which is exactly the bug that ships.
  Future<void> _share(BuildContext context, String joinUrl) async {
    final box = context.findRenderObject() as RenderBox?;
    final message = buildInviteMessage(
      competitionName: competition.name,
      joinUrl: joinUrl,
      lockTime: competition.currentRoundLockTime,
      entryFee: competition.entryFee,
      prizeStructure: competition.prizeStructure,
    );

    await SharePlus.instance.share(
      ShareParams(
        text: message,
        subject: '${competition.name} — Last Man Standing',
        sharePositionOrigin: box == null
            ? null
            : box.localToGlobal(Offset.zero) & box.size,
      ),
    );
  }

  Future<void> _copy(
    BuildContext context,
    String value,
    String confirmation,
  ) async {
    final messenger = ScaffoldMessenger.of(context);
    await Clipboard.setData(ClipboardData(text: value));
    messenger.showSnackBar(
      SnackBar(
        content: Text(confirmation),
        duration: const Duration(seconds: 2),
      ),
    );
  }
}
