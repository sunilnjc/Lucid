import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var store: LearningStore
    @State private var notificationStatus: String?
    @State private var showResetConfirmation = false
    @State private var showFeedback = false
    @State private var showProfileEditor = false
    @State private var showAccount = false
    @State private var showDeleteAccount = false
    @State private var showSignOutConfirmation = false
    @State private var backupDocument: LucidBackupDocument?
    @State private var exportBackup = false
    @State private var importBackup = false
    @State private var chooseRestoreMode = false
    @State private var restoreProfile = false
    @State private var backupStatus: String?
    @State private var reminderRequest = UUID()

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
                if store.storageNotice != nil {
                    Section { PracticeStatusBanner() }.listRowBackground(LucidColour.surface)
                }
                Section("Account and backup") {
                    if let session = store.session {
                        LabeledContent("Signed in", value: session.user.email ?? "Lucid account")
                        Label(store.syncStatus, systemImage: "icloud")
                        if let date = store.lastSyncedAt {
                            Text("Last synced \(date.formatted(.relative(presentation: .named)))")
                                .font(.footnote).foregroundStyle(LucidColour.secondaryOnDark)
                        }
                        if store.needsAccountVerification {
                            Button("Verify email to reconnect") { showAccount = true }
                                .disabled(store.accountBusy || store.accountService?.emailDeliveryReady != true)
                        } else {
                            Button("Sync now") { Task { await store.syncNow() } }.disabled(store.accountBusy || store.isSyncing)
                        }
                        Button("Sign out") { showSignOutConfirmation = true }.disabled(store.accountBusy)
                    } else {
                        Label("Saved on this device", systemImage: "iphone")
                        Text("You can learn offline. Export a backup to keep a copy of your progress, or move it to another device.")
                            .font(.subheadline).foregroundStyle(LucidColour.secondaryOnDark)
                        if store.accountService?.emailDeliveryReady == true {
                            Button("Sign in to back up across devices") { showAccount = true }
                        }
                    }
                    if store.accountService?.emailDeliveryReady != true {
                        Text("Cloud sign-in is not ready in this build. Keep learning locally and export a backup for safekeeping.")
                            .font(.footnote).foregroundStyle(LucidColour.secondaryOnDark)
                    }
                    if let notice = store.accountNotice {
                        Text(notice).font(.subheadline).foregroundStyle(LucidColour.coral)
                    }
                    Button("Export a learning backup") {
                        do { backupDocument = try LucidBackupDocument(data: store.data); exportBackup = true }
                        catch { backupStatus = "Your backup could not be prepared. Please try again." }
                    }
                    if store.session == nil { Button("Restore a learning backup") { chooseRestoreMode = true } }
                    Text("Backup files include your practice drafts. Keep them somewhere private. Restoring merges progress instead of erasing it.")
                        .font(.footnote).foregroundStyle(LucidColour.secondaryOnDark)
                    if let backupStatus { Text(backupStatus).font(.subheadline).foregroundStyle(LucidColour.mint) }
                }.listRowBackground(LucidColour.surface)

                Section("Learning preferences") {
                    if let role = store.selectedRole {
                        LabeledContent("Role", value: role.label)
                    }
                    LabeledContent("Daily pace", value: "\(store.dailyGoal) \(store.dailyGoal == 1 ? "word" : "words")")
                    Button("Change role, situations, or goals") {
                        showProfileEditor = true
                    }
                }
                .listRowBackground(LucidColour.surface)

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
                        Text(notificationStatus).font(.caption).foregroundStyle(LucidColour.secondaryOnDark)
                    }
                    Text("The reminder follows your iPhone’s current time zone.")
                        .font(.caption)
                        .foregroundStyle(LucidColour.secondaryOnDark)
                }
                .listRowBackground(LucidColour.surface)

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
                        .accessibilityLabel("Audio speed")
                        .accessibilityValue(store.data.settings.speechRate < 0.44 ? "Slower" : (store.data.settings.speechRate > 0.48 ? "Faster" : "Normal"))
                    }
                }
                .listRowBackground(LucidColour.surface)

                Section("Help improve Lucid") {
                    Button("Send beta feedback") { showFeedback = true }
                    Text("Feedback is optional. It helps shape role-specific lessons before the public launch.")
                        .font(.caption)
                        .foregroundStyle(LucidColour.secondaryOnDark)
                }
                .listRowBackground(LucidColour.surface)

                Section("Privacy and support") {
                    Link("Privacy policy", destination: URL(string: "https://lucid-vocabulary-sunil.sunilkumar-kalabandi.chatgpt.site/privacy")!)
                    Link("Support", destination: URL(string: "https://lucid-vocabulary-sunil.sunilkumar-kalabandi.chatgpt.site/support")!)
                    Text(store.session == nil ? "Lucid stores your learning and practice drafts on this device. Cloud backup is optional when available. Lucid has no ads or cross-app tracking." : "Your profile, learning activity, and saved words sync to your account. Lucid does not include practice drafts or notification settings in cloud backup.")
                        .font(.caption)
                        .foregroundStyle(LucidColour.secondaryOnDark)
                    Text("Optional dictation uses Apple speech recognition and may process audio online. Use fictional workplace details, or type instead.")
                        .font(.caption).foregroundStyle(LucidColour.secondaryOnDark)
                }
                .listRowBackground(LucidColour.surface)

                Section {
                    if store.session == nil {
                        Button("Erase learning data", role: .destructive) { showResetConfirmation = true }
                    } else {
                        Button("Delete account and cloud data", role: .destructive) { showDeleteAccount = true }
                    }
                } footer: {
                    Text(store.session == nil ? "This permanently removes your profile, lessons, favourites, and review history from this device." : "This permanently deletes your account and its learning history from Lucid’s cloud and this device. A separate guest profile is not affected.")
                }
                .listRowBackground(LucidColour.surface)

                Section {
                    LabeledContent("Catalogue", value: "\(store.catalog.words.count) professional words")
                    LabeledContent("Version", value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0")
                }
                .listRowBackground(LucidColour.surface)
            }
            .scrollContentBackground(.hidden)
            .foregroundStyle(LucidColour.textOnDark)
            .tint(LucidColour.mint)
            .background(LucidNightBackground().ignoresSafeArea())
            .navigationTitle("Settings")
            .lucidHomeNavigation()
            .toolbarBackground(LucidColour.midnight.opacity(0.94), for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .sheet(isPresented: $showFeedback) { BetaFeedbackView() }
            .sheet(isPresented: $showProfileEditor) {
                OnboardingView(catalog: store.catalog, profile: store.profile, name: store.displayName, dailyGoal: store.dailyGoal, editing: true)
            }
            .sheet(isPresented: $showAccount) { AccountView() }
            .sheet(isPresented: $showDeleteAccount) { AccountView(deleting: true) }
            .fileExporter(isPresented: $exportBackup, document: backupDocument, contentType: .json, defaultFilename: "Lucid-backup-\(Date().lucidDayKey)") { result in
                if case .success = result { backupStatus = "Your learning backup was exported." }
                else { backupStatus = "The backup was not exported." }
            }
            .fileImporter(isPresented: $importBackup, allowedContentTypes: [.json]) { result in
                do { try store.importBackup(from: result.get(), restoreProfile: restoreProfile); backupStatus = "Backup restored. Your existing progress was preserved." }
                catch { backupStatus = "The file could not be restored. Choose a valid Lucid backup; your current progress has not changed." }
            }
            .confirmationDialog("What would you like to restore?", isPresented: $chooseRestoreMode, titleVisibility: .visible) {
                Button("Profile and learning progress") { restoreProfile = true; importBackup = true }
                Button("Progress only — keep my profile") { restoreProfile = false; importBackup = true }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Both choices preserve and merge your learning history. Profile includes your name, role, and daily pace.")
            }
            .confirmationDialog("Sign out of Lucid?", isPresented: $showSignOutConfirmation, titleVisibility: .visible) {
                Button("Sign out") { Task { await store.signOut() } }
            } message: {
                Text("Any progress waiting to sync stays in this account’s protected local cache. Sign in to the same account to finish syncing it.")
            }
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
        let currentRequest = UUID()
        reminderRequest = currentRequest
        Task {
            do {
                try await ReminderScheduler.setDailyReminder(enabled: enabled, hour: hour, minute: minute)
                guard currentRequest == reminderRequest else { return }
                notificationStatus = enabled ? "Daily reminder scheduled." : "Reminder turned off."
            } catch {
                guard currentRequest == reminderRequest else { return }
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
    @State private var submitted = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Overall experience") {
                    Picker("Rating", selection: $rating) {
                        ForEach(1...5, id: \.self) { value in Text("\(value) of 5").tag(value) }
                    }
                    .pickerStyle(.menu)
                }
                .listRowBackground(LucidColour.surface)
                Section {
                    TextEditor(text: $helpful).frame(minHeight: 90)
                        .accessibilityLabel("Your feedback, required")
                } header: {
                    Text("Your feedback (required)")
                } footer: {
                    Text("Tell us what helped, report a bug, or suggest one improvement. Keep personal and workplace details private.")
                }
                .listRowBackground(LucidColour.surface)
                Section("What felt confusing?") {
                    TextEditor(text: $confusing).frame(minHeight: 70)
                        .accessibilityLabel("What felt confusing")
                }
                .listRowBackground(LucidColour.surface)
                Section("What is missing for your role?") {
                    TextEditor(text: $missing).frame(minHeight: 70)
                        .accessibilityLabel("What is missing for your role")
                }
                .listRowBackground(LucidColour.surface)
                if let status = store.feedbackStatus {
                    Section { Text(status).foregroundStyle(LucidColour.secondaryOnDark) }
                        .listRowBackground(LucidColour.surface)
                }
            }
            .scrollContentBackground(.hidden)
            .disabled(store.isSendingFeedback || submitted)
            .lucidKeyboardDismissal()
            .foregroundStyle(LucidColour.textOnDark)
            .tint(LucidColour.mint)
            .background(LucidNightBackground().ignoresSafeArea())
            .navigationTitle("Beta feedback")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(LucidColour.midnight.opacity(0.94), for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .preferredColorScheme(.dark)
            .interactiveDismissDisabled(store.isSendingFeedback)
            .onAppear { store.feedbackStatus = nil }
            .onChange(of: store.feedbackStatus) { _, status in
                if let status { LucidAccessibility.announce(status) }
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() }.disabled(store.isSendingFeedback) }
                ToolbarItem(placement: .confirmationAction) {
                    Button(submitted ? "Sent" : (store.isSendingFeedback ? "Sending…" : "Send")) {
                        Task {
                            submitted = await store.submitBetaFeedback(
                                rating: rating,
                                helpful: helpful,
                                confusing: confusing,
                                missing: missing
                            )
                        }
                    }
                    .disabled(submitted || store.isSendingFeedback || helpful.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
    }
}
