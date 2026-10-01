import Foundation
import UIKit
import UserNotifications

final class KaretaAppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [
            UIApplication.LaunchOptionsKey: Any
        ]? = nil
    ) -> Bool {
        true
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        PushNotificationService.shared.updateToken(deviceToken)
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        PushNotificationService.shared.updateRegistrationError(error)
    }
}

final class PushNotificationService {
    static let shared = PushNotificationService()

    private let tokenKey = "kareta.ios.apns.token"
    private let lock = NSLock()
    private var lastError: String?

    private init() {}

    func snapshot() -> [String: Any] {
        lock.lock()
        defer { lock.unlock() }

        let token = UserDefaults.standard.string(forKey: tokenKey) ?? ""
        return [
            "platform": "ios",
            "token": token,
            "available": !token.isEmpty,
            "registered": UIApplication.shared.isRegisteredForRemoteNotifications,
            "error": lastError ?? ""
        ]
    }

    func register(
        completion: @escaping (Result<[String: Any], Error>) -> Void
    ) {
        let center = UNUserNotificationCenter.current()
        center.getNotificationSettings { settings in
            switch settings.authorizationStatus {
            case .notDetermined:
                center.requestAuthorization(
                    options: [.alert, .badge, .sound]
                ) { granted, error in
                    if let error {
                        self.updateRegistrationError(error)
                        return
                    }
                    guard granted else { return }
                    DispatchQueue.main.async {
                        UIApplication.shared.registerForRemoteNotifications()
                    }
                }

                completion(.success([
                    "platform": "ios",
                    "authorizationPending": true,
                    "registrationRequested": true
                ]))

            case .authorized, .provisional, .ephemeral:
                DispatchQueue.main.async {
                    UIApplication.shared.registerForRemoteNotifications()
                    completion(.success([
                        "platform": "ios",
                        "authorizationGranted": true,
                        "authorizationPending": false,
                        "registrationRequested": true,
                        "registered": UIApplication.shared.isRegisteredForRemoteNotifications
                    ]))
                }

            case .denied:
                completion(.success([
                    "platform": "ios",
                    "authorizationGranted": false,
                    "authorizationPending": false,
                    "registrationRequested": false,
                    "status": "denied"
                ]))

            @unknown default:
                completion(.success([
                    "platform": "ios",
                    "authorizationGranted": false,
                    "authorizationPending": false,
                    "registrationRequested": false,
                    "status": "unknown"
                ]))
            }
        }
    }

    func unregister() -> [String: Any] {
        DispatchQueue.main.async {
            UIApplication.shared.unregisterForRemoteNotifications()
        }

        lock.lock()
        lastError = nil
        UserDefaults.standard.removeObject(forKey: tokenKey)
        lock.unlock()

        return [
            "platform": "ios",
            "unregistered": true
        ]
    }

    func updateToken(_ data: Data) {
        let token = data.map {
            String(format: "%02x", $0)
        }.joined()

        lock.lock()
        UserDefaults.standard.set(token, forKey: tokenKey)
        lastError = nil
        lock.unlock()

        NotificationCenter.default.post(
            name: .karetaPushTokenUpdated,
            object: nil,
            userInfo: ["token": token]
        )
    }

    func updateRegistrationError(_ error: Error) {
        lock.lock()
        lastError = error.localizedDescription
        lock.unlock()

        NotificationCenter.default.post(
            name: .karetaPushRegistrationFailed,
            object: nil,
            userInfo: ["message": error.localizedDescription]
        )
    }
}

extension Notification.Name {
    static let karetaPushTokenUpdated = Notification.Name(
        "kareta.ios.push.token.updated"
    )
    static let karetaPushRegistrationFailed = Notification.Name(
        "kareta.ios.push.registration.failed"
    )
}
