import Foundation
import Network
import UIKit
import WebKit

final class NativeBridge: NSObject, WKScriptMessageHandler {
    static let handlerName = "KaretaNative"

    static let bootstrapScript = """
    (function () {
      window.KaretaNative = window.KaretaNative || {};
      window.KaretaNative.postMessage = function (message) {
        window.webkit.messageHandlers.KaretaNative.postMessage(message);
      };
    })();
    """

    weak var webView: WKWebView?

    private let network = NetworkState.shared
    private let locationService = NativeLocationService()
    private let mediaService = NativeMediaService()
    private let offlineQueue = OfflineQueueStore.shared

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard message.name == Self.handlerName else { return }

        do {
            let envelope = try decodeEnvelope(message.body)
            handle(
                id: envelope.id,
                command: envelope.command,
                payload: envelope.payload
            )
        } catch {
            send(
                id: "",
                ok: false,
                data: nil,
                error: "KARETA_NATIVE_BAD_MESSAGE",
                message: error.localizedDescription
            )
        }
    }

    private struct Envelope {
        let id: String
        let command: String
        let payload: [String: Any]
    }

    private func decodeEnvelope(_ body: Any) throws -> Envelope {
        let object: Any

        if let text = body as? String {
            guard let data = text.data(using: .utf8) else {
                throw BridgeError.invalidMessage
            }
            object = try JSONSerialization.jsonObject(with: data)
        } else {
            object = body
        }

        guard
            let dictionary = object as? [String: Any],
            let id = dictionary["id"] as? String,
            !id.isEmpty,
            let command = dictionary["command"] as? String,
            !command.isEmpty
        else {
            throw BridgeError.invalidMessage
        }

        return Envelope(
            id: id,
            command: command,
            payload: dictionary["payload"] as? [String: Any] ?? [:]
        )
    }

    private func handle(id: String, command: String, payload: [String: Any]) {
        switch command {
        case "ping":
            send(id: id, data: [
                "pong": true,
                "platform": "ios"
            ])

        case "appInfo":
            let bundle = Bundle.main
            send(id: id, data: [
                "platform": "ios",
                "version": bundle.object(
                    forInfoDictionaryKey: "CFBundleShortVersionString"
                ) as? String ?? "0",
                "build": bundle.object(
                    forInfoDictionaryKey: "CFBundleVersion"
                ) as? String ?? "0",
                "nativeBridge": 2
            ])

        case "network":
            send(id: id, data: [
                "online": network.isOnline,
                "source": "NWPathMonitor"
            ])

        case "logout":
            performLogout(id: id)

        case "requestPermission":
            handlePermission(id: id, payload: payload)

        case "pickImage":
            mediaService.pickImage { [weak self] result in
                self?.complete(id: id, result: result)
            }

        case "takePhoto":
            NativePermissionService.requestCamera { [weak self] permission in
                guard let self else { return }
                guard permission["granted"] as? Bool == true else {
                    return self.fail(
                        id,
                        "KARETA_NATIVE_PERMISSION_DENIED",
                        "Camera permission is required"
                    )
                }
                self.mediaService.takePhoto { [weak self] result in
                    self?.complete(id: id, result: result)
                }
            }

        case "getLocation":
            locationService.currentLocation { [weak self] result in
                self?.complete(id: id, result: result)
            }

        case "offlineState":
            send(id: id, data: offlineQueue.state())

        case "offlineEnqueue":
            guard let itemPayload = payload["payload"] as? [String: Any] else {
                return fail(
                    id,
                    "KARETA_NATIVE_BAD_PAYLOAD",
                    "payload is required"
                )
            }
            do {
                send(id: id, data: try offlineQueue.enqueue(payload: itemPayload))
            } catch {
                fail(id, "KARETA_NATIVE_OFFLINE_WRITE_FAILED", error.localizedDescription)
            }

        case "offlineDrain":
            send(id: id, data: offlineQueue.drain())

        case "offlineAcknowledge":
            do {
                let items = payload["items"] as? [Any] ?? []
                send(id: id, data: try offlineQueue.acknowledge(items))
            } catch {
                fail(id, "KARETA_NATIVE_OFFLINE_ACK_FAILED", error.localizedDescription)
            }

        case "offlineRestore":
            do {
                let items = payload["items"] as? [Any] ?? []
                send(id: id, data: try offlineQueue.restore(items))
            } catch {
                fail(id, "KARETA_NATIVE_OFFLINE_RESTORE_FAILED", error.localizedDescription)
            }

        case "offlineClear":
            do {
                send(id: id, data: try offlineQueue.clear())
            } catch {
                fail(id, "KARETA_NATIVE_OFFLINE_CLEAR_FAILED", error.localizedDescription)
            }

        case "copy":
            guard let text = payload["text"] as? String else {
                return fail(
                    id,
                    "KARETA_NATIVE_BAD_PAYLOAD",
                    "text is required"
                )
            }
            DispatchQueue.main.async {
                UIPasteboard.general.string = text
                self.send(id: id, data: ["copied": true])
            }

        case "share":
            guard let text = payload["text"] as? String else {
                return fail(
                    id,
                    "KARETA_NATIVE_BAD_PAYLOAD",
                    "text is required"
                )
            }
            DispatchQueue.main.async {
                guard let presenter = KaretaPresentation.topViewController() else {
                    return self.fail(
                        id,
                        "KARETA_NATIVE_UI_UNAVAILABLE",
                        "Unable to present share sheet"
                    )
                }
                let controller = UIActivityViewController(
                    activityItems: [text],
                    applicationActivities: nil
                )
                presenter.present(controller, animated: true)
                self.send(id: id, data: ["presented": true])
            }

        case "openExternal":
            guard
                let raw = payload["url"] as? String,
                let url = URL(string: raw),
                ["http", "https"].contains(url.scheme?.lowercased() ?? "")
            else {
                return fail(
                    id,
                    "KARETA_NATIVE_BAD_URL",
                    "Only http/https URLs are allowed"
                )
            }
            open(url, id: id)

        case "openPhone":
            guard let phone = payload["phone"] as? String else {
                return fail(
                    id,
                    "KARETA_NATIVE_BAD_PAYLOAD",
                    "phone is required"
                )
            }

            let allowed = CharacterSet(charactersIn: "+0123456789*#")
            let cleaned = phone.unicodeScalars
                .filter { allowed.contains($0) }
                .map(String.init)
                .joined()

            guard
                !cleaned.isEmpty,
                let url = URL(string: "tel:\(cleaned)")
            else {
                return fail(
                    id,
                    "KARETA_NATIVE_BAD_URL",
                    "Invalid phone number"
                )
            }
            open(url, id: id)

        case "openMap":
            var components = URLComponents(string: "https://maps.apple.com/")!
            var items: [URLQueryItem] = []

            if let query = payload["query"] as? String, !query.isEmpty {
                items.append(URLQueryItem(name: "q", value: query))
            }

            if
                let lat = number(payload["lat"]),
                let lng = number(payload["lng"])
            {
                items.append(
                    URLQueryItem(name: "ll", value: "\(lat),\(lng)")
                )
            }

            components.queryItems = items.isEmpty ? nil : items
            guard let url = components.url else {
                return fail(
                    id,
                    "KARETA_NATIVE_BAD_URL",
                    "Unable to build map URL"
                )
            }
            open(url, id: id)

        case "openSettings":
            guard let url = URL(string: UIApplication.openSettingsURLString) else {
                return fail(
                    id,
                    "KARETA_NATIVE_BAD_URL",
                    "Unable to open app settings"
                )
            }
            open(url, id: id)

        case "openBluetoothSettings":
            // iOS does not expose a public deep link to the system Bluetooth pane.
            // Opening the app settings is the safe supported fallback.
            guard let url = URL(string: UIApplication.openSettingsURLString) else {
                return fail(
                    id,
                    "KARETA_NATIVE_BAD_URL",
                    "Unable to open app settings"
                )
            }
            open(url, id: id)

        case "vibrate":
            DispatchQueue.main.async {
                let generator = UIImpactFeedbackGenerator(style: .medium)
                generator.prepare()
                generator.impactOccurred()
                self.send(id: id, data: ["performed": true])
            }

        case "reload":
            DispatchQueue.main.async {
                self.webView?.reload()
                self.send(id: id, data: ["reloading": true])
            }

        case "openRoute":
            guard
                let path = payload["path"] as? String,
                !path.isEmpty
            else {
                return fail(
                    id,
                    "KARETA_NATIVE_BAD_PAYLOAD",
                    "path is required"
                )
            }
            evaluate(
                "window.location.hash = " + jsString(path) + ";",
                id: id,
                response: ["opened": path]
            )

        case "elmStatus":
            send(id: id, data: [
                "platform": "ios",
                "supported": false,
                "permission": false,
                "enabled": false,
                "connected": false,
                "ready": false,
                "lastError": "IOS_ELM_TRANSPORT_NOT_CONFIGURED"
            ])

        default:
            fail(
                id,
                "KARETA_NATIVE_NOT_IMPLEMENTED",
                "Command \(command) is not implemented on iOS yet"
            )
        }
    }

    private func handlePermission(
        id: String,
        payload: [String: Any]
    ) {
        let permission = (payload["permission"] as? String ?? "")
            .lowercased()

        switch permission {
        case "location":
            locationService.requestPermission { [weak self] result in
                self?.send(id: id, data: result)
            }

        case "camera":
            NativePermissionService.requestCamera { [weak self] result in
                self?.send(id: id, data: result)
            }

        case "photos", "photo":
            // PHPicker gives user-scoped image access without requesting the
            // full photo library permission.
            send(id: id, data: [
                "permission": "photos",
                "granted": true,
                "status": "system_picker"
            ])

        case "bluetooth":
            send(id: id, data: [
                "permission": "bluetooth",
                "granted": false,
                "supported": false,
                "status": "transport_not_configured"
            ])

        default:
            fail(
                id,
                "KARETA_NATIVE_NOT_IMPLEMENTED",
                "Permission bridge is not implemented for \(permission)"
            )
        }
    }

    private func performLogout(id: String) {
        guard let webView else {
            return fail(
                id,
                "KARETA_NATIVE_WEBVIEW_UNAVAILABLE",
                "WKWebView is unavailable"
            )
        }

        let cookieStore = webView.configuration.websiteDataStore.httpCookieStore
        cookieStore.getAllCookies { [weak self, weak webView] cookies in
            guard let self, let webView else { return }

            guard let endpoint = URL(
                string: "https://kareta.kz/api/auth_session.php"
            ) else {
                return self.fail(
                    id,
                    "KARETA_NATIVE_LOGOUT_FAILED",
                    "Invalid logout endpoint"
                )
            }

            var request = URLRequest(url: endpoint)
            request.httpMethod = "POST"
            request.timeoutInterval = 20
            request.setValue(
                "application/json",
                forHTTPHeaderField: "Content-Type"
            )
            request.setValue(
                "application/json",
                forHTTPHeaderField: "Accept"
            )
            request.httpBody = try? JSONSerialization.data(
                withJSONObject: ["action": "logout"]
            )

            let relevantCookies = cookies.filter {
                $0.domain == "kareta.kz" ||
                $0.domain == ".kareta.kz" ||
                $0.domain.hasSuffix(".kareta.kz")
            }

            let headers = HTTPCookie.requestHeaderFields(
                with: relevantCookies
            )
            if let cookieHeader = headers["Cookie"] {
                request.setValue(
                    cookieHeader,
                    forHTTPHeaderField: "Cookie"
                )
            }

            URLSession.shared.dataTask(with: request) {
                [weak self, weak webView] data, response, error in
                guard let self, let webView else { return }

                if let error {
                    return self.fail(
                        id,
                        "KARETA_NATIVE_LOGOUT_FAILED",
                        error.localizedDescription
                    )
                }

                let status = (response as? HTTPURLResponse)?.statusCode ?? 0
                let payload = data.flatMap {
                    try? JSONSerialization.jsonObject(with: $0)
                } as? [String: Any]

                guard
                    (200..<300).contains(status),
                    payload?["ok"] as? Bool == true
                else {
                    return self.fail(
                        id,
                        "KARETA_NATIVE_LOGOUT_FAILED",
                        "Server logout returned HTTP \(status)"
                    )
                }

                let group = DispatchGroup()
                for cookie in relevantCookies {
                    group.enter()
                    cookieStore.delete(cookie) {
                        group.leave()
                    }
                }

                group.notify(queue: .main) {
                    webView.evaluateJavaScript(
                        "sessionStorage.clear(); window.location.href='/';"
                    )
                    self.send(id: id, data: [
                        "loggedOut": true,
                        "serverRevoked": true
                    ])
                }
            }.resume()
        }
    }

    private func complete(
        id: String,
        result: Result<[String: Any], Error>
    ) {
        switch result {
        case .success(let payload):
            send(id: id, data: payload)
        case .failure(let error):
            fail(
                id,
                "KARETA_NATIVE_OPERATION_FAILED",
                error.localizedDescription
            )
        }
    }

    private func open(_ url: URL, id: String) {
        DispatchQueue.main.async {
            UIApplication.shared.open(url, options: [:]) { success in
                if success {
                    self.send(id: id, data: ["opened": true])
                } else {
                    self.fail(
                        id,
                        "KARETA_NATIVE_OPEN_FAILED",
                        "iOS did not open the URL"
                    )
                }
            }
        }
    }

    private func evaluate(
        _ script: String,
        id: String,
        response: [String: Any]
    ) {
        DispatchQueue.main.async {
            guard let webView = self.webView else {
                return self.fail(
                    id,
                    "KARETA_NATIVE_WEBVIEW_UNAVAILABLE",
                    "WKWebView is unavailable"
                )
            }

            webView.evaluateJavaScript(script) { _, error in
                if let error {
                    self.fail(
                        id,
                        "KARETA_NATIVE_JS_FAILED",
                        error.localizedDescription
                    )
                } else {
                    self.send(id: id, data: response)
                }
            }
        }
    }

    private func send(
        id: String,
        ok: Bool = true,
        data: [String: Any]? = [:],
        error: String? = nil,
        message: String? = nil
    ) {
        var response: [String: Any] = [
            "id": id,
            "ok": ok
        ]

        if let data { response["data"] = data }
        if let error { response["error"] = error }
        if let message { response["message"] = message }

        guard
            JSONSerialization.isValidJSONObject(response),
            let jsonData = try? JSONSerialization.data(
                withJSONObject: response
            ),
            let json = String(
                data: jsonData,
                encoding: .utf8
            )
        else {
            return
        }

        let script = """
        if (window.KaretaNative && typeof window.KaretaNative.onmessage === 'function') {
          window.KaretaNative.onmessage({ data: \(json) });
        }
        """

        DispatchQueue.main.async {
            self.webView?.evaluateJavaScript(script)
        }
    }

    private func fail(
        _ id: String,
        _ code: String,
        _ text: String
    ) {
        send(
            id: id,
            ok: false,
            data: nil,
            error: code,
            message: text
        )
    }

    private func jsString(_ value: String) -> String {
        let array = [value]
        guard
            let data = try? JSONSerialization.data(
                withJSONObject: array
            ),
            let json = String(
                data: data,
                encoding: .utf8
            ),
            json.count >= 2
        else {
            return """"
        }
        return String(json.dropFirst().dropLast())
    }

    private func number(_ value: Any?) -> Double? {
        if let value = value as? Double { return value }
        if let value = value as? Int { return Double(value) }
        if let value = value as? NSNumber { return value.doubleValue }
        if let value = value as? String { return Double(value) }
        return nil
    }

    private enum BridgeError: LocalizedError {
        case invalidMessage

        var errorDescription: String? {
            switch self {
            case .invalidMessage:
                return "Invalid KARETA native bridge envelope"
            }
        }
    }
}

private final class NetworkState {
    static let shared = NetworkState()

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(
        label: "kz.kareta.network-monitor"
    )
    private let lock = NSLock()
    private var online = true

    var isOnline: Bool {
        lock.lock()
        defer { lock.unlock() }
        return online
    }

    private init() {
        monitor.pathUpdateHandler = { [weak self] path in
            guard let self else { return }
            self.lock.lock()
            self.online = path.status == .satisfied
            self.lock.unlock()
        }
        monitor.start(queue: queue)
    }
}
