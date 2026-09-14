import AVFoundation
import Combine
import Foundation
import Speech
import UserNotifications

@MainActor
final class SpeechPlayer: NSObject, ObservableObject, AVSpeechSynthesizerDelegate {
    private let synthesizer = AVSpeechSynthesizer()
    override init() { super.init(); synthesizer.delegate = self }
    func speak(_ text: String, rate: Float) {
        SpeechCoach.stopActive()
        synthesizer.stopSpeaking(at: .immediate)
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio, options: .duckOthers)
            try AVAudioSession.sharedInstance().setActive(true)
        } catch { return }
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: "en-GB")
        utterance.rate = min(0.56, max(0.36, rate))
        synthesizer.speak(utterance)
    }
    func stop() {
        synthesizer.stopSpeaking(at: .immediate)
        if !SpeechCoach.hasActiveRecording { try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation) }
    }
    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        Task { @MainActor in if !SpeechCoach.hasActiveRecording { try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation) } }
    }
}

@MainActor
final class SpeechCoach: NSObject, ObservableObject {
    @Published var transcript = ""
    @Published var isListening = false
    @Published var status = "Tap the microphone and say your sentence."
    private static weak var active: SpeechCoach?
    static var hasActiveRecording: Bool { active?.isListening == true }
    static func stopActive() { active?.stop() }
    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-GB"))
    private let audioEngine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var timeout: Task<Void, Never>?
    private var tapInstalled = false
    private var generation = UUID()
    @Published private(set) var requestingAccess = false
    private var interruptions: AnyCancellable?

    override init() {
        super.init()
        interruptions = NotificationCenter.default.publisher(for: AVAudioSession.interruptionNotification)
            .sink { [weak self] _ in Task { @MainActor in self?.stop() } }
    }
    func toggle() {
        if isListening || requestingAccess { stop() } else { requestAccessAndStart() }
    }
    func stop() {
        generation = UUID()
        requestingAccess = false
        cleanup()
        status = transcript.isEmpty ? "Tap the microphone to try spoken practice." : "Transcript ready. You can edit it before checking."
    }
    private func cleanup() {
        timeout?.cancel()
        timeout = nil
        audioEngine.stop()
        if tapInstalled { audioEngine.inputNode.removeTap(onBus: 0); tapInstalled = false }
        request?.endAudio()
        task?.cancel()
        task = nil
        request = nil
        isListening = false
        if Self.active === self {
            Self.active = nil
            try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        }
    }
    private func requestAccessAndStart() {
        Self.stopActive()
        Self.active = self
        generation = UUID()
        let current = generation
        requestingAccess = true
        status = "Checking microphone permission…"
        SFSpeechRecognizer.requestAuthorization { [weak self] speechStatus in
            Task { @MainActor in
                guard let self, self.generation == current else { return }
                guard speechStatus == .authorized else {
                    self.requestingAccess = false
                    self.status = "Allow Speech Recognition in iOS Settings, or type your sentence instead."
                    return
                }
                AVAudioApplication.requestRecordPermission { [weak self] allowed in
                    Task { @MainActor in
                        guard let self, self.generation == current else { return }
                        self.requestingAccess = false
                        guard allowed else { self.status = "Allow Microphone in iOS Settings, or type your sentence instead."; return }
                        self.start(generation: current)
                    }
                }
            }
        }
    }
    private func start(generation current: UUID) {
        guard let recognizer, recognizer.isAvailable else {
            status = "Speech recognition is unavailable right now. You can still type your sentence."
            return
        }
        transcript = ""
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        self.request = request
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playAndRecord, mode: .measurement, options: [.defaultToSpeaker, .allowBluetoothHFP])
            try session.setActive(true)
            let node = audioEngine.inputNode
            let format = node.outputFormat(forBus: 0)
            guard format.sampleRate > 0, format.channelCount > 0 else { throw URLError(.cannotOpenFile) }
            node.installTap(onBus: 0, bufferSize: 1_024, format: format) { buffer, _ in request.append(buffer) }
            tapInstalled = true
            audioEngine.prepare()
            try audioEngine.start()
        } catch {
            cleanup()
            status = "The microphone could not start. Try again or type your sentence."
            return
        }
        isListening = true
        status = "Listening… Tap Stop when you finish."
        task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            Task { @MainActor in
                guard let self, self.generation == current else { return }
                if let text = result?.bestTranscription.formattedString { self.transcript = text }
                if error != nil || result?.isFinal == true {
                    self.stop()
                    if error != nil && self.transcript.isEmpty { self.status = "No speech captured. Check your connection or type your sentence." }
                }
            }
        }
        timeout = Task { [weak self] in
            do { try await Task.sleep(nanoseconds: 45_000_000_000) } catch { return }
            self?.stop()
        }
    }
}

@MainActor
enum ReminderScheduler {
    static let identifier = "lucid.daily-practice"
    private static var generation = UUID()
    private static var pending: Task<Void, Error>?
    static func cancel() {
        generation = UUID()
        pending?.cancel()
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [identifier])
        UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: [identifier])
    }
    static func setDailyReminder(enabled: Bool, hour: Int, minute: Int) async throws {
        let previous = pending
        let current = UUID()
        generation = current
        let next = Task { @MainActor in
            _ = try? await previous?.value
            guard generation == current, !Task.isCancelled else { return }
            let center = UNUserNotificationCenter.current()
            center.removePendingNotificationRequests(withIdentifiers: [identifier])
            guard enabled else { return }
            let granted = try await center.requestAuthorization(options: [.alert, .sound])
            guard generation == current, !Task.isCancelled else { return }
            guard granted else { throw ReminderError.permissionDenied }
            let content = UNMutableNotificationContent()
            content.title = "A few words. A clearer workday."
            content.body = "Take a moment for your Lucid practice."
            content.sound = .default
            let trigger = UNCalendarNotificationTrigger(dateMatching: DateComponents(hour: min(23, max(0, hour)), minute: min(59, max(0, minute))), repeats: true)
            try await center.add(UNNotificationRequest(identifier: identifier, content: content, trigger: trigger))
            // A cancellation while add was in flight cannot leave an orphan reminder.
            if generation != current { center.removePendingNotificationRequests(withIdentifiers: [identifier]) }
        }
        pending = next
        try await next.value
    }
    enum ReminderError: LocalizedError {
        case permissionDenied
        var errorDescription: String? { "Notifications are disabled. You can enable them in iOS Settings." }
    }
}

@MainActor
extension LearningStore {
    func reconcileReminder() async {
        guard data.settings.notificationsEnabled else { return }
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        if settings.authorizationStatus == .denied {
            data.settings.notificationsEnabled = false
            ReminderScheduler.cancel()
        }
    }
}
