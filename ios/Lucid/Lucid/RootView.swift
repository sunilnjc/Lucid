import StoreKit
import SwiftUI

struct RootView: View {
    @EnvironmentObject private var store: LearningStore
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var showAccount = false
    @State private var showBackupImporter = false
    @State private var backupError: String?
    @State private var confirmRecoveryRestore = false

    var body: some View {
        ZStack {
            if store.storageBlocked || store.catalogError != nil {
                ScrollView {
                VStack(spacing: 24) {
                    Image(systemName: "externaldrive.badge.exclamationmark").font(.largeTitle)
                    Text("Let’s recover your progress.").font(.title)
                    Text(store.catalogError ?? store.storageNotice ?? "Your saved data needs attention.")
                    if store.catalogError == nil {
                        Button("Retry storage") { store.retryStorage() }.buttonStyle(.borderedProminent)
                    } else {
                        Text("Please install the latest Lucid update. If the catalogue still cannot load, contact support.")
                            .foregroundStyle(LucidColour.secondaryOnDark)
                    }
                    if store.catalogError == nil && !store.storageNeedsUpdate && store.session == nil {
                        Button("Restore a saved backup") { confirmRecoveryRestore = true }
                    }
                    Link("Contact support", destination: URL(string: "https://lucid-vocabulary-sunil.sunilkumar-kalabandi.chatgpt.site/support")!)
                }.padding(28).foregroundStyle(LucidColour.textOnDark)
                }
            } else if store.cloudRestorePending && store.profile == nil {
                ScrollView {
                VStack(spacing: 20) {
                    Image(systemName: "icloud.and.arrow.down").font(.largeTitle).foregroundStyle(LucidColour.mint)
                    Text("Your learning is worth waiting for.").font(.title2.bold())
                    Text("We haven’t finished restoring your account. Connect to the internet and retry so your existing plan stays safe.")
                        .foregroundStyle(LucidColour.secondaryOnDark)
                    if let notice = store.accountNotice { Text(notice).font(.footnote) }
                    if store.isSyncing { ProgressView("Restoring your progress…") }
                    if store.needsAccountVerification {
                        Button("Verify email to reconnect") { showAccount = true }
                            .buttonStyle(.borderedProminent)
                            .disabled(store.accountService?.emailDeliveryReady != true || store.accountBusy)
                        if store.accountService?.emailDeliveryReady != true {
                            Text("Email sign-in is not ready in this build. Update Lucid to reconnect; your cached progress is kept safely.")
                                .font(.footnote)
                        }
                    } else {
                        Button("Retry restore") { Task { await store.syncNow() } }
                            .buttonStyle(.borderedProminent).disabled(store.isSyncing || store.accountBusy)
                    }
                    Button("Sign out and use guest mode") { Task { await store.signOut() } }
                        .disabled(store.accountBusy || store.isSyncing)
                }.padding(28).multilineTextAlignment(.center).foregroundStyle(LucidColour.textOnDark)
                }
            } else if store.hasEnteredLucid {
                Group {
                    if store.profile == nil {
                        OnboardingView(catalog: store.catalog, onBack: store.openHome)
                    } else {
                        MainTabView()
                    }
                }
                .transition(.move(edge: .trailing).combined(with: .opacity))
            } else {
                WelcomeView(hasProfile: store.profile != nil, accountAction: { showAccount = true }, restoreAction: { showBackupImporter = true }) {
                    withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.32)) {
                        store.openToday()
                    }
                }
                .transition(.opacity)
            }
        }
        .lucidBackground()
        .preferredColorScheme(.dark)
        .sheet(isPresented: $showAccount) { AccountView() }
        .confirmationDialog("Recover from a saved backup?", isPresented: $confirmRecoveryRestore, titleVisibility: .visible) {
            Button("Choose a Lucid backup") { showBackupImporter = true }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Lucid will keep a protected copy of the unreadable files, then restore the backup you choose. Changes made after that backup may not be recoverable.")
        }
        .fileImporter(isPresented: $showBackupImporter, allowedContentTypes: [.json]) { result in
            do {
                try store.importBackup(from: result.get(), restoreProfile: true)
                if store.profile != nil { store.openToday() }
            } catch {
                backupError = "Choose a valid Lucid backup. Your current progress has not changed."
            }
        }
        .alert("Backup could not be restored", isPresented: Binding(get: { backupError != nil }, set: { if !$0 { backupError = nil } })) {
            Button("OK", role: .cancel) { backupError = nil }
        } message: { Text(backupError ?? "") }
        .task { store.refreshDay(); await store.syncNow() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                store.refreshDay()
                Task { await store.syncNow(); await store.reconcileReminder() }
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .NSCalendarDayChanged)) { _ in store.refreshDay() }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.significantTimeChangeNotification)) { _ in store.refreshDay() }
        .onChange(of: store.scope) { _, _ in
            if store.profile != nil { store.openToday() } else { store.openHome() }
        }
    }
}

struct WelcomeView: View {
    @EnvironmentObject private var store: LearningStore
    @State private var showSignOutConfirmation = false
    let hasProfile: Bool
    let accountAction: () -> Void
    let restoreAction: () -> Void
    let continueAction: () -> Void

    var body: some View {
        TimelineView(.periodic(from: .now, by: 60)) { context in
            ZStack {
                LinearGradient(
                    colors: [LucidColour.midnight, LucidColour.darkTeal, LucidColour.ink],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()

                Circle()
                    .fill(LucidColour.nightTeal.opacity(0.48))
                    .frame(width: 310, height: 310)
                    .blur(radius: 4)
                    .offset(x: 160, y: -270)
                    .accessibilityHidden(true)

                Circle()
                    .fill(LucidColour.coral.opacity(0.12))
                    .frame(width: 250, height: 250)
                    .blur(radius: 10)
                    .offset(x: -170, y: 330)
                    .accessibilityHidden(true)

                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        BrandHeader(onDark: true)

                        Spacer(minLength: 44)

                        Text((greeting(for: context.date) + (store.displayName.isEmpty ? "" : ", \(store.displayName)")).uppercased())
                            .font(.caption.weight(.bold))
                            .tracking(1.8)
                            .foregroundStyle(LucidColour.mint)

                        Text(hasProfile ? (store.isCurrentPlanComplete ? "A little practice. A lasting difference." : "Make your next conversation count.") : "Welcome to a sharper workday.")
                            .font(.system(.largeTitle, design: .serif))
                            .foregroundStyle(.white)
                            .lineSpacing(-1)
                            .padding(.top, 14)

                        Text(context.date.formatted(.dateTime.weekday(.wide).day().month(.wide)))
                            .font(.headline)
                            .foregroundStyle(.white.opacity(0.72))
                            .padding(.top, 24)

                        Text(dayMessage(for: context.date))
                            .font(.title3)
                            .foregroundStyle(.white.opacity(0.86))
                            .lineSpacing(5)
                            .padding(.top, 8)

                        Spacer(minLength: 40)

                        Button(action: continueAction) {
                            HStack(spacing: 14) {
                                Text(hasProfile ? (store.isCurrentPlanComplete ? "See today’s progress" : "Open today’s practice") : "Personalise my Lucid")
                                    .font(.headline)
                                Spacer()
                                Image(systemName: "arrow.right")
                                    .font(.headline)
                            }
                            .foregroundStyle(LucidColour.midnight)
                            .padding(.horizontal, 22)
                            .frame(maxWidth: .infinity, minHeight: 62)
                            .background(LucidColour.mint, in: RoundedRectangle(cornerRadius: 18))
                        }
                        .buttonStyle(.plain)
                        .accessibilityHint(hasProfile ? "Opens today’s vocabulary lesson" : "Opens your professional vocabulary setup")

                        if store.session == nil && store.accountService?.emailDeliveryReady == true {
                            Button("Sign in or create an account", action: accountAction)
                                .font(.subheadline).foregroundStyle(LucidColour.mint)
                                .frame(maxWidth: .infinity, minHeight: 48)
                        }
                        if !hasProfile && store.session == nil {
                            Button("Already learning? Restore a backup", action: restoreAction)
                                .font(.subheadline).foregroundStyle(LucidColour.mint)
                                .frame(maxWidth: .infinity, minHeight: 48)
                        }
                        if !hasProfile, let session = store.session {
                            Text("Signed in as \(session.user.email ?? "your Lucid account")")
                                .font(.footnote).foregroundStyle(LucidColour.secondaryOnDark)
                                .frame(maxWidth: .infinity).padding(.top, 16)
                            Button("Sign out or use a different email") { showSignOutConfirmation = true }
                                .font(.subheadline).foregroundStyle(LucidColour.mint)
                                .frame(maxWidth: .infinity, minHeight: 48)
                                .disabled(store.accountBusy || store.isSyncing)
                                .accessibilityIdentifier("welcome.signOut")
                            if let notice = store.accountNotice {
                                Text(notice).font(.footnote).foregroundStyle(LucidColour.coral)
                            }
                        }
                        Text("A few useful words · Built for your role · Your pace")
                            .font(.caption)
                            .foregroundStyle(.white.opacity(0.58))
                            .frame(maxWidth: .infinity)
                            .multilineTextAlignment(.center)
                            .padding(.top, 18)
                    }
                    .padding(.horizontal, 26)
                    .padding(.top, 22)
                    .padding(.bottom, 32)
                    .frame(maxWidth: 720, alignment: .topLeading)
                    .frame(maxWidth: .infinity)
                }
            }
            .preferredColorScheme(.dark)
        }
        .confirmationDialog("Sign out of Lucid?", isPresented: $showSignOutConfirmation, titleVisibility: .visible) {
            Button("Sign out") { Task { await store.signOut() } }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Your account’s local learning stays separate from guest mode. Sign in to the same email to restore it.")
        }
    }

    private func greeting(for date: Date) -> String {
        switch Calendar.current.component(.hour, from: date) {
        case 5..<12: "Good morning"
        case 12..<17: "Good afternoon"
        case 17..<22: "Good evening"
        default: "Welcome back"
        }
    }

    private func dayMessage(for date: Date) -> String {
        switch Calendar.current.component(.weekday, from: date) {
        case 1: "A quiet moment to prepare the language you’ll need this week."
        case 2: "Start the week with language that helps your ideas move forward."
        case 3: "Turn today’s conversations into clearer decisions and next steps."
        case 4: "Build the words that make complex work easier to explain."
        case 5: "Strengthen the language you need to influence, align, and deliver."
        case 6: "Finish the week with words worth carrying into the next one."
        default: "Keep your professional vocabulary active with one focused lesson."
        }
    }
}

struct MainTabView: View {
    @EnvironmentObject private var store: LearningStore
    var body: some View {
        TabView(selection: $store.selectedTab) {
            TodayView()
                .tabItem { Label("Today", systemImage: "sun.max.fill") }
                .tag(0)
            ReviewView()
                .tabItem { Label("Review", systemImage: "arrow.triangle.2.circlepath") }
                .badge(store.visibleReviewWords.count).tag(1)
            LibraryView()
                .tabItem { Label("Library", systemImage: "books.vertical.fill") }
                .tag(2)
            InsightsView()
                .tabItem { Label("Progress", systemImage: "chart.line.uptrend.xyaxis") }
                .tag(3)
            SettingsView()
                .tabItem { Label("Settings", systemImage: "gearshape.fill") }
                .tag(4)
        }
        .tint(LucidColour.mint)
        .toolbarBackground(LucidColour.midnight.opacity(0.98), for: .tabBar)
        .toolbarBackground(.visible, for: .tabBar)
        .toolbarColorScheme(.dark, for: .tabBar)
        .preferredColorScheme(.dark)
    }
}

struct OnboardingView: View {
    @EnvironmentObject private var store: LearningStore
    @Environment(\.dismiss) private var dismiss
    let catalog: ProfessionalCatalog
    var editing = false
    var onBack: (() -> Void)?

    @State private var roleId: String
    @State private var seniorityId: String
    @State private var situationIds: Set<String> = []
    @State private var goalIds: Set<String> = []
    @State private var name = ""
    @State private var dailyGoal = 3
    @State private var saveError: String?

    init(catalog: ProfessionalCatalog, profile: LearnerProfile? = nil, name: String = "", dailyGoal: Int = 3, editing: Bool = false, onBack: (() -> Void)? = nil) {
        self.catalog = catalog
        self.editing = editing
        self.onBack = onBack
        _roleId = State(initialValue: profile?.roleId ?? catalog.roles.first?.id ?? "")
        _seniorityId = State(initialValue: profile?.seniorityId ?? catalog.seniorityLevels.first?.id ?? "")
        _situationIds = State(initialValue: Set(profile?.situationIds ?? []))
        _goalIds = State(initialValue: Set(profile?.goalIds ?? []))
        _name = State(initialValue: name)
        _dailyGoal = State(initialValue: dailyGoal)
    }

    private var role: ProfessionalRole? { catalog.roles.first { $0.id == roleId } }
    private var canContinue: Bool { !roleId.isEmpty && !seniorityId.isEmpty && !situationIds.isEmpty && !goalIds.isEmpty }
    private var selectionGuidance: String {
        if situationIds.isEmpty && goalIds.isEmpty { return "Choose at least one daily situation and one communication goal in setup." }
        if situationIds.isEmpty { return "Choose at least one daily situation in setup." }
        if goalIds.isEmpty { return "Choose at least one communication goal in setup." }
        return "Your role, your pace. You can change these later in Settings."
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    PracticeStatusBanner()
                    BrandHeader(onDark: true)

                    VStack(alignment: .leading, spacing: 10) {
                        Text("English for the moments that matter at work.")
                            .font(.system(.largeTitle, design: .serif, weight: .regular))
                            .foregroundStyle(.white)
                        Text(editing ? "Change your role to update Today’s words now. Your saved practice, reviews, and progress stay with you." : "Tell Lucid where you work and how you want to communicate. Each lesson will fit your role and your pace.")
                            .font(.body)
                            .foregroundStyle(.white.opacity(0.72))
                            .lineSpacing(4)
                    }

                    VStack(alignment: .leading, spacing: 14) {
                        TextField("What should we call you? (optional)", text: $name,
                                  prompt: Text("What should we call you? (optional)").foregroundStyle(LucidColour.secondaryOnDark))
                            .textContentType(.givenName).padding(16)
                            .foregroundStyle(LucidColour.textOnDark)
                            .background(LucidColour.midnight, in: RoundedRectangle(cornerRadius: 12))
                            .onChange(of: name) { _, value in name = String(value.prefix(40)) }
                        Picker("Daily pace", selection: $dailyGoal) {
                            Text("1 word · 2 min").tag(1)
                            Text("2 words · 4 min").tag(2)
                            Text("3 words · 6 min").tag(3)
                        }.pickerStyle(.menu).tint(LucidColour.mint)
                        Text("Start small. You can adjust your pace anytime. Scheduled review is separate.")
                            .font(.subheadline).foregroundStyle(LucidColour.secondaryOnDark)
                        if editing {
                            Text("Already opened a role today? Its cards stay the same when you return. Other preference changes don’t replace an existing daily plan. A new pace starts with the next daily lesson.")
                                .font(.footnote).foregroundStyle(LucidColour.secondaryOnDark)
                        }
                    }

                    OnboardingSection(number: "01", title: "Your role") {
                        Picker("Professional role", selection: $roleId) {
                            ForEach(catalog.roles) { role in Text(role.label).tag(role.id) }
                        }
                        .pickerStyle(.menu)
                        .tint(LucidColour.mint)
                        Text(role?.description ?? "")
                            .font(.subheadline)
                            .foregroundStyle(.white.opacity(0.68))
                    }

                    OnboardingSection(number: "02", title: "Your career stage") {
                        Picker("Seniority", selection: $seniorityId) {
                            ForEach(catalog.seniorityLevels) { level in Text(level.label).tag(level.id) }
                        }
                        .pickerStyle(.menu)
                        .tint(LucidColour.mint)
                        if let level = catalog.seniorityLevels.first(where: { $0.id == seniorityId }) {
                            Text(level.communicationFocus)
                                .font(.subheadline)
                                .foregroundStyle(.white.opacity(0.68))
                        }
                        Text("This describes your work, not your English ability. After setup, a short starting-point check can help you choose where to begin your course.")
                            .font(.footnote).foregroundStyle(LucidColour.secondaryOnDark)
                    }

                    OnboardingSection(number: "03", title: "Daily situations") {
                        Text("Choose at least one.")
                            .font(.caption)
                            .foregroundStyle(.white.opacity(0.62))
                        ForEach(role?.situations ?? []) { situation in
                            SelectionRow(
                                title: situation.label,
                                subtitle: situation.description,
                                selected: situationIds.contains(situation.id)
                            ) {
                                toggle(situation.id, in: &situationIds)
                            }
                        }
                    }

                    OnboardingSection(number: "04", title: "Communication goals") {
                        Text("Choose at least one.")
                            .font(.caption)
                            .foregroundStyle(.white.opacity(0.62))
                        ForEach(catalog.goals) { goal in
                            SelectionRow(
                                title: goal.label,
                                subtitle: goal.outcome,
                                selected: goalIds.contains(goal.id)
                            ) {
                                toggle(goal.id, in: &goalIds)
                            }
                        }
                    }

                }
                .padding(24)
                .frame(maxWidth: 760)
                .frame(maxWidth: .infinity)
            }
            .background(
                LinearGradient(
                    colors: [LucidColour.midnight, LucidColour.darkTeal, LucidColour.ink],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()
            )
            .preferredColorScheme(.dark)
            .lucidKeyboardDismissal()
            .safeAreaInset(edge: .bottom) {
                VStack(spacing: 10) {
                    if let saveError {
                        Text(saveError).font(.footnote).foregroundStyle(LucidColour.coral)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .accessibilityIdentifier("onboarding.save-error")
                    }
                    Text(selectionGuidance).font(.footnote)
                        .foregroundStyle(LucidColour.secondaryOnDark)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Button {
                        let saved = store.finishOnboarding(profile: LearnerProfile(
                            roleId: roleId, seniorityId: seniorityId,
                            situationIds: Array(situationIds).sorted(), goalIds: Array(goalIds).sorted()
                        ), name: name, goal: dailyGoal)
                        saveError = saved ? nil : (store.storageNotice ?? store.accountNotice ?? "Your preferences could not be saved. Check your selections and try again.")
                        if saved && editing { dismiss(); store.openToday() }
                    } label: {
                        Text(editing ? "Save and open Today" : "Build my first lesson")
                            .font(.headline).frame(maxWidth: .infinity, minHeight: 54)
                    }
                    .buttonStyle(.borderedProminent).tint(LucidColour.mint).foregroundStyle(LucidColour.midnight)
                    .disabled(!canContinue)
                    .accessibilityIdentifier("onboarding.continue")
                    .accessibilityHint(editing ? "Saves your preferences and opens Today. A new role updates your words immediately." : "Creates a personalised lesson with up to \(dailyGoal) professional words")
                }
                .padding(.horizontal, 24).padding(.vertical, 12).frame(maxWidth: 760)
                .frame(maxWidth: .infinity).background(LucidColour.midnight)
            }
            .toolbar {
                if editing { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
                else if let onBack {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Back", systemImage: "chevron.left", action: onBack)
                            .accessibilityHint("Returns to welcome and backup options")
                    }
                }
            }
            .onChange(of: roleId) {
                situationIds = []
                if let role {
                    goalIds = Set(role.defaultGoalIds.prefix(2))
                }
            }
        }
    }

    private func toggle(_ id: String, in selection: inout Set<String>) {
        if selection.contains(id) { selection.remove(id) } else { selection.insert(id) }
    }
}

struct OnboardingSection<Content: View>: View {
    let number: String
    let title: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text(number)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(LucidColour.coral)
                Text(title)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(.white)
                    .accessibilityAddTraits(.isHeader)
            }
            content
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(LucidColour.midnight.opacity(0.66), in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(.white.opacity(0.13)))
    }
}

struct SelectionRow: View {
    let title: String
    let subtitle: String
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(alignment: .top, spacing: 13) {
                Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(selected ? LucidColour.mint : .white.opacity(0.55))
                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(.white)
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.65))
                        .multilineTextAlignment(.leading)
                }
                Spacer()
            }
            .contentShape(Rectangle())
            .padding(.vertical, 5)
            .frame(minHeight: 44)
        }
        .buttonStyle(.plain)
        .accessibilityValue(selected ? "Selected" : "Not selected")
    }
}

struct BrandHeader: View {
    var onDark = false

    var body: some View {
        HStack(spacing: 12) {
            Image("LucidMark").resizable().scaledToFit()
                .frame(width: 54, height: 54)
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 0) {
                Text("Lucid")
                    .font(.system(.title2, design: .serif, weight: .bold))
                    .foregroundStyle(onDark ? .white : LucidColour.ink)
                Text("PROFESSIONAL VOCABULARY")
                    .font(.caption2.weight(.bold))
                    .tracking(1.2)
                    .foregroundStyle(onDark ? .white.opacity(0.65) : LucidColour.muted)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Lucid professional vocabulary")
    }
}

struct TodayView: View {
    @EnvironmentObject private var store: LearningStore
    @Environment(\.requestReview) private var requestReview
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var showCelebration = false
    @State private var selectedWordIndex = 0

    var body: some View {
        NavigationStack {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        PracticeStatusBanner()
                        PracticeDashboard()
                        if !store.currentRoleDueWords.isEmpty {
                            Button(action: store.openReview) {
                                HStack {
                                    Label("\(store.currentRoleDueWords.count) \(store.currentRoleDueWords.count == 1 ? "review" : "reviews") for your role", systemImage: "arrow.triangle.2.circlepath")
                                    Spacer()
                                    Image(systemName: "chevron.right")
                                }.font(.headline).padding(18).frame(minHeight: 54)
                            }
                            .buttonStyle(.plain).foregroundStyle(LucidColour.mint)
                            .background(LucidColour.raisedSurface, in: RoundedRectangle(cornerRadius: 18))
                        }
                        if store.todayWords.isEmpty {
                            EmptyState(icon: "books.vertical", title: "A day to put it into practice", message: "Explore saved words in your Library, or return when a review is due. You can update your role or goals in Settings.")
                            Button("Open my word library", action: store.openLibrary)
                                .buttonStyle(.bordered).frame(minHeight: 48)
                        } else {
                            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: dynamicTypeSize.isAccessibilitySize ? 1 : store.todayWords.count), spacing: 10) {
                                ForEach(Array(store.todayWords.enumerated()), id: \.element.id) { index, word in
                                    let hasSeenAnswer = store.data.completedWordIdsToday.contains(word.id)
                                        || store.practiceChallenge(for: word.id).flatMap { store.tapAttempt(for: $0) }?.revealed == true
                                    Button {
                                        if store.focusPracticeWord(word.id) {
                                            withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.2)) { selectedWordIndex = index }
                                        }
                                    } label: {
                                        VStack(spacing: 6) {
                                            Image(systemName: store.data.completedWordIdsToday.contains(word.id) ? "checkmark.circle.fill" : "\(index + 1).circle")
                                            Text(hasSeenAnswer ? word.term : "Word \(index + 1)").font(.subheadline.weight(.semibold))
                                                .fixedSize(horizontal: false, vertical: true)
                                        }.frame(maxWidth: .infinity, minHeight: 64).padding(8)
                                            .background(selectedWordIndex == index ? LucidColour.raisedSurface : LucidColour.surface, in: RoundedRectangle(cornerRadius: 16))
                                            .overlay(RoundedRectangle(cornerRadius: 16).stroke(selectedWordIndex == index ? LucidColour.mint : .clear))
                                            .contentShape(Rectangle())
                                    }
                                    .buttonStyle(.plain).foregroundStyle(LucidColour.textOnDark)
                                    .accessibilityLabel(hasSeenAnswer ? "Word \(index + 1): \(word.term)" : "Word \(index + 1)")
                                    .accessibilityValue(store.data.completedWordIdsToday.contains(word.id) ? "Practised" : "Ready to practise")
                                    .accessibilityAddTraits(selectedWordIndex == index ? .isSelected : [])
                                }
                            }.id("wordSteps")
                            let safeIndex = min(selectedWordIndex, store.todayWords.count - 1)
                            let word = store.todayWords[safeIndex]
                            if let lesson = store.pathLesson(for: word.id) {
                                NavigationLink { PathLessonView(lesson: lesson) } label: {
                                    Label(lesson.title, systemImage: "map").font(.subheadline).foregroundStyle(LucidColour.mint)
                                }.frame(minHeight: 44)
                            }
                            WordLearningCard(word: word, number: safeIndex + 1, onContinue: {
                                if let next = store.todayWords.firstIndex(where: { !store.data.completedWordIdsToday.contains($0.id) }) {
                                    if store.focusPracticeWord(store.todayWords[next].id) {
                                        selectedWordIndex = next
                                        withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.25)) { proxy.scrollTo("wordSteps", anchor: .top) }
                                    }
                                } else if store.isTodayComplete {
                                    store.openHome()
                                } else if store.completeToday() {
                                    showCelebration = true
                                }
                            }, onSkip: {
                                let remaining = store.todayWords.indices.filter { $0 != safeIndex && !store.data.completedWordIdsToday.contains(store.todayWords[$0].id) }
                                if let next = remaining.first(where: { $0 > safeIndex }) ?? remaining.first {
                                    if store.focusPracticeWord(store.todayWords[next].id) {
                                        selectedWordIndex = next
                                        withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.25)) { proxy.scrollTo("wordSteps", anchor: .top) }
                                    }
                                } else if store.focusPracticeWord(word.id) { store.openHome() }
                            }, onPause: {
                                if store.focusPracticeWord(word.id) { store.openHome() }
                            })
                                .id("\(store.practiceAccountToken)-\(store.profile?.roleId ?? "")-\(store.data.lessonDayKey ?? "")-\(word.id)")
                            if store.isTodayComplete {
                                Label(store.isCurrentPlanComplete ? "Current practice complete · Daily bonus earned" : "Daily bonus earned · Continue with the words above", systemImage: "checkmark.seal.fill")
                                    .font(.subheadline).foregroundStyle(LucidColour.mint)
                                    .frame(maxWidth: .infinity, alignment: .leading).padding(16)
                            } else if store.lessonProgress >= 1 {
                            Button {
                                if store.completeToday() {
                                    showCelebration = true
                                    if store.shouldRequestReview() {
                                        Task { try? await Task.sleep(nanoseconds: 2_000_000_000); requestReview() }
                                    }
                                }
                            } label: {
                                Label("Finish today’s lesson · +20 XP", systemImage: "checkmark.seal.fill")
                                    .font(.headline).frame(maxWidth: .infinity, minHeight: 52)
                            }
                            .buttonStyle(.borderedProminent).tint(LucidColour.mint).foregroundStyle(LucidColour.midnight)
                            .disabled(store.lessonProgress < 1 || store.isTodayComplete)
                            .accessibilityIdentifier("lesson.complete")
                            .sensoryFeedback(.success, trigger: showCelebration)
                            }
                            if store.lessonProgress >= 1 { OptionalStretchSection() }
                        }
                        LearningPathSummary()
                        WeeklyPracticeView()
                    }
                    .padding(18).frame(maxWidth: 720).frame(maxWidth: .infinity)
                }
            }
            .lucidBackground()
            .navigationTitle("Today")
            .lucidHomeNavigation()
            .lucidKeyboardDismissal()
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(LucidColour.midnight.opacity(0.94), for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .task { store.prepareToday(); selectNextUnfinishedWord() }
            .onChange(of: store.data.currentWordIds) { _, _ in selectNextUnfinishedWord() }
            .sheet(isPresented: $showCelebration) { LessonCelebrationView() }
        }
        .id(store.todayNavigationReset)
    }

    private func selectNextUnfinishedWord() {
        selectedWordIndex = store.todayWords.firstIndex { $0.id == store.practiceResumeWordId } ?? 0
    }
}

struct DailyHero: View {
    let role: ProfessionalRole?
    let progress: Double
    let dueCount: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            BrandHeader(onDark: true)
            Text("Three words for your real workday.")
                .font(.system(.largeTitle, design: .serif))
                .foregroundStyle(.white)
            Text(role?.description ?? "A focused professional English lesson.")
                .foregroundStyle(.white.opacity(0.8))
                .lineSpacing(3)
            HStack(spacing: 16) {
                ProgressView(value: progress)
                    .tint(LucidColour.mint)
                    .accessibilityLabel("Lesson progress")
                    .accessibilityValue("\(Int(progress * 100)) percent")
                Text("\(Int(progress * 3))/3")
                    .font(.headline.monospacedDigit())
                    .foregroundStyle(.white)
            }
            if dueCount > 0 {
                Label("\(dueCount) spaced review\(dueCount == 1 ? "" : "s") due", systemImage: "arrow.triangle.2.circlepath")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(LucidColour.mint)
            }
        }
        .padding(24)
        .background(LucidColour.teal, in: UnevenRoundedRectangle(topLeadingRadius: 20, bottomLeadingRadius: 20, bottomTrailingRadius: 20, topTrailingRadius: 56))
    }
}

struct WordLearningCard: View {
    @EnvironmentObject private var store: LearningStore
    @Environment(\.scenePhase) private var scenePhase
    let word: ProfessionalWord
    let number: Int
    let onContinue: () -> Void
    let onSkip: () -> Void
    let onPause: () -> Void
    @StateObject private var player = SpeechPlayer()
    @State private var showDetails = false
    @AccessibilityFocusState private var feedbackFocused: Bool
    private var completed: Bool { store.data.completedWordIdsToday.contains(word.id) }

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack {
                Text("QUICK CHALLENGE \(number)").font(.caption.weight(.bold)).tracking(1)
                    .foregroundStyle(LucidColour.mint)
                Spacer()
                Button(action: onPause) { Text("Pause").frame(minWidth: 44, minHeight: 44).contentShape(Rectangle()) }
                    .accessibilityIdentifier("practice.pause")
            }
            if let challenge = store.practiceChallenge(for: word.id) {
                challengeBody(challenge)
            } else {
                Text("This challenge could not be loaded. Your progress is safe. Try another card or come back later.")
                Button(action: onSkip) { Text("Skip for now").frame(minHeight: 44).contentShape(Rectangle()) }
            }
        }
        .padding(22).foregroundStyle(LucidColour.textOnDark)
        .background(LucidColour.surface, in: RoundedRectangle(cornerRadius: 24))
        .overlay(RoundedRectangle(cornerRadius: 24).stroke(.white.opacity(0.12)))
        .onChange(of: scenePhase) { _, phase in if phase != .active { player.stop() } }
        .onDisappear { player.stop() }
    }

    @ViewBuilder private func challengeBody(_ challenge: PracticeChallenge) -> some View {
        let attempt = store.tapAttempt(for: challenge)
        let revealed = attempt?.revealed == true
        let answered = completed || revealed
        if store.challengeWasUpdated(challenge), !completed {
            Text("This question has been refreshed. Your learning history is unchanged.")
                .font(.footnote).foregroundStyle(LucidColour.secondaryOnDark)
        }
        if !answered {
            Text(challenge.prompt).font(.system(.title, design: .serif))
                .fixedSize(horizontal: false, vertical: true).accessibilityAddTraits(.isHeader)
            Text(challenge.context).font(.body).lineSpacing(4)
            Text("Tap an answer · It saves automatically").font(.footnote).foregroundStyle(LucidColour.secondaryOnDark)
            VStack(spacing: 10) {
                ForEach(challenge.options) { option in
                    let selected = attempt?.choices.last == option.id
                    Button {
                        if store.answerPractice(challenge, choiceId: option.id) {
                            feedbackFocused = true
                            LucidAccessibility.announce(option.id == challenge.correctId ? "Correct. Practice saved." : "Not quite. " + option.explanation + " Try another answer.")
                        }
                    } label: {
                        HStack(alignment: .top, spacing: 12) {
                            Image(systemName: selected ? "arrow.uturn.backward.circle" : "circle")
                                .foregroundStyle(selected ? LucidColour.coral : LucidColour.mint)
                            Text(option.text).font(.body.weight(.medium)).multilineTextAlignment(.leading)
                                .fixedSize(horizontal: false, vertical: true)
                            Spacer(minLength: 0)
                        }.padding(16).frame(maxWidth: .infinity, minHeight: 56, alignment: .leading)
                            .background(LucidColour.raisedSurface, in: RoundedRectangle(cornerRadius: 16))
                            .overlay(RoundedRectangle(cornerRadius: 16).stroke(selected ? LucidColour.coral : .white.opacity(0.12)))
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .disabled(store.hasUnsavedChanges || selected)
                    .accessibilityIdentifier("practice.choice.\(option.id)")
                    .accessibilityHint(selected ? "Already tried. Choose another answer or get help." : "Checks and saves your answer.")
                }
            }
            if let chosen = attempt?.choices.last, let option = challenge.options.first(where: { $0.id == chosen }) {
                VStack(alignment: .leading, spacing: 8) {
                    Label("Not quite — try another", systemImage: "arrow.uturn.backward").font(.headline)
                    Text(option.explanation).font(.subheadline)
                }
                .foregroundStyle(LucidColour.textOnDark).padding(16)
                .background(LucidColour.raisedSurface, in: RoundedRectangle(cornerRadius: 16))
                .accessibilityElement(children: .combine).accessibilityFocused($feedbackFocused)
                .accessibilityIdentifier("practice.feedback")
            }
            Button {
                if store.revealPractice(challenge) { feedbackFocused = true }
            } label: { Text("Help me learn this").frame(minHeight: 44).contentShape(Rectangle()) }
                .disabled(store.hasUnsavedChanges)
                .accessibilityIdentifier("practice.hint")
            Button(action: onSkip) { Text("Skip for now").frame(minHeight: 44).contentShape(Rectangle()) }
                .accessibilityIdentifier("practice.skip")
            Text("Skipping keeps this word unfinished. Pause returns Home; you can pick up where you left off.")
                .font(.footnote).foregroundStyle(LucidColour.secondaryOnDark)
        } else {
            VStack(alignment: .leading, spacing: 12) {
                Label(store.hasUnsavedChanges ? "Waiting to save" : (completed ? "Practice saved · +10 XP" : "Let’s learn it together"),
                      systemImage: store.hasUnsavedChanges ? "externaldrive.badge.exclamationmark" : (completed ? "checkmark.circle.fill" : "lightbulb"))
                    .font(.headline).foregroundStyle(LucidColour.mint)
                Text(word.term).font(.system(.largeTitle, design: .serif))
                    .fixedSize(horizontal: false, vertical: true)
                Text(challenge.explanation).font(.body).lineSpacing(4)
                Text(completed ? "This is guided practice. Your next scheduled review will check recall." : "Read the explanation, then Continue to complete guided practice.")
                    .font(.footnote).foregroundStyle(LucidColour.secondaryOnDark)
            }
            .accessibilityElement(children: .combine).accessibilityFocused($feedbackFocused)
            Button {
                player.stop()
                if store.continuePractice(challenge) { onContinue() }
            } label: {
                Label(store.isCurrentPlanComplete && store.isTodayComplete ? "Back to Home" : "Continue", systemImage: "arrow.right").font(.headline)
                    .frame(maxWidth: .infinity, minHeight: 54)
            }
            .buttonStyle(.borderedProminent).tint(LucidColour.mint).foregroundStyle(LucidColour.midnight)
            .disabled(store.hasUnsavedChanges)
            .accessibilityIdentifier("practice.continue")
            .sensoryFeedback(.success, trigger: completed && !store.hasUnsavedChanges)
            ViewThatFits(in: .horizontal) {
                HStack { listenButton; bookmarkButton }
                VStack(alignment: .leading) { listenButton; bookmarkButton }
            }
            DisclosureGroup("Explore this word", isExpanded: $showDetails) {
                VStack(alignment: .leading, spacing: 16) {
                    Text("\(word.partOfSpeech) · \(word.pronunciation)").font(.subheadline)
                    CardDetail(label: "AT WORK", text: word.example)
                    CardDetail(label: "NATURAL PAIRINGS", text: word.collocations.joined(separator: " · "))
                    CardDetail(label: "WHEN IT HELPS", text: word.whenToUse)
                    CardDetail(label: "AVOID", text: word.avoidOrMisuse)
                }.padding(.top, 14)
            }.font(.headline)
        }
    }

    private var listenButton: some View {
        Button { player.speak("\(word.term). \(word.example)", rate: store.data.settings.speechRate) } label: {
            Label("Listen", systemImage: "speaker.wave.2.fill").frame(minHeight: 44)
        }.buttonStyle(.bordered).tint(LucidColour.mint)
    }
    private var bookmarkButton: some View {
        Button { store.toggleFavourite(word.id) } label: {
            Label(store.isFavourite(word.id) ? "Bookmarked" : "Bookmark", systemImage: store.isFavourite(word.id) ? "bookmark.fill" : "bookmark")
                .frame(minHeight: 44)
        }.buttonStyle(.bordered).tint(LucidColour.mint)
            .accessibilityLabel(store.isFavourite(word.id) ? "Remove bookmark for \(word.term)" : "Bookmark \(word.term)")
    }
}

struct OptionalStretchSection: View {
    @EnvironmentObject private var store: LearningStore
    @State private var selectedWordId = ""
    @State private var expanded = false
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("One optional stretch").font(.title2.bold())
            Text("Try one word in your own sentence. Your daily practice is already saved.")
                .font(.body).foregroundStyle(LucidColour.secondaryOnDark)
            Button(expanded ? "Close the stretch" : "Try it in my own words") { expanded.toggle() }
                .buttonStyle(.bordered).frame(minHeight: 44)
            if expanded {
                Picker("Choose a word", selection: $selectedWordId) {
                    ForEach(store.todayWords) { Text($0.term).tag($0.id) }
                }.pickerStyle(.menu)
                if let word = store.todayWords.first(where: { $0.id == selectedWordId }) ?? store.todayWords.first {
                    OptionalSentencePractice(word: word).id(store.practiceAccountToken + (store.profile?.roleId ?? "") + word.id)
                }
            } else {
                Text("No extra points or microphone needed. You can return to this later.")
                    .font(.footnote).foregroundStyle(LucidColour.secondaryOnDark)
            }
        }.padding(22).foregroundStyle(LucidColour.textOnDark)
            .background(LucidColour.surface, in: RoundedRectangle(cornerRadius: 24))
            .onAppear { selectedWordId = store.todayWords.first?.id ?? "" }
            .onChange(of: store.data.currentWordIds) { _, ids in selectedWordId = ids.first ?? "" }
    }
}

struct OptionalSentencePractice: View {
    @EnvironmentObject private var store: LearningStore
    @Environment(\.scenePhase) private var scenePhase
    let word: ProfessionalWord
    @StateObject private var coach = SpeechCoach()
    @State private var result: UsageResult?
    @State private var transcriptBase = ""
    @FocusState private var writingFocused: Bool
    private var draft: Binding<String> {
        Binding(get: { store.draft(for: word.id) }, set: { store.saveDraft($0, wordId: word.id) })
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(word.mission).font(.body)
            ViewThatFits(in: .horizontal) {
                HStack { writeButton; speechButton; starterButton }
                VStack(alignment: .leading) { writeButton; speechButton; starterButton }
            }
            TextEditor(text: draft).focused($writingFocused)
                .disabled(coach.isListening || coach.requestingAccess)
                .frame(minHeight: 112).padding(8).scrollContentBackground(.hidden)
                .background(LucidColour.midnight, in: RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(.white.opacity(0.14)))
                .accessibilityLabel("An optional professional sentence using \(word.term)")
                .accessibilityIdentifier("practice.sentence")
            Text(store.hasUnsavedChanges ? "Waiting to save your sentence." : (draft.wrappedValue.isEmpty ? "Your writing saves on this device. Use fictional workplace details." : "Draft saved on this device. Use fictional workplace details."))
                .font(.footnote).foregroundStyle(LucidColour.secondaryOnDark)
            Button("Check my sentence") {
                let checked = store.evaluate(sentence: draft.wrappedValue, for: word)
                result = checked
                LucidAccessibility.announce(checked.title + ". " + checked.suggestions.joined(separator: " "))
            }.buttonStyle(.bordered).frame(minHeight: 44)
                .disabled(coach.isListening || coach.requestingAccess || draft.wrappedValue.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            Text(coach.status).font(.footnote).foregroundStyle(LucidColour.secondaryOnDark)
            Text("Optional dictation uses Apple speech recognition and may process audio online. Writing works without microphone access.")
                .font(.footnote).foregroundStyle(LucidColour.secondaryOnDark)
            if let result { UsageFeedbackView(result: result) }
        }
        .onChange(of: draft.wrappedValue) { _, _ in result = nil }
        .onChange(of: coach.transcript) { _, transcript in
            if !transcript.isEmpty { store.saveDraft(transcriptBase + transcript, wordId: word.id) }
        }
        .onChange(of: scenePhase) { _, phase in if phase != .active { coach.stop() } }
        .onDisappear { coach.stop() }
    }
    private var writeButton: some View {
        Button("Write") { coach.stop(); writingFocused = true }.buttonStyle(.bordered).frame(minHeight: 44)
    }
    private var speechButton: some View {
        Button {
            writingFocused = false
            if !coach.isListening { transcriptBase = draft.wrappedValue.isEmpty ? "" : draft.wrappedValue + "\n" }
            coach.toggle()
        } label: {
            Label(coach.requestingAccess ? "Cancel microphone request" : (coach.isListening ? "Stop recording" : "Speak"),
                  systemImage: coach.isListening || coach.requestingAccess ? "stop.circle.fill" : "mic.fill")
                .frame(minHeight: 44)
        }.buttonStyle(.bordered)
    }
    private var starterButton: some View {
        Button("Help me start") {
            coach.stop()
            // Never replace the learner’s existing writing.
            if draft.wrappedValue.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                store.saveDraft("In our next discussion, I can use “\(word.term)” to ", wordId: word.id)
            }
            writingFocused = true
        }.buttonStyle(.bordered).frame(minHeight: 44)
    }
}

struct CardDetail: View {
    let label: String
    let text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label).font(.caption2.weight(.bold)).tracking(1).foregroundStyle(LucidColour.mint)
            Text(text).font(.body).fontWeight(.regular).foregroundStyle(LucidColour.textOnDark).lineSpacing(3)
        }
    }
}

struct UsageFeedbackView: View {
    let result: UsageResult

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack {
                Text(result.title).font(.headline)
                Spacer()
            }
            ForEach(result.evidence, id: \.self) { Text("✓ \($0)").font(.subheadline) }
            ForEach(result.suggestions, id: \.self) { Text("→ \($0)").font(.subheadline) }
            Text("On-device pattern check · It cannot reliably judge meaning or grammar like a human coach.")
                .font(.footnote)
                .foregroundStyle(LucidColour.secondaryOnDark)
        }
        .padding(14)
        .foregroundStyle(LucidColour.textOnDark)
        .background(LucidColour.raisedSurface, in: RoundedRectangle(cornerRadius: 12))
        .accessibilityElement(children: .combine)
    }
}
