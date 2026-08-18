import StoreKit
import SwiftUI

struct RootView: View {
    @EnvironmentObject private var store: LearningStore

    var body: some View {
        Group {
            if store.profile == nil {
                OnboardingView(catalog: store.catalog)
            } else {
                MainTabView()
            }
        }
        .lucidBackground()
    }
}

struct MainTabView: View {
    var body: some View {
        TabView {
            TodayView()
                .tabItem { Label("Today", systemImage: "sun.max.fill") }
            ReviewView()
                .tabItem { Label("Review", systemImage: "arrow.triangle.2.circlepath") }
            LibraryView()
                .tabItem { Label("Library", systemImage: "books.vertical.fill") }
            InsightsView()
                .tabItem { Label("Progress", systemImage: "chart.line.uptrend.xyaxis") }
            SettingsView()
                .tabItem { Label("Settings", systemImage: "gearshape.fill") }
        }
    }
}

struct OnboardingView: View {
    @EnvironmentObject private var store: LearningStore
    let catalog: ProfessionalCatalog

    @State private var roleId: String
    @State private var seniorityId: String
    @State private var situationIds: Set<String> = []
    @State private var goalIds: Set<String> = []

    init(catalog: ProfessionalCatalog) {
        self.catalog = catalog
        _roleId = State(initialValue: catalog.roles.first?.id ?? "")
        _seniorityId = State(initialValue: catalog.seniorityLevels.first?.id ?? "")
    }

    private var role: ProfessionalRole? { catalog.roles.first { $0.id == roleId } }
    private var canContinue: Bool { !roleId.isEmpty && !seniorityId.isEmpty && !situationIds.isEmpty && !goalIds.isEmpty }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    BrandHeader()

                    VStack(alignment: .leading, spacing: 10) {
                        Text("English for the moments that matter at work.")
                            .font(.system(.largeTitle, design: .serif, weight: .regular))
                            .foregroundStyle(LucidColour.ink)
                        Text("Tell Lucid where you work and how you want to communicate. Your daily lesson will focus on three useful words, not a random list.")
                            .font(.body)
                            .foregroundStyle(LucidColour.muted)
                            .lineSpacing(4)
                    }

                    OnboardingSection(number: "01", title: "Your role") {
                        Picker("Professional role", selection: $roleId) {
                            ForEach(catalog.roles) { role in Text(role.label).tag(role.id) }
                        }
                        .pickerStyle(.menu)
                        Text(role?.description ?? "")
                            .font(.subheadline)
                            .foregroundStyle(LucidColour.muted)
                    }

                    OnboardingSection(number: "02", title: "Your level") {
                        Picker("Seniority", selection: $seniorityId) {
                            ForEach(catalog.seniorityLevels) { level in Text(level.label).tag(level.id) }
                        }
                        .pickerStyle(.menu)
                        if let level = catalog.seniorityLevels.first(where: { $0.id == seniorityId }) {
                            Text(level.communicationFocus)
                                .font(.subheadline)
                                .foregroundStyle(LucidColour.muted)
                        }
                    }

                    OnboardingSection(number: "03", title: "Daily situations") {
                        Text("Choose at least one.")
                            .font(.caption)
                            .foregroundStyle(LucidColour.muted)
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
                            .foregroundStyle(LucidColour.muted)
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

                    Button {
                        store.finishOnboarding(profile: LearnerProfile(
                            roleId: roleId,
                            seniorityId: seniorityId,
                            situationIds: Array(situationIds).sorted(),
                            goalIds: Array(goalIds).sorted()
                        ))
                    } label: {
                        Text("Build my first lesson")
                            .font(.headline)
                            .frame(maxWidth: .infinity, minHeight: 54)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(LucidColour.coral)
                    .foregroundStyle(LucidColour.ink)
                    .disabled(!canContinue)
                    .accessibilityHint("Creates a personalised lesson with three professional words")
                }
                .padding(24)
                .frame(maxWidth: 760)
                .frame(maxWidth: .infinity)
            }
            .background(LucidColour.paper)
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
            }
            content
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.white.opacity(0.72), in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(LucidColour.deepPaper))
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
                    .foregroundStyle(selected ? LucidColour.teal : LucidColour.muted)
                VStack(alignment: .leading, spacing: 4) {
                    Text(title).font(.body.weight(.semibold))
                    Text(subtitle).font(.caption).foregroundStyle(LucidColour.muted).multilineTextAlignment(.leading)
                }
                Spacer()
            }
            .contentShape(Rectangle())
            .padding(.vertical, 5)
        }
        .buttonStyle(.plain)
        .accessibilityValue(selected ? "Selected" : "Not selected")
    }
}

struct BrandHeader: View {
    var body: some View {
        HStack(spacing: 12) {
            Text("L")
                .font(.system(size: 25, weight: .bold, design: .serif).italic())
                .foregroundStyle(.white)
                .frame(width: 44, height: 44)
                .background(LucidColour.teal, in: UnevenRoundedRectangle(topLeadingRadius: 22, bottomLeadingRadius: 8, bottomTrailingRadius: 22, topTrailingRadius: 22))
            VStack(alignment: .leading, spacing: 0) {
                Text("Lucid").font(.system(.title2, design: .serif, weight: .bold))
                Text("PROFESSIONAL VOCABULARY").font(.caption2.weight(.bold)).tracking(1.2).foregroundStyle(LucidColour.muted)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Lucid professional vocabulary")
    }
}

struct TodayView: View {
    @EnvironmentObject private var store: LearningStore
    @Environment(\.requestReview) private var requestReview
    @State private var showCelebration = false

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 20) {
                    DailyHero(
                        role: store.selectedRole,
                        progress: store.lessonProgress,
                        dueCount: store.dueWords.count
                    )

                    ForEach(Array(store.todayWords.enumerated()), id: \.element.id) { index, word in
                        WordLearningCard(word: word, number: index + 1)
                    }

                    Button {
                        if store.completeToday() {
                            showCelebration = true
                            if store.shouldRequestReview() {
                                DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { requestReview() }
                            }
                        }
                    } label: {
                        Label("Complete today’s lesson", systemImage: "checkmark.seal.fill")
                            .font(.headline)
                            .frame(maxWidth: .infinity, minHeight: 52)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(LucidColour.teal)
                    .disabled(store.lessonProgress < 1)
                    .accessibilityHint(store.lessonProgress < 1 ? "Mark all three words as usable first" : "Completes today’s lesson")
                }
                .padding(18)
                .frame(maxWidth: 820)
                .frame(maxWidth: .infinity)
            }
            .background(LucidColour.paper)
            .navigationTitle("Today")
            .navigationBarTitleDisplayMode(.inline)
            .task { store.prepareToday() }
            .alert("Lesson complete", isPresented: $showCelebration) {
                Button("Done", role: .cancel) {}
            } message: {
                Text("You practised three words in professional context. Lucid will bring them back at the right interval.")
            }
        }
    }
}

struct DailyHero: View {
    let role: ProfessionalRole?
    let progress: Double
    let dueCount: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            BrandHeader().colorScheme(.dark)
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
    let word: ProfessionalWord
    let number: Int

    @StateObject private var player = SpeechPlayer()
    @StateObject private var coach = SpeechCoach()
    @State private var draft = ""
    @State private var result: UsageResult?
    @State private var showDetails = true

    private var completed: Bool { store.data.completedWordIdsToday.contains(word.id) }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .top) {
                Text(String(format: "%02d", number))
                    .font(.caption.weight(.bold))
                    .foregroundStyle(LucidColour.coral)
                VStack(alignment: .leading, spacing: 3) {
                    Text(word.term)
                        .font(.system(.largeTitle, design: .serif))
                        .foregroundStyle(LucidColour.ink)
                    Text("\(word.partOfSpeech.uppercased()) · \(word.pronunciation)")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(LucidColour.muted)
                }
                Spacer()
                Button {
                    store.toggleFavourite(word.id)
                } label: {
                    Image(systemName: store.isFavourite(word.id) ? "bookmark.fill" : "bookmark")
                        .frame(width: 44, height: 44)
                }
                .accessibilityLabel(store.isFavourite(word.id) ? "Remove \(word.term) from favourites" : "Save \(word.term) to favourites")
                Button {
                    player.speak("\(word.term). \(word.example)", rate: store.data.settings.speechRate)
                } label: {
                    Image(systemName: "speaker.wave.2.fill").frame(width: 44, height: 44)
                }
                .accessibilityLabel("Hear \(word.term) and its example")
            }

            Text(word.meaning)
                .font(.title3)
                .lineSpacing(4)

            DisclosureGroup("Context and natural usage", isExpanded: $showDetails) {
                VStack(alignment: .leading, spacing: 16) {
                    CardDetail(label: "USE IT LIKE THIS", text: word.example)
                    CardDetail(label: "NATURAL PAIRINGS", text: word.collocations.joined(separator: " · "))
                    CardDetail(label: "WHEN IT HELPS", text: word.whenToUse)
                    CardDetail(label: "AVOID", text: word.avoidOrMisuse)
                    CardDetail(label: "TODAY’S MISSION", text: word.mission)
                }
                .padding(.top, 14)
            }
            .font(.headline)

            VStack(alignment: .leading, spacing: 10) {
                Text("Use it in your work")
                    .font(.headline)
                TextEditor(text: $draft)
                    .frame(minHeight: 96)
                    .padding(8)
                    .scrollContentBackground(.hidden)
                    .background(LucidColour.paper, in: RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(LucidColour.deepPaper))
                    .accessibilityLabel("A professional sentence using \(word.term)")

                HStack {
                    Button {
                        coach.toggle()
                    } label: {
                        Label(coach.isListening ? "Stop" : "Speak", systemImage: coach.isListening ? "stop.circle.fill" : "mic.fill")
                            .frame(minHeight: 44)
                    }
                    .buttonStyle(.bordered)

                    Button("Check my usage") {
                        result = store.evaluate(sentence: draft, for: word)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(LucidColour.teal)
                    .frame(minHeight: 44)
                    .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
                Text(coach.status)
                    .font(.caption)
                    .foregroundStyle(LucidColour.muted)

                if let result {
                    UsageFeedbackView(result: result)
                }
            }

            Button {
                store.markTodayWord(word.id, quality: .good)
            } label: {
                Label(completed ? "Ready for spaced review" : "I can use this word", systemImage: completed ? "checkmark.circle.fill" : "arrow.right.circle.fill")
                    .font(.headline)
                    .frame(maxWidth: .infinity, minHeight: 48)
            }
            .buttonStyle(.borderedProminent)
            .tint(completed ? LucidColour.mint : LucidColour.coral)
            .foregroundStyle(LucidColour.ink)
            .disabled(completed)
        }
        .padding(22)
        .background(.white.opacity(0.82), in: RoundedRectangle(cornerRadius: 22))
        .overlay(RoundedRectangle(cornerRadius: 22).stroke(LucidColour.deepPaper))
        .onChange(of: coach.transcript) { _, transcript in
            if !transcript.isEmpty { draft = transcript }
        }
    }
}

struct CardDetail: View {
    let label: String
    let text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label).font(.caption2.weight(.bold)).tracking(1).foregroundStyle(LucidColour.teal)
            Text(text).font(.body).fontWeight(.regular).foregroundStyle(LucidColour.ink).lineSpacing(3)
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
                Text("\(result.score)/100").font(.headline.monospacedDigit())
            }
            ForEach(result.evidence, id: \.self) { Text("✓ \($0)").font(.subheadline) }
            ForEach(result.suggestions, id: \.self) { Text("→ \($0)").font(.subheadline) }
            Text("On-device pattern check · It cannot reliably judge meaning or grammar like a human coach.")
                .font(.caption2)
                .foregroundStyle(LucidColour.muted)
        }
        .padding(14)
        .background(LucidColour.mint.opacity(0.42), in: RoundedRectangle(cornerRadius: 12))
        .accessibilityElement(children: .combine)
    }
}
