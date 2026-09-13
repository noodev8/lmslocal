import Flutter
import StoreKit
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate {
  /// Must match the channel name in lib/core/services/review_prompt.dart.
  private static let reviewChannel = "uk.co.lmslocal/review"

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    GeneratedPluginRegistrant.register(with: self)

    // The store review prompt. Dart decides *whether* to ask — the rules are in
    // `ReviewPrompt` — this only performs the asking.
    //
    // Hand-wired rather than via the `in_app_review` package, which does not build
    // under this project's Android setup; see the note in that Dart file.
    //
    // Nothing is reported back, because iOS tells us nothing: the system decides
    // whether the prompt actually appears (three per user per year, and the user can
    // switch it off in Settings entirely), and either way the call returns the same.
    if let controller = window?.rootViewController as? FlutterViewController {
      FlutterMethodChannel(
        name: AppDelegate.reviewChannel,
        binaryMessenger: controller.binaryMessenger
      ).setMethodCallHandler { call, result in
        guard call.method == "requestReview" else {
          result(FlutterMethodNotImplemented)
          return
        }
        AppDelegate.requestReview()
        result(nil)
      }
    }

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  private static func requestReview() {
    guard let scene = UIApplication.shared.connectedScenes
      .first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene
    else { return }

    // SKStoreReviewController is deprecated from iOS 18 but is the only route below
    // 16, which the 15.0 deployment target still supports.
    if #available(iOS 16.0, *) {
      AppStore.requestReview(in: scene)
    } else {
      SKStoreReviewController.requestReview(in: scene)
    }
  }
}
