import 'package:flutter/material.dart';
import 'package:lmslocal_flutter/core/theme/coupon_theme.dart';
import 'package:url_launcher/url_launcher.dart';

/// Shown when the installed build is below the server's minimum version.
///
/// There is no dismiss and no back button. The build this covers is one the
/// server can no longer talk to, so letting the user past would only put them
/// in front of an error instead of an instruction.
class UpdateRequiredDialog extends StatelessWidget {
  final String storeUrl;

  const UpdateRequiredDialog({super.key, required this.storeUrl});

  Future<void> _openStore() async {
    final uri = Uri.parse(storeUrl);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      child: AlertDialog(
        title: Text('UPDATE REQUIRED', style: CouponTheme.heading(28)),
        content: const Text(
          'This version of LMS Local is out of date and can no longer be '
          'used. Install the latest version to carry on.',
          style: CouponTheme.bodyText,
        ),
        actions: [
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _openStore,
              child: const Text('UPDATE'),
            ),
          ),
        ],
      ),
    );
  }
}
