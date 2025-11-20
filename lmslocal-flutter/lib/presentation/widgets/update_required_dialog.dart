import 'package:flutter/material.dart';
import 'package:lmslocal_flutter/core/constants/app_constants.dart';
import 'package:url_launcher/url_launcher.dart';

/// Blocking dialog shown when app update is required
/// User cannot dismiss - must update to continue
class UpdateRequiredDialog extends StatelessWidget {
  final String minimumVersion;
  final String storeUrl;

  const UpdateRequiredDialog({
    super.key,
    required this.minimumVersion,
    required this.storeUrl,
  });

  Future<void> _openStore() async {
    final uri = Uri.parse(storeUrl);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      // Prevent back button from dismissing dialog
      canPop: false,
      child: AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.system_update, color: AppConstants.primaryNavy),
            SizedBox(width: 12),
            Text('Update Required'),
          ],
        ),
        content: const Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'A new version is available, please update.',
              style: TextStyle(fontSize: 16),
            ),
          ],
        ),
        actions: [
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _openStore,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppConstants.primaryNavy,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              child: const Text(
                'Update Now',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
