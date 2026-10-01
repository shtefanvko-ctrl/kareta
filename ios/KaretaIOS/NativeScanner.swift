import Foundation
import UIKit
import Vision
import VisionKit

final class NativeScannerService {
    private var activeSession: AnyObject?

    func scan(
        mode: String,
        completion: @escaping (Result<[String: Any], Error>) -> Void
    ) {
        DispatchQueue.main.async {
            guard self.activeSession == nil else {
                return completion(.failure(KaretaNativeServiceError.busy))
            }

            if #available(iOS 16.0, *) {
                let session = DataScannerSession(
                    mode: mode,
                    completion: { [weak self] result in
                        self?.activeSession = nil
                        completion(result)
                    }
                )
                self.activeSession = session
                session.start()
            } else {
                completion(
                    .failure(
                        ScannerError.unsupportedIOS
                    )
                )
            }
        }
    }

    private enum ScannerError: LocalizedError {
        case unsupportedIOS

        var errorDescription: String? {
            "QR/VIN scanner requires iOS 16 or newer"
        }
    }
}

@available(iOS 16.0, *)
private final class DataScannerSession: NSObject,
    DataScannerViewControllerDelegate {

    private let mode: String
    private let completion: (Result<[String: Any], Error>) -> Void
    private var finished = false
    private var scanner: DataScannerViewController?
    private weak var navigation: UINavigationController?

    init(
        mode: String,
        completion: @escaping (Result<[String: Any], Error>) -> Void
    ) {
        self.mode = mode.lowercased()
        self.completion = completion
        super.init()
    }

    func start() {
        guard DataScannerViewController.isSupported else {
            return finish(.failure(ScannerError.unsupportedDevice))
        }
        guard DataScannerViewController.isAvailable else {
            return finish(.failure(ScannerError.unavailable))
        }
        guard let presenter = KaretaPresentation.topViewController() else {
            return finish(.failure(ScannerError.unavailable))
        }

        let types: Set<DataScannerViewController.RecognizedDataType>
        switch mode {
        case "vin":
            types = [
                .text(
                    languages: ["en-US"],
                    textContentType: nil
                )
            ]
        case "qr":
            types = [
                .barcode(symbologies: [.qr])
            ]
        default:
            types = [
                .barcode(symbologies: [.qr]),
                .text(
                    languages: ["en-US"],
                    textContentType: nil
                )
            ]
        }

        let controller = DataScannerViewController(
            recognizedDataTypes: types,
            qualityLevel: .balanced,
            recognizesMultipleItems: true,
            isHighFrameRateTrackingEnabled: false,
            isPinchToZoomEnabled: true,
            isGuidanceEnabled: true,
            isHighlightingEnabled: true
        )
        controller.delegate = self
        controller.title = mode == "vin" ? "Сканирование VIN" : "Сканирование QR"

        let navigation = UINavigationController(
            rootViewController: controller
        )
        controller.navigationItem.rightBarButtonItem = UIBarButtonItem(
            barButtonSystemItem: .cancel,
            target: self,
            action: #selector(cancel)
        )

        self.scanner = controller
        self.navigation = navigation

        presenter.present(navigation, animated: true) {
            do {
                try controller.startScanning()
            } catch {
                self.finish(.failure(error))
            }
        }
    }

    func dataScanner(
        _ dataScanner: DataScannerViewController,
        didAdd addedItems: [RecognizedItem],
        allItems: [RecognizedItem]
    ) {
        inspect(addedItems)
    }

    func dataScanner(
        _ dataScanner: DataScannerViewController,
        didUpdate updatedItems: [RecognizedItem],
        allItems: [RecognizedItem]
    ) {
        inspect(updatedItems)
    }

    func dataScanner(
        _ dataScanner: DataScannerViewController,
        becameUnavailableWithError error: DataScannerViewController.ScanningUnavailable
    ) {
        finish(
            .failure(
                ScannerError.scanningUnavailable(
                    String(describing: error)
                )
            )
        )
    }

    @objc private func cancel() {
        finish(.failure(ScannerError.cancelled))
    }

    private func inspect(_ items: [RecognizedItem]) {
        guard !finished else { return }

        for item in items {
            switch item {
            case .barcode(let barcode):
                guard mode != "vin" else { continue }
                guard
                    let value = barcode.payloadStringValue?
                        .trimmingCharacters(in: .whitespacesAndNewlines),
                    !value.isEmpty
                else {
                    continue
                }
                finish(.success([
                    "mode": mode.isEmpty ? "qr" : mode,
                    "type": "qr",
                    "value": value
                ]))
                return

            case .text(let text):
                guard mode == "vin" || mode.isEmpty else { continue }
                if let vin = extractVin(text.transcript) {
                    finish(.success([
                        "mode": "vin",
                        "type": "vin",
                        "value": vin,
                        "vin": vin
                    ]))
                    return
                }

            @unknown default:
                continue
            }
        }
    }

    private func extractVin(_ text: String) -> String? {
        let allowed = Set("ABCDEFGHJKLMNPRSTUVWXYZ0123456789")
        let compact = String(
            text
                .uppercased()
                .filter { allowed.contains($0) }
        )

        guard compact.count >= 17 else { return nil }

        let pattern = "[A-HJ-NPR-Z0-9]{17}"
        guard
            let expression = try? NSRegularExpression(
                pattern: pattern
            )
        else {
            return nil
        }

        let range = NSRange(
            compact.startIndex..<compact.endIndex,
            in: compact
        )

        guard
            let match = expression.firstMatch(
                in: compact,
                range: range
            ),
            let swiftRange = Range(
                match.range,
                in: compact
            )
        else {
            return nil
        }

        return String(compact[swiftRange])
    }

    private func finish(
        _ result: Result<[String: Any], Error>
    ) {
        guard !finished else { return }
        finished = true

        scanner?.stopScanning()
        navigation?.dismiss(animated: true) {
            self.scanner = nil
            self.completion(result)
        }
    }

    private enum ScannerError: LocalizedError {
        case unsupportedDevice
        case unavailable
        case cancelled
        case scanningUnavailable(String)

        var errorDescription: String? {
            switch self {
            case .unsupportedDevice:
                return "Live data scanner is not supported on this device"
            case .unavailable:
                return "Live data scanner is currently unavailable"
            case .cancelled:
                return "Scanning cancelled"
            case .scanningUnavailable(let reason):
                return "Scanning became unavailable: \(reason)"
            }
        }
    }
}
