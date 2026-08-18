import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var store: LearningStore
    @State private var notificationStatus: String?
    @State private var showResetConfirmation = false
    @State private var showFeedback = false

    private var reminderTime: Binding<Date> {
        Binding {
            Calendar.current.date(from: DateComponents(
                hour: store.data.settings.reminderHour,
                minute: store.data.settings.reminderMinute
            )) ?? Date()
        } set: { date in
            let parts = Calendar.current.dateComponents([.hour, .minute], from: date)
            store.data.settings.reminderHour = parts.hour ?? 9
            store.data.settings.reminderMinute = parts.minute ?? 0
            if store.data.settings.notificationsEnabled { scheduleReminder() }
        }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Your learning path") {
                    if let role = store.selectedRole {
                        LabeledContent("Role", value: role.label)
                    }
                    Button("Change role, situations, or goals") {
                        store.data.profile = nil
                    }
                }

                Section("Daily reminder") {
                    Toggle("Remind me to practise", isOn: Binding(
                        get: { store.data.settings.notificationsEnabled },
                        set: { enabled in
                            store.data.settings.notificationsEnabled = enabled
                            scheduleReminder()
                        }
                    ))
                    DatePicker("Reminder time", selection: reminderTime, displayedComponents: .hourAndMinute)
                        .disabled(!store.data.settings.notificationsEnabled)
                    if let notificationStatus {
                        Text(notificationStatus).font(.caption).foregroundStyle(LucidColour.muted)
                    }
                    Text("The reminder follows your iPhone’s current time zone.")
                        .font(.caption)
                        .foregroundStyle(LucidColour.muted)
                }

                Section("Pronunciation") {
                    VStack(alignment: .leading) {
                        Text("Audio speed")
                        Slider(
                            value: Binding(
                                get: { Double(store.data.settings.speechRate) },
                                set: { store.data.settings.speechRate = Float($0) }
                            ),
                            in: 0.36...0.56
                        )
                        .accessibilityValue(store.data.settings.speechRate < 0.44 ? "Slower" : "Normal")
                    }
                }

                Section("Help improve Lucid") {
                    Button("Send beta feedback") { showFeedback = true }
                    Text("Feedback is optional. It helps shape role-specific lessons before the public launch.")
                        .font(.caption)
                        .foregroundStyle(LucidColour.muted)
                }

                Section("Privacy and support") {
                    Link("Privacy policy", destination: URL(string: "https://lucid-vocabulary-sunil.sunilkumar-kalabandi.chatgpt.site/privacy")!)
                    Link("Support", destination: URL(string: "https://lucid-vocabulary-sunil.sunilkumar-kalabandi.chatgpt.site/support")!)
                    Text("Learning progress stays on this device. No account, advertising identifier, or cross-app tracking is used.")
                        .font(.caption)
                        .foregroundStyle(LucidColour.muted)
                }

                Section {
                    Button("Erase learning data", role: .destructive) { showResetConfirmation = true }
                } footer: {
                    Text("This permanently removes your profile, lessons, favourites, and review history from this device.")
                }

                Section {
                    LabeledContent("Catalogue", value: "64 professional words")
                    LabeledContent("Version", value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0")
                }
            }
            .scrollContentBackground(.hidden)
            .background(LucidColour.paper)
            .navigationTitle("Settings")
            .sheet(isPresented: $showFeedback) { BetaFeedbackView() }
            .confirmationDialog(
                "Erase all Lucid learning data?",
                isPresented: $showResetConfirmation,
                titleVisibility: .visible
            ) {
                Button("Erase data", role: .destructive) { store.reset() }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This cannot be undone.")
            }
        }
    }

    private func scheduleReminder() {
        let enabled = store.data.settings.notificationsEnabled
        let hour = store.data.settings.reminderHour
        let minute = store.data.settings.reminderMinute
        Task {
            do {
                try await ReminderScheduler.setDailyReminder(enabled: enabled, hour: hour, minute: minute)
                notificationStatus = enabled ? "Daily reminder scheduled." : "Reminder turned off."
            } catch {
                store.data.settings.notificationsEnabled = false
                notificationStatus = error.localizedDescription
            }
        }
    }
}

struct BetaFeedbackView: View {
    @EnvironmentObject private var store: LearningStore
    @Environment(\.dismiss) private var dismiss
    @State private var rating = 5
    @State private var helpful = ""
    @State private var confusing = ""
    @State private var missing = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Overall experience") {
                    Picker("Rating", selection: $rating) {
                        ForEach(1...5, id: \.self) { value in Text("\(value) of 5").tag(value) }
                    }
                    .pickerStyle(.segmented)
                }
                Section("What helped you most?") {
                    TextEditor(text: $helpful).frame(minHeight: 90)
                        .accessibilityLabel("What helped you most")
                }
                Section("What felt confusing?") {
                    TextEditor(text: $confusing).frame(minHeight: 70)
                        .accessibilityLabel("What felt confusing")
                }
                Section("What is missing for your role?") {
                    TextEditor(text: $missing).frame(minHeight: 70)
                        .accessibilityLabel("What is missing for your role")
                }
                if let status = store.feedbackStatus {
                    Section { Text(status).foregroundStyle(LucidColour.muted) }
                }
            }
            .navigationTitle("Beta feedback")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Send") {
                        Task {
                            await store.submitBetaFeedback(
                                rating: rating,
                                helpful: helpful,
                                confusing: confusing,
                                missing: missing
                            )
                        }
                    }
                    .disabled(helpful.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
    }
}
