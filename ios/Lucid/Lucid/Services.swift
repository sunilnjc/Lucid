import AVFoundation
import Foundation
import Speech
import UserNotifications

@MainActor
final class SpeechPlayer: ObservableObject {
    private let synthesizer = AVSpeechSynthesizer()

    func speak(_ text: String, rate: Float) {
        synthesizer.stopSpeaking(at: .immediate)
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: "en-GB")
        utterance.rate = rate
        synthesizer.speak(utterance)
    }
}

@MainActor
final class SpeechCoach: NSObject, ObservableObject {
    @Published var transcript = ""
    @Published var isListening = false
    @Published var status = "Tap the microphone and say your sentence."

    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-GB"))
    private let audioEngine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?

    func toggle() {
        isListening ? stop() : requestAccessAndStart()
    }

    func stop() {
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        request?.endAudio()
        task?.cancel()
        task = nil
        request = nil
        isListening = false
        status = transcript.isEmpty ? "No speech was captured. Try again." : "Transcript ready to check."
    }

    private func requestAccessAndStart() {
        SFSpeechRecognizer.requestAuthorization { [weak self] speechStatus in
            AVAudioApplication.requestRecordPermission { microphoneAllowed in
                Task { @MainActor in
                    guard speechStatus == .authorized, microphoneAllowed else {
                        self?.status = "Enable Microphone and Speech Recognition in iOS Settings to practise aloud."
                        return
                    }
                    self?.start()
                }
            }
        }
    }

    private func start() {
        stopIfNeeded()
        transcript = ""
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        self.request = request

        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.record, mode: .measurement, options: .duckOthers)
            try session.setActive(true, options: .notifyOthersOnDeactivation)
            let node = audioEngine.inputNode
            let format = node.outputFormat(forBus: 0)
            node.installTap(onBus: 0, bufferSize: 1_024, format: format) { buffer, _ in
                request.append(buffer)
            }
            audioEngine.prepare()
            try audioEngine.start()
        } catch {
            status = "The microphone could not start. Please try again."
            stopIfNeeded()
            return
        }

        isListening = true
        status = "Listening… Tap again when you finish."
        task = recognizer?.recognitionTask(with: request) { [weak self] result, error in
            Task { @MainActor in
                if let text = result?.bestTranscription.formattedString {
                    self?.transcript = text
                }
                if error != nil || result?.isFinal == true {
                    self?.stop()
                }
            }
        }
    }

    private func stopIfNeeded() {
        if audioEngine.isRunning { audioEngine.stop() }
        audioEngine.inputNode.removeTap(onBus: 0)
        task?.cancel()
        task = nil
        request = nil
        isListening = false
    }
}

enum ReminderScheduler {
    static let identifier = "lucid.daily-practice"

    static func setDailyReminder(enabled: Bool, hour: Int, minute: Int) async throws {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [identifier])
        guard enabled else { return }
        let granted = try await center.requestAuthorization(options: [.alert, .sound, .badge])
        guard granted else { throw ReminderError.permissionDenied }

        let content = UNMutableNotificationContent()
        content.title = "Three words. One stronger workday."
        content.body = "Your role-specific Lucid lesson is ready."
        content.sound = .default
        let trigger = UNCalendarNotificationTrigger(
            dateMatching: DateComponents(hour: hour, minute: minute),
            repeats: true
        )
        try await center.add(UNNotificationRequest(identifier: identifier, content: content, trigger: trigger))
    }

    enum ReminderError: LocalizedError {
        case permissionDenied

        var errorDescription: String? {
            "Notifications are disabled. You can enable them in iOS Settings."
        }
    }
}
