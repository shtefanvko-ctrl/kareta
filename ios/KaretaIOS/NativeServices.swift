import AVFoundation
import CoreLocation
import Foundation
import PhotosUI
import UIKit
import UniformTypeIdentifiers

enum KaretaNativeServiceError: LocalizedError {
    case busy
    case cancelled
    case cameraUnavailable
    case invalidImage
    case locationDenied
    case locationUnavailable
    case invalidOfflinePayload

    var errorDescription: String? {
        switch self {
        case .busy: return "Another native operation is already active"
        case .cancelled: return "Operation cancelled"
        case .cameraUnavailable: return "Camera is unavailable"
        case .invalidImage: return "Unable to read image"
        case .locationDenied: return "Location permission is denied"
        case .locationUnavailable: return "Unable to determine location"
        case .invalidOfflinePayload: return "Offline payload is not valid JSON"
        }
    }
}

enum KaretaPresentation {
    static func topViewController(
        base: UIViewController? = keyWindow()?.rootViewController
    ) -> UIViewController? {
        if let navigation = base as? UINavigationController {
            return topViewController(base: navigation.visibleViewController)
        }
        if let tabs = base as? UITabBarController {
            return topViewController(base: tabs.selectedViewController)
        }
        if let presented = base?.presentedViewController {
            return topViewController(base: presented)
        }
        return base
    }

    private static func keyWindow() -> UIWindow? {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first(where: \.isKeyWindow)
    }
}

final class OfflineQueueStore {
    static let shared = OfflineQueueStore()

    private let lock = NSLock()
    private let fileURL: URL

    private init() {
        let base = FileManager.default.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        ).first ?? FileManager.default.temporaryDirectory

        let directory = base.appendingPathComponent("Kareta", isDirectory: true)
        try? FileManager.default.createDirectory(
            at: directory,
            withIntermediateDirectories: true
        )
        fileURL = directory.appendingPathComponent("offline_queue_v1.json")
    }

    func state() -> [String: Any] {
        lock.lock()
        defer { lock.unlock() }
        return ["count": loadUnlocked().count]
    }

    func enqueue(payload: [String: Any]) throws -> [String: Any] {
        guard JSONSerialization.isValidJSONObject(payload) else {
            throw KaretaNativeServiceError.invalidOfflinePayload
        }

        lock.lock()
        defer { lock.unlock() }

        var items = loadUnlocked()
        let item: [String: Any] = [
            "id": UUID().uuidString.lowercased(),
            "createdAt": Int64(Date().timeIntervalSince1970 * 1000),
            "payload": payload
        ]
        items.append(item)
        try saveUnlocked(items)
        return item
    }

    func drain() -> [String: Any] {
        lock.lock()
        defer { lock.unlock() }

        // Important: drain is non-destructive. The SPA explicitly acknowledges
        // items only after the server confirms synchronization.
        return ["items": loadUnlocked()]
    }

    func acknowledge(_ acknowledged: [Any]) throws -> [String: Any] {
        let ids = Set(
            acknowledged.compactMap { item -> String? in
                (item as? [String: Any])?["id"] as? String
            }
        )

        lock.lock()
        defer { lock.unlock() }

        var items = loadUnlocked()
        if !ids.isEmpty {
            items.removeAll { item in
                guard let id = item["id"] as? String else { return false }
                return ids.contains(id)
            }
            try saveUnlocked(items)
        }
        return ["count": items.count]
    }

    func restore(_ restored: [Any]) throws -> [String: Any] {
        let candidates = restored.compactMap { $0 as? [String: Any] }
        guard candidates.allSatisfy(JSONSerialization.isValidJSONObject) else {
            throw KaretaNativeServiceError.invalidOfflinePayload
        }

        lock.lock()
        defer { lock.unlock() }

        var current = loadUnlocked()
        var known = Set(current.compactMap { $0["id"] as? String })

        for var item in candidates {
            var id = item["id"] as? String ?? ""
            if id.isEmpty {
                id = UUID().uuidString.lowercased()
                item["id"] = id
            }
            if item["createdAt"] == nil {
                item["createdAt"] = Int64(Date().timeIntervalSince1970 * 1000)
            }
            guard !known.contains(id) else { continue }
            current.append(item)
            known.insert(id)
        }

        try saveUnlocked(current)
        return ["count": current.count]
    }

    func clear() throws -> [String: Any] {
        lock.lock()
        defer { lock.unlock() }
        try saveUnlocked([])
        return ["count": 0]
    }

    private func loadUnlocked() -> [[String: Any]] {
        guard
            let data = try? Data(contentsOf: fileURL),
            let value = try? JSONSerialization.jsonObject(with: data),
            let items = value as? [[String: Any]]
        else {
            return []
        }
        return items
    }

    private func saveUnlocked(_ items: [[String: Any]]) throws {
        let data = try JSONSerialization.data(
            withJSONObject: items,
            options: [.sortedKeys]
        )
        try data.write(to: fileURL, options: [.atomic])
    }
}

final class NativeLocationService: NSObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    private var locationCompletion: ((Result<[String: Any], Error>) -> Void)?
    private var permissionCompletion: (([String: Any]) -> Void)?

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    func requestPermission(completion: @escaping ([String: Any]) -> Void) {
        DispatchQueue.main.async {
            let status = self.manager.authorizationStatus
            if status == .notDetermined {
                self.permissionCompletion = completion
                self.manager.requestWhenInUseAuthorization()
                return
            }
            completion(self.permissionPayload(status))
        }
    }

    func currentLocation(
        completion: @escaping (Result<[String: Any], Error>) -> Void
    ) {
        DispatchQueue.main.async {
            guard self.locationCompletion == nil else {
                return completion(.failure(KaretaNativeServiceError.busy))
            }

            let status = self.manager.authorizationStatus
            switch status {
            case .denied, .restricted:
                completion(.failure(KaretaNativeServiceError.locationDenied))
            case .notDetermined:
                self.locationCompletion = completion
                self.manager.requestWhenInUseAuthorization()
            case .authorizedAlways, .authorizedWhenInUse:
                self.locationCompletion = completion
                self.manager.requestLocation()
            @unknown default:
                completion(.failure(KaretaNativeServiceError.locationUnavailable))
            }
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus

        if let completion = permissionCompletion, status != .notDetermined {
            permissionCompletion = nil
            completion(permissionPayload(status))
        }

        guard locationCompletion != nil else { return }
        switch status {
        case .authorizedAlways, .authorizedWhenInUse:
            manager.requestLocation()
        case .denied, .restricted:
            finishLocation(.failure(KaretaNativeServiceError.locationDenied))
        default:
            break
        }
    }

    func locationManager(
        _ manager: CLLocationManager,
        didUpdateLocations locations: [CLLocation]
    ) {
        guard let location = locations.last else {
            return finishLocation(
                .failure(KaretaNativeServiceError.locationUnavailable)
            )
        }

        finishLocation(.success([
            "lat": location.coordinate.latitude,
            "lng": location.coordinate.longitude,
            "accuracy": location.horizontalAccuracy,
            "timestamp": Int64(location.timestamp.timeIntervalSince1970 * 1000)
        ]))
    }

    func locationManager(
        _ manager: CLLocationManager,
        didFailWithError error: Error
    ) {
        finishLocation(.failure(error))
    }

    private func finishLocation(_ result: Result<[String: Any], Error>) {
        let completion = locationCompletion
        locationCompletion = nil
        completion?(result)
    }

    private func permissionPayload(
        _ status: CLAuthorizationStatus
    ) -> [String: Any] {
        let granted = status == .authorizedAlways || status == .authorizedWhenInUse
        let value: String
        switch status {
        case .notDetermined: value = "not_determined"
        case .restricted: value = "restricted"
        case .denied: value = "denied"
        case .authorizedAlways: value = "authorized_always"
        case .authorizedWhenInUse: value = "authorized_when_in_use"
        @unknown default: value = "unknown"
        }
        return [
            "permission": "location",
            "granted": granted,
            "status": value
        ]
    }
}

final class NativeMediaService: NSObject,
    UIImagePickerControllerDelegate,
    UINavigationControllerDelegate,
    PHPickerViewControllerDelegate {

    private var completion: ((Result<[String: Any], Error>) -> Void)?

    func pickImage(
        completion: @escaping (Result<[String: Any], Error>) -> Void
    ) {
        DispatchQueue.main.async {
            guard self.completion == nil else {
                return completion(.failure(KaretaNativeServiceError.busy))
            }
            guard let presenter = KaretaPresentation.topViewController() else {
                return completion(.failure(KaretaNativeServiceError.invalidImage))
            }

            self.completion = completion
            var configuration = PHPickerConfiguration(photoLibrary: .shared())
            configuration.selectionLimit = 1
            configuration.filter = .images

            let picker = PHPickerViewController(configuration: configuration)
            picker.delegate = self
            presenter.present(picker, animated: true)
        }
    }

    func takePhoto(
        completion: @escaping (Result<[String: Any], Error>) -> Void
    ) {
        DispatchQueue.main.async {
            guard self.completion == nil else {
                return completion(.failure(KaretaNativeServiceError.busy))
            }
            guard UIImagePickerController.isSourceTypeAvailable(.camera) else {
                return completion(.failure(KaretaNativeServiceError.cameraUnavailable))
            }
            guard let presenter = KaretaPresentation.topViewController() else {
                return completion(.failure(KaretaNativeServiceError.cameraUnavailable))
            }

            self.completion = completion
            let picker = UIImagePickerController()
            picker.sourceType = .camera
            picker.cameraCaptureMode = .photo
            picker.delegate = self
            presenter.present(picker, animated: true)
        }
    }

    func picker(
        _ picker: PHPickerViewController,
        didFinishPicking results: [PHPickerResult]
    ) {
        picker.dismiss(animated: true)

        guard let result = results.first else {
            return finish(.failure(KaretaNativeServiceError.cancelled))
        }

        let provider = result.itemProvider
        let type = UTType.image.identifier
        guard provider.hasItemConformingToTypeIdentifier(type) else {
            return finish(.failure(KaretaNativeServiceError.invalidImage))
        }

        provider.loadDataRepresentation(
            forTypeIdentifier: type
        ) { [weak self] data, error in
            if let error {
                return self?.finish(.failure(error))
            }
            guard let data, let image = UIImage(data: data) else {
                return self?.finish(.failure(KaretaNativeServiceError.invalidImage))
            }
            self?.finishImage(image, suggestedName: provider.suggestedName)
        }
    }

    func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
        picker.dismiss(animated: true)
        finish(.failure(KaretaNativeServiceError.cancelled))
    }

    func imagePickerController(
        _ picker: UIImagePickerController,
        didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
    ) {
        picker.dismiss(animated: true)
        guard let image = info[.originalImage] as? UIImage else {
            return finish(.failure(KaretaNativeServiceError.invalidImage))
        }
        finishImage(image, suggestedName: "camera.jpg")
    }

    private func finishImage(_ image: UIImage, suggestedName: String?) {
        guard let data = image.jpegData(compressionQuality: 0.86) else {
            return finish(.failure(KaretaNativeServiceError.invalidImage))
        }

        let base64 = data.base64EncodedString()
        finish(.success([
            "name": normalizedName(suggestedName),
            "mimeType": "image/jpeg",
            "size": data.count,
            "base64": base64,
            "dataUrl": "data:image/jpeg;base64,\(base64)",
            "width": Int(image.size.width),
            "height": Int(image.size.height)
        ]))
    }

    private func finish(_ result: Result<[String: Any], Error>) {
        let callback = completion
        completion = nil
        DispatchQueue.main.async {
            callback?(result)
        }
    }

    private func normalizedName(_ value: String?) -> String {
        let raw = (value ?? "image").trimmingCharacters(in: .whitespacesAndNewlines)
        let base = raw.isEmpty ? "image" : raw
        return base.lowercased().hasSuffix(".jpg") || base.lowercased().hasSuffix(".jpeg")
            ? base
            : base + ".jpg"
    }
}

enum NativePermissionService {
    static func requestCamera(
        completion: @escaping ([String: Any]) -> Void
    ) {
        let status = AVCaptureDevice.authorizationStatus(for: .video)
        switch status {
        case .authorized:
            completion([
                "permission": "camera",
                "granted": true,
                "status": "authorized"
            ])
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { granted in
                completion([
                    "permission": "camera",
                    "granted": granted,
                    "status": granted ? "authorized" : "denied"
                ])
            }
        case .denied:
            completion([
                "permission": "camera",
                "granted": false,
                "status": "denied"
            ])
        case .restricted:
            completion([
                "permission": "camera",
                "granted": false,
                "status": "restricted"
            ])
        @unknown default:
            completion([
                "permission": "camera",
                "granted": false,
                "status": "unknown"
            ])
        }
    }
}
