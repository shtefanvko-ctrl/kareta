import CoreBluetooth
import Foundation

final class NativeELMService: NSObject {
    static let shared = NativeELMService()

    private let lastPeripheralKey = "kareta.ios.elm.lastPeripheral"

    private var central: CBCentralManager?
    private var discovered: [UUID: DiscoveredPeripheral] = [:]
    private var connectedPeripheral: CBPeripheral?
    private var writeCharacteristic: CBCharacteristic?
    private var notifyCharacteristic: CBCharacteristic?

    private var scanCompletion: ((Result<[String: Any], Error>) -> Void)?
    private var scanTimer: Timer?

    private var connectCompletion: ((Result<[String: Any], Error>) -> Void)?
    private var characteristicServicesPending = 0

    private var commandQueue: [CommandRequest] = []
    private var activeCommand: CommandRequest?
    private var commandBuffer = ""
    private var commandTimer: Timer?

    private var ready = false
    private var vehicleConnected = false
    private var protocolLabel = ""
    private var lastError = ""

    private struct DiscoveredPeripheral {
        let peripheral: CBPeripheral
        let name: String
        let rssi: Int
        let likelyElm: Bool
    }

    private struct CommandRequest {
        let command: String
        let timeout: TimeInterval
        let completion: (Result<String, Error>) -> Void
    }

    private override init() {
        super.init()
    }

    func status() -> [String: Any] {
        ensureCentral()

        let authorization = CBManager.authorization
        let state = central?.state ?? .unknown
        let connected = connectedPeripheral?.state == .connected

        return [
            "platform": "ios",
            "transport": "ble",
            "permission": authorization == .allowedAlways,
            "authorization": authorizationLabel(authorization),
            "enabled": state == .poweredOn,
            "bluetoothState": bluetoothStateLabel(state),
            "connected": connected,
            "ready": ready,
            "vehicleConnected": vehicleConnected,
            "address": connectedPeripheral?.identifier.uuidString ?? "",
            "name": connectedPeripheral?.name ?? "",
            "protocol": protocolLabel,
            "lastError": lastError
        ]
    }

    func requestPermission(
        completion: @escaping ([String: Any]) -> Void
    ) {
        DispatchQueue.main.async {
            self.ensureCentral()
            let authorization = CBManager.authorization
            completion([
                "permission": "bluetooth",
                "granted": authorization == .allowedAlways,
                "status": self.authorizationLabel(authorization),
                "supported": true,
                "transport": "ble"
            ])
        }
    }

    func devices(
        completion: @escaping (Result<[String: Any], Error>) -> Void
    ) {
        DispatchQueue.main.async {
            guard self.scanCompletion == nil else {
                return completion(.failure(ELMError.busy))
            }

            self.ensureCentral()
            self.scanCompletion = completion
            self.discovered.removeAll()

            if self.central?.state == .poweredOn {
                self.startScan()
            } else if self.central?.state != .unknown &&
                        self.central?.state != .resetting {
                self.finishScan(
                    .failure(
                        ELMError.bluetoothUnavailable(
                            self.bluetoothStateLabel(
                                self.central?.state ?? .unknown
                            )
                        )
                    )
                )
            }
        }
    }

    func connect(
        address: String,
        completion: @escaping (Result<[String: Any], Error>) -> Void
    ) {
        DispatchQueue.main.async {
            guard self.connectCompletion == nil else {
                return completion(.failure(ELMError.busy))
            }
            guard let uuid = UUID(uuidString: address) else {
                return completion(.failure(ELMError.invalidIdentifier))
            }

            self.ensureCentral()
            guard self.central?.state == .poweredOn else {
                return completion(
                    .failure(
                        ELMError.bluetoothUnavailable(
                            self.bluetoothStateLabel(
                                self.central?.state ?? .unknown
                            )
                        )
                    )
                )
            }

            let peripheral =
                self.discovered[uuid]?.peripheral ??
                self.central?.retrievePeripherals(
                    withIdentifiers: [uuid]
                ).first

            guard let peripheral else {
                return completion(.failure(ELMError.deviceNotFound))
            }

            self.resetTransport(
                keepPeripheral: false,
                keepLastError: true
            )
            self.connectCompletion = completion
            self.connectedPeripheral = peripheral
            peripheral.delegate = self
            self.central?.connect(peripheral, options: nil)
        }
    }

    func reconnectLast(
        completion: @escaping (Result<[String: Any], Error>) -> Void
    ) {
        let address = UserDefaults.standard.string(
            forKey: lastPeripheralKey
        ) ?? ""

        guard !address.isEmpty else {
            return completion(.failure(ELMError.noPreviousDevice))
        }

        connect(address: address, completion: completion)
    }

    func disconnect() -> [String: Any] {
        if let peripheral = connectedPeripheral {
            central?.cancelPeripheralConnection(peripheral)
        }

        resetTransport(
            keepPeripheral: false,
            keepLastError: true
        )

        return [
            "connected": false,
            "ready": false,
            "transport": "ble"
        ]
    }

    func initialize(
        completion: @escaping (Result<[String: Any], Error>) -> Void
    ) {
        guard transportReady else {
            return completion(.failure(ELMError.transportNotReady))
        }

        ready = false
        vehicleConnected = false
        protocolLabel = ""

        let commands: [(String, TimeInterval)] = [
            ("ATZ", 5.0),
            ("ATE0", 2.5),
            ("ATL0", 2.5),
            ("ATS0", 2.5),
            ("ATH0", 2.5),
            ("ATSP0", 3.0),
            ("0100", 8.0),
            ("ATDP", 3.0)
        ]

        runSequence(
            commands,
            index: 0,
            results: [:]
        ) { result in
            switch result {
            case .failure(let error):
                self.ready = false
                self.vehicleConnected = false
                self.lastError = error.localizedDescription
                completion(.failure(error))

            case .success(let results):
                let capability = self.compactHex(
                    results["0100"] ?? ""
                )
                let connected = capability.contains("4100")
                let protocolValue = self.cleanedResponse(
                    command: "ATDP",
                    raw: results["ATDP"] ?? ""
                )

                self.vehicleConnected = connected
                self.ready = connected
                self.protocolLabel = protocolValue
                self.lastError = connected
                    ? ""
                    : "VEHICLE_NOT_RESPONDING"

                completion(.success([
                    "transport": "ble",
                    "vehicleConnected": connected,
                    "ready": connected,
                    "protocol": protocolValue,
                    "adapter": self.connectedPeripheral?.name ?? "ELM327"
                ]))
            }
        }
    }

    func command(
        _ command: String,
        timeoutMs: Int,
        completion: @escaping (Result<[String: Any], Error>) -> Void
    ) {
        let normalized = normalizeCommand(command)
        guard !normalized.isEmpty else {
            return completion(.failure(ELMError.invalidCommand))
        }

        enqueue(
            command: normalized,
            timeout: max(0.5, Double(timeoutMs) / 1000.0)
        ) { result in
            switch result {
            case .success(let raw):
                completion(.success([
                    "command": normalized,
                    "raw": raw,
                    "text": self.cleanedResponse(
                        command: normalized,
                        raw: raw
                    )
                ]))
            case .failure(let error):
                completion(.failure(error))
            }
        }
    }

    func snapshot(
        completion: @escaping (Result<[String: Any], Error>) -> Void
    ) {
        guard ready else {
            return completion(.failure(ELMError.vehicleNotReady))
        }

        let commands: [(String, TimeInterval)] = [
            ("010C", 3.5),
            ("010D", 3.5),
            ("0105", 3.5),
            ("ATRV", 3.5),
            ("03", 4.0),
            ("0902", 6.0)
        ]

        runSequence(
            commands,
            index: 0,
            results: [:]
        ) { result in
            switch result {
            case .failure(let error):
                completion(.failure(error))
            case .success(let values):
                var payload: [String: Any] = [
                    "transport": "ble",
                    "protocol": self.protocolLabel,
                    "dtcRaw": values["03"] ?? "",
                    "dtcCodes": self.parseDTC(
                        values["03"] ?? ""
                    ),
                    "vinRaw": values["0902"] ?? ""
                ]

                if let rpm = self.parseRPM(values["010C"] ?? "") {
                    payload["rpm"] = rpm
                }
                if let speed = self.parseSpeed(values["010D"] ?? "") {
                    payload["speedKph"] = speed
                }
                if let coolant = self.parseCoolant(values["0105"] ?? "") {
                    payload["coolantC"] = coolant
                }
                if let voltage = self.parseVoltage(values["ATRV"] ?? "") {
                    payload["voltageV"] = voltage
                }
                if let vin = self.parseVIN(values["0902"] ?? "") {
                    payload["vin"] = vin
                }

                completion(.success(payload))
            }
        }
    }

    func liveSnapshot(
        completion: @escaping (Result<[String: Any], Error>) -> Void
    ) {
        guard ready else {
            return completion(.failure(ELMError.vehicleNotReady))
        }

        let commands: [(String, TimeInterval)] = [
            ("010C", 2.0),
            ("010D", 2.0),
            ("0105", 2.0),
            ("ATRV", 2.0)
        ]

        runSequence(
            commands,
            index: 0,
            results: [:]
        ) { result in
            switch result {
            case .failure(let error):
                completion(.failure(error))
            case .success(let values):
                var payload: [String: Any] = [
                    "transport": "ble"
                ]

                if let rpm = self.parseRPM(values["010C"] ?? "") {
                    payload["rpm"] = rpm
                }
                if let speed = self.parseSpeed(values["010D"] ?? "") {
                    payload["speedKph"] = speed
                }
                if let coolant = self.parseCoolant(values["0105"] ?? "") {
                    payload["coolantC"] = coolant
                }
                if let voltage = self.parseVoltage(values["ATRV"] ?? "") {
                    payload["voltageV"] = voltage
                }

                completion(.success(payload))
            }
        }
    }

    private var transportReady: Bool {
        connectedPeripheral?.state == .connected &&
        writeCharacteristic != nil &&
        notifyCharacteristic != nil
    }

    private func ensureCentral() {
        guard central == nil else { return }
        central = CBCentralManager(
            delegate: self,
            queue: .main
        )
    }

    private func startScan() {
        guard let central, central.state == .poweredOn else {
            return
        }

        scanTimer?.invalidate()
        central.stopScan()
        central.scanForPeripherals(
            withServices: nil,
            options: [
                CBCentralManagerScanOptionAllowDuplicatesKey: false
            ]
        )

        scanTimer = Timer.scheduledTimer(
            withTimeInterval: 3.0,
            repeats: false
        ) { [weak self] _ in
            self?.finishScan(.success(self?.devicePayload() ?? [:]))
        }
    }

    private func finishScan(
        _ result: Result<[String: Any], Error>
    ) {
        scanTimer?.invalidate()
        scanTimer = nil
        central?.stopScan()

        let completion = scanCompletion
        scanCompletion = nil
        completion?(result)
    }

    private func devicePayload() -> [String: Any] {
        let rows = discovered.values.sorted {
            if $0.likelyElm != $1.likelyElm {
                return $0.likelyElm && !$1.likelyElm
            }
            return $0.rssi > $1.rssi
        }

        return [
            "transport": "ble",
            "devices": rows.prefix(40).map { item in
                [
                    "name": item.name,
                    "address": item.peripheral.identifier.uuidString,
                    "likelyElm": item.likelyElm,
                    "rssi": item.rssi
                ] as [String: Any]
            }
        ]
    }

    private func finishConnect(
        _ result: Result<[String: Any], Error>
    ) {
        let completion = connectCompletion
        connectCompletion = nil
        completion?(result)
    }

    private func resetTransport(
        keepPeripheral: Bool,
        keepLastError: Bool
    ) {
        commandTimer?.invalidate()
        commandTimer = nil

        if let activeCommand {
            activeCommand.completion(
                .failure(ELMError.disconnected)
            )
        }
        for command in commandQueue {
            command.completion(
                .failure(ELMError.disconnected)
            )
        }

        activeCommand = nil
        commandQueue.removeAll()
        commandBuffer = ""
        writeCharacteristic = nil
        notifyCharacteristic = nil
        characteristicServicesPending = 0
        ready = false
        vehicleConnected = false
        protocolLabel = ""

        if !keepPeripheral {
            connectedPeripheral = nil
        }
        if !keepLastError {
            lastError = ""
        }
    }

    private func enqueue(
        command: String,
        timeout: TimeInterval,
        completion: @escaping (Result<String, Error>) -> Void
    ) {
        DispatchQueue.main.async {
            guard self.transportReady else {
                return completion(.failure(ELMError.transportNotReady))
            }

            self.commandQueue.append(
                CommandRequest(
                    command: command,
                    timeout: timeout,
                    completion: completion
                )
            )
            self.pumpCommands()
        }
    }

    private func pumpCommands() {
        guard activeCommand == nil else { return }
        guard !commandQueue.isEmpty else { return }
        guard
            let peripheral = connectedPeripheral,
            let characteristic = writeCharacteristic
        else {
            return
        }

        let request = commandQueue.removeFirst()
        activeCommand = request
        commandBuffer = ""

        let bytes = Data(
            (request.command + "\r").utf8
        )

        let writeType: CBCharacteristicWriteType =
            characteristic.properties.contains(.writeWithoutResponse)
            ? .withoutResponse
            : .withResponse

        peripheral.writeValue(
            bytes,
            for: characteristic,
            type: writeType
        )

        commandTimer?.invalidate()
        commandTimer = Timer.scheduledTimer(
            withTimeInterval: request.timeout,
            repeats: false
        ) { [weak self] _ in
            self?.finishActiveCommand(
                .failure(
                    ELMError.commandTimeout(
                        request.command
                    )
                )
            )
        }
    }

    private func finishActiveCommand(
        _ result: Result<String, Error>
    ) {
        commandTimer?.invalidate()
        commandTimer = nil

        guard let activeCommand else { return }
        self.activeCommand = nil
        commandBuffer = ""

        activeCommand.completion(result)
        pumpCommands()
    }

    private func runSequence(
        _ commands: [(String, TimeInterval)],
        index: Int,
        results: [String: String],
        completion: @escaping (
            Result<[String: String], Error>
        ) -> Void
    ) {
        guard index < commands.count else {
            return completion(.success(results))
        }

        let item = commands[index]
        enqueue(
            command: item.0,
            timeout: item.1
        ) { result in
            switch result {
            case .failure(let error):
                completion(.failure(error))
            case .success(let raw):
                var next = results
                next[item.0] = raw
                self.runSequence(
                    commands,
                    index: index + 1,
                    results: next,
                    completion: completion
                )
            }
        }
    }

    private func normalizeCommand(_ command: String) -> String {
        command
            .uppercased()
            .filter { character in
                character.isLetter ||
                character.isNumber ||
                character == " " ||
                character == "?"
            }
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func cleanedResponse(
        command: String,
        raw: String
    ) -> String {
        let normalizedCommand = command
            .uppercased()
            .replacingOccurrences(of: " ", with: "")

        return raw
            .replacingOccurrences(of: "\r", with: "\n")
            .replacingOccurrences(of: ">", with: "")
            .components(separatedBy: "\n")
            .map {
                $0.trimmingCharacters(
                    in: .whitespacesAndNewlines
                )
            }
            .filter { !$0.isEmpty }
            .filter {
                $0.uppercased()
                    .replacingOccurrences(of: " ", with: "")
                    != normalizedCommand
            }
            .joined(separator: "\n")
    }

    private func compactHex(_ raw: String) -> String {
        String(
            raw.uppercased().filter {
                $0.isHexDigit
            }
        )
    }

    private func bytesAfter(
        marker: String,
        raw: String,
        count: Int
    ) -> [UInt8]? {
        let compact = compactHex(raw)
        guard let range = compact.range(
            of: marker.uppercased()
        ) else {
            return nil
        }

        let suffix = String(
            compact[range.upperBound...]
        )
        guard suffix.count >= count * 2 else {
            return nil
        }

        var bytes: [UInt8] = []
        var index = suffix.startIndex

        for _ in 0..<count {
            let next = suffix.index(
                index,
                offsetBy: 2
            )
            guard
                let byte = UInt8(
                    suffix[index..<next],
                    radix: 16
                )
            else {
                return nil
            }
            bytes.append(byte)
            index = next
        }

        return bytes
    }

    private func parseRPM(_ raw: String) -> Double? {
        guard let bytes = bytesAfter(
            marker: "410C",
            raw: raw,
            count: 2
        ) else {
            return nil
        }
        return Double(
            Int(bytes[0]) * 256 +
            Int(bytes[1])
        ) / 4.0
    }

    private func parseSpeed(_ raw: String) -> Double? {
        guard let bytes = bytesAfter(
            marker: "410D",
            raw: raw,
            count: 1
        ) else {
            return nil
        }
        return Double(bytes[0])
    }

    private func parseCoolant(_ raw: String) -> Double? {
        guard let bytes = bytesAfter(
            marker: "4105",
            raw: raw,
            count: 1
        ) else {
            return nil
        }
        return Double(Int(bytes[0]) - 40)
    }

    private func parseVoltage(_ raw: String) -> Double? {
        let expression = try? NSRegularExpression(
            pattern: #"([0-9]+(?:\.[0-9]+)?)\s*[Vv]"#
        )

        guard let expression else { return nil }

        let range = NSRange(
            raw.startIndex..<raw.endIndex,
            in: raw
        )

        guard
            let match = expression.firstMatch(
                in: raw,
                range: range
            ),
            let valueRange = Range(
                match.range(at: 1),
                in: raw
            )
        else {
            return nil
        }

        return Double(raw[valueRange])
    }

    private func parseDTC(_ raw: String) -> [String] {
        let compact = compactHex(raw)
        guard let range = compact.range(of: "43") else {
            return []
        }

        let body = String(
            compact[range.upperBound...]
        )

        var bytes: [UInt8] = []
        var index = body.startIndex

        while body.distance(
            from: index,
            to: body.endIndex
        ) >= 2 {
            let next = body.index(
                index,
                offsetBy: 2
            )
            if let byte = UInt8(
                body[index..<next],
                radix: 16
            ) {
                bytes.append(byte)
            }
            index = next
        }

        var codes: [String] = []
        var cursor = 0

        while cursor + 1 < bytes.count {
            let high = bytes[cursor]
            let low = bytes[cursor + 1]
            cursor += 2

            if high == 0 && low == 0 {
                continue
            }

            let systems = ["P", "C", "B", "U"]
            let system = systems[
                Int((high & 0xC0) >> 6)
            ]
            let first = Int(
                (high & 0x30) >> 4
            )
            let second = hexDigit(
                Int(high & 0x0F)
            )
            let third = hexDigit(
                Int((low & 0xF0) >> 4)
            )
            let fourth = hexDigit(
                Int(low & 0x0F)
            )

            codes.append(
                "\(system)\(first)\(second)\(third)\(fourth)"
            )
        }

        return Array(
            Set(codes)
        ).sorted()
    }

    private func parseVIN(_ raw: String) -> String? {
        let compact = compactHex(raw)
        guard let marker = compact.range(of: "4902") else {
            return nil
        }

        var body = String(
            compact[marker.upperBound...]
        )

        if body.hasPrefix("01") {
            body.removeFirst(2)
        }

        var output = ""
        var index = body.startIndex

        while body.distance(
            from: index,
            to: body.endIndex
        ) >= 2 {
            let next = body.index(
                index,
                offsetBy: 2
            )
            guard let byte = UInt8(
                body[index..<next],
                radix: 16
            ) else {
                break
            }

            if byte >= 32 && byte <= 126 {
                output.append(
                    Character(
                        UnicodeScalar(byte)
                    )
                )
            }

            index = next
            if output.count >= 17 {
                break
            }
        }

        let allowed = Set(
            "ABCDEFGHJKLMNPRSTUVWXYZ0123456789"
        )
        let vin = String(
            output
                .uppercased()
                .filter { allowed.contains($0) }
        )

        return vin.count == 17 ? vin : nil
    }

    private func hexDigit(_ value: Int) -> String {
        String(
            format: "%X",
            value & 0xF
        )
    }

    private func likelyElmName(_ value: String) -> Bool {
        let upper = value.uppercased()
        return [
            "ELM",
            "OBD",
            "V-LINK",
            "VLINK",
            "VGATE",
            "VEEPEAK",
            "OBDLINK"
        ].contains {
            upper.contains($0)
        }
    }

    private func authorizationLabel(
        _ value: CBManagerAuthorization
    ) -> String {
        switch value {
        case .allowedAlways:
            return "allowed"
        case .denied:
            return "denied"
        case .restricted:
            return "restricted"
        case .notDetermined:
            return "not_determined"
        @unknown default:
            return "unknown"
        }
    }

    private func bluetoothStateLabel(
        _ value: CBManagerState
    ) -> String {
        switch value {
        case .poweredOn:
            return "powered_on"
        case .poweredOff:
            return "powered_off"
        case .unauthorized:
            return "unauthorized"
        case .unsupported:
            return "unsupported"
        case .resetting:
            return "resetting"
        case .unknown:
            return "unknown"
        @unknown default:
            return "unknown"
        }
    }

    private enum ELMError: LocalizedError {
        case busy
        case invalidIdentifier
        case deviceNotFound
        case noPreviousDevice
        case bluetoothUnavailable(String)
        case transportNotReady
        case characteristicNotFound
        case disconnected
        case invalidCommand
        case commandTimeout(String)
        case vehicleNotReady

        var errorDescription: String? {
            switch self {
            case .busy:
                return "ELM operation already in progress"
            case .invalidIdentifier:
                return "Invalid BLE peripheral identifier"
            case .deviceNotFound:
                return "BLE ELM adapter not found"
            case .noPreviousDevice:
                return "No previous BLE ELM adapter is saved"
            case .bluetoothUnavailable(let state):
                return "Bluetooth unavailable: \(state)"
            case .transportNotReady:
                return "BLE ELM transport is not ready"
            case .characteristicNotFound:
                return "No writable/notifying BLE UART characteristics found"
            case .disconnected:
                return "BLE ELM adapter disconnected"
            case .invalidCommand:
                return "Invalid ELM command"
            case .commandTimeout(let command):
                return "ELM command timeout: \(command)"
            case .vehicleNotReady:
                return "Vehicle ECU is not ready"
            }
        }
    }
}

extension NativeELMService: CBCentralManagerDelegate {
    func centralManagerDidUpdateState(
        _ central: CBCentralManager
    ) {
        if central.state == .poweredOn {
            if scanCompletion != nil && !central.isScanning {
                startScan()
            }
            return
        }

        if scanCompletion != nil &&
            central.state != .unknown &&
            central.state != .resetting
        {
            finishScan(
                .failure(
                    ELMError.bluetoothUnavailable(
                        bluetoothStateLabel(
                            central.state
                        )
                    )
                )
            )
        }

        if connectedPeripheral != nil &&
            central.state != .poweredOn
        {
            lastError = "BLUETOOTH_\(bluetoothStateLabel(central.state).uppercased())"
            resetTransport(
                keepPeripheral: false,
                keepLastError: true
            )
        }
    }

    func centralManager(
        _ central: CBCentralManager,
        didDiscover peripheral: CBPeripheral,
        advertisementData: [String: Any],
        rssi RSSI: NSNumber
    ) {
        let advertisedName =
            advertisementData[
                CBAdvertisementDataLocalNameKey
            ] as? String

        let name = peripheral.name
            ?? advertisedName
            ?? "BLE \(peripheral.identifier.uuidString.prefix(8))"

        discovered[peripheral.identifier] =
            DiscoveredPeripheral(
                peripheral: peripheral,
                name: name,
                rssi: RSSI.intValue,
                likelyElm: likelyElmName(name)
            )
    }

    func centralManager(
        _ central: CBCentralManager,
        didConnect peripheral: CBPeripheral
    ) {
        connectedPeripheral = peripheral
        peripheral.delegate = self
        peripheral.discoverServices(nil)
    }

    func centralManager(
        _ central: CBCentralManager,
        didFailToConnect peripheral: CBPeripheral,
        error: Error?
    ) {
        let message = error?.localizedDescription
            ?? "BLE connection failed"

        lastError = message
        resetTransport(
            keepPeripheral: false,
            keepLastError: true
        )
        finishConnect(
            .failure(
                error ?? ELMError.deviceNotFound
            )
        )
    }

    func centralManager(
        _ central: CBCentralManager,
        didDisconnectPeripheral peripheral: CBPeripheral,
        error: Error?
    ) {
        let wasCurrent =
            connectedPeripheral?.identifier ==
            peripheral.identifier

        guard wasCurrent else { return }

        if let error {
            lastError = error.localizedDescription
        }

        resetTransport(
            keepPeripheral: false,
            keepLastError: true
        )
    }
}

extension NativeELMService: CBPeripheralDelegate {
    func peripheral(
        _ peripheral: CBPeripheral,
        didDiscoverServices error: Error?
    ) {
        if let error {
            lastError = error.localizedDescription
            return finishConnect(.failure(error))
        }

        let services = peripheral.services ?? []
        guard !services.isEmpty else {
            return finishConnect(
                .failure(
                    ELMError.characteristicNotFound
                )
            )
        }

        characteristicServicesPending = services.count

        for service in services {
            peripheral.discoverCharacteristics(
                nil,
                for: service
            )
        }
    }

    func peripheral(
        _ peripheral: CBPeripheral,
        didDiscoverCharacteristicsFor service: CBService,
        error: Error?
    ) {
        if let error {
            lastError = error.localizedDescription
        } else {
            for characteristic in service.characteristics ?? [] {
                let properties = characteristic.properties

                if writeCharacteristic == nil &&
                    (
                        properties.contains(.writeWithoutResponse) ||
                        properties.contains(.write)
                    )
                {
                    writeCharacteristic = characteristic
                }

                if notifyCharacteristic == nil &&
                    (
                        properties.contains(.notify) ||
                        properties.contains(.indicate)
                    )
                {
                    notifyCharacteristic = characteristic
                }
            }
        }

        characteristicServicesPending = max(
            0,
            characteristicServicesPending - 1
        )

        guard characteristicServicesPending == 0 else {
            return
        }

        guard
            writeCharacteristic != nil,
            let notifyCharacteristic
        else {
            lastError = "BLE_UART_CHARACTERISTICS_NOT_FOUND"
            return finishConnect(
                .failure(
                    ELMError.characteristicNotFound
                )
            )
        }

        peripheral.setNotifyValue(
            true,
            for: notifyCharacteristic
        )
    }

    func peripheral(
        _ peripheral: CBPeripheral,
        didUpdateNotificationStateFor characteristic: CBCharacteristic,
        error: Error?
    ) {
        guard characteristic.uuid == notifyCharacteristic?.uuid else {
            return
        }

        if let error {
            lastError = error.localizedDescription
            return finishConnect(.failure(error))
        }

        guard characteristic.isNotifying else {
            return
        }

        UserDefaults.standard.set(
            peripheral.identifier.uuidString,
            forKey: lastPeripheralKey
        )

        lastError = ""

        finishConnect(.success([
            "connected": true,
            "ready": false,
            "transport": "ble",
            "address": peripheral.identifier.uuidString,
            "name": peripheral.name ?? "BLE ELM327"
        ]))
    }

    func peripheral(
        _ peripheral: CBPeripheral,
        didUpdateValueFor characteristic: CBCharacteristic,
        error: Error?
    ) {
        guard characteristic.uuid == notifyCharacteristic?.uuid else {
            return
        }

        if let error {
            return finishActiveCommand(
                .failure(error)
            )
        }

        guard let data = characteristic.value else {
            return
        }

        if let text = String(
            data: data,
            encoding: .utf8
        ) {
            commandBuffer += text
        } else {
            commandBuffer += data.map {
                String(
                    format: "%02X",
                    $0
                )
            }.joined()
        }

        if commandBuffer.contains(">") {
            let response = commandBuffer
            finishActiveCommand(
                .success(response)
            )
        }
    }

    func peripheral(
        _ peripheral: CBPeripheral,
        didWriteValueFor characteristic: CBCharacteristic,
        error: Error?
    ) {
        guard characteristic.uuid == writeCharacteristic?.uuid else {
            return
        }

        if let error {
            finishActiveCommand(
                .failure(error)
            )
        }
    }
}
