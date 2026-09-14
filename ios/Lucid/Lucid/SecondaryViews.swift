import SwiftUI

struct ReviewView: View {
    @EnvironmentObject private var store: LearningStore
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var savedNotice: String?
    private var reviews: [ProfessionalWord] { store.visibleReviewWords }
    private var roleLabel: String { store.selectedRole?.label ?? "your role" }
    private var emptyMessage: String {
        if let date = store.nextScheduledReview(includeOtherRoles: store.reviewIncludesOtherRoles) {
            return "Your next review in this collection is \(date.formatted(.dateTime.weekday(.wide).day().month(.wide)))."
        }
        let hasLearnedWords = store.data.progressByWordId.keys.contains { id in
            guard let word = store.word(id: id) else { return false }
            return store.reviewIncludesOtherRoles || word.roles.contains(store.profile?.roleId ?? "")
        }
        return hasLearnedWords ? "You’re done with the reviews available here today. Keep practising, and check back tomorrow." : "Practise a word for \(roleLabel) in Today first. Its first review is scheduled for tomorrow."
    }

    var body: some View {
        NavigationStack {
            ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Color.clear.frame(height: 0).id("reviewTop")
                    PracticeStatusBanner()
                    PageHeading(
                        eyebrow: "1 · 3 · 7 · 14 · 30 DAYS",
                        title: "Recall, then move forward.",
                        description: "Recall one word, reveal the answer, then choose a rating to save your review. Words from other roles stay saved under All roles."
                    )
                    VStack(alignment: .leading, spacing: 12) {
                        Text(store.reviewIncludesOtherRoles ? "All roles" : roleLabel).font(.headline).foregroundStyle(LucidColour.mint)
                        Picker("Review collection", selection: $store.reviewIncludesOtherRoles) {
                            Text("My role (\(store.currentRoleDueWords.count))").tag(false)
                            Text("All roles (\(store.dueWords.count))").tag(true)
                        }.pickerStyle(.segmented).accessibilityIdentifier("review.scope")
                        Text(store.reviewIncludesOtherRoles ? "Showing scheduled reviews from all your roles." : "Showing scheduled reviews for \(roleLabel). Changing roles never deletes earlier practice.")
                            .font(.subheadline).foregroundStyle(LucidColour.secondaryOnDark)
                    }
                    if let savedNotice {
                        Label(savedNotice, systemImage: "checkmark.circle.fill")
                            .font(.subheadline).foregroundStyle(LucidColour.mint)
                    }
                    if reviews.isEmpty {
                        EmptyState(
                            icon: "checkmark.circle.fill",
                            title: store.reviewIncludesOtherRoles ? "You’re caught up" : "No reviews due for this role",
                            message: emptyMessage
                        )
                        Button(action: store.openToday) {
                            Label("Go to today’s practice", systemImage: "arrow.right")
                                .frame(maxWidth: .infinity, minHeight: 48)
                        }.buttonStyle(.bordered).tint(LucidColour.mint)
                    } else if let word = reviews.first {
                        Text("\(reviews.count) \(reviews.count == 1 ? "review" : "reviews") remaining")
                            .font(.subheadline.weight(.semibold)).foregroundStyle(LucidColour.secondaryOnDark)
                            .id("reviewCardTop")
                        ReviewCard(word: word) {
                            if store.hasUnsavedChanges {
                                savedNotice = nil
                                LucidAccessibility.announce("Waiting to save your review. Please use Try saving again before closing Lucid.")
                            } else {
                                savedNotice = store.visibleReviewWords.isEmpty ? "Review saved. You’re caught up in this collection." : "Review saved. Here’s the next word."
                                LucidAccessibility.announce("Review saved. \(store.visibleReviewWords.count) reviews remaining in this collection.")
                            }
                        }
                        .id("\(store.profile?.roleId ?? "")-\(store.currentDate.lucidDayKey)-\(word.id)")
                    }
                    if !store.reviewIncludesOtherRoles && !store.otherRoleDueWords.isEmpty {
                        Button {
                            store.reviewIncludesOtherRoles = true
                        } label: {
                            Label("Include \(store.otherRoleDueWords.count) reviews from other roles", systemImage: "rectangle.stack")
                                .frame(maxWidth: .infinity, minHeight: 48)
                        }.buttonStyle(.bordered).tint(LucidColour.mint)
                    }
                }
                .padding(18)
                .frame(maxWidth: 760)
                .frame(maxWidth: .infinity)
            }
            .onChange(of: reviews.first?.id) { _, _ in
                withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.2)) {
                    proxy.scrollTo(reviews.isEmpty || store.hasUnsavedChanges ? "reviewTop" : "reviewCardTop", anchor: .top)
                }
            }
            }
            .background(LucidNightBackground().ignoresSafeArea())
            .navigationTitle("Review")
            .lucidHomeNavigation()
            .lucidKeyboardDismissal()
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(LucidColour.midnight.opacity(0.94), for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .onChange(of: store.profile?.roleId) { _, _ in savedNotice = nil }
            .onChange(of: store.reviewIncludesOtherRoles) { _, _ in savedNotice = nil }
        }
    }
}

struct ReviewCard: View {
    @EnvironmentObject private var store: LearningStore
    let word: ProfessionalWord
    var onSaved: (() -> Void)? = nil
    @AccessibilityFocusState private var answerFocused: Bool
    @AccessibilityFocusState private var questionFocused: Bool
    private var answerWordCount: Int { answer.wrappedValue.split(whereSeparator: \.isWhitespace).count }
    private var revealed: Bool { store.reviewAttempt(for: word.id) != nil }
    private var attemptedIndependently: Bool { store.reviewAttempt(for: word.id)?.independent ?? false }
    private var originalAttempt: String { store.reviewAttempt(for: word.id)?.originalAttempt ?? "" }
    private var draftKey: String { "recall:\(store.currentDate.lucidDayKey):\(word.id)" }
    private var answer: Binding<String> {
        Binding(get: { store.data.practiceDrafts?[draftKey] ?? "" }, set: { value in
            var drafts = store.data.practiceDrafts ?? [:]
            drafts[draftKey] = String(value.prefix(2_000))
            store.data.practiceDrafts = drafts
        })
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("CONTEXT · \(contextLabel)")
                .font(.caption.weight(.semibold)).foregroundStyle(LucidColour.mint)
            if revealed {
                Text(word.term).font(.system(.largeTitle, design: .serif))
                    .accessibilityAddTraits(.isHeader).accessibilityFocused($answerFocused)
                Text(word.meaning).font(.title3)
                CardDetail(label: "REFERENCE EXAMPLE", text: word.example)
                if !originalAttempt.isEmpty {
                    CardDetail(label: "YOUR ATTEMPT", text: originalAttempt)
                }
                Text(attemptedIndependently ? "You recalled the word. Compare your meaning and usage with the example, then rate yourself honestly." : "Independent recall needs the target word in at least five words, without revealing a hint. This attempt is useful practice; choose Again or Hard and try recalling it next time.")
                    .foregroundStyle(LucidColour.secondaryOnDark)
                Text("Choose a rating below to save and move to the next word. Revealing the answer alone does not finish the review.")
                    .font(.subheadline).foregroundStyle(LucidColour.mint)
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 125), spacing: 12)], spacing: 12) {
                    ForEach(ReviewQuality.allCases) { quality in
                        Button {
                            if store.review(wordId: word.id, quality: quality, productive: attemptedIndependently) {
                                onSaved?()
                            }
                        } label: {
                            VStack(spacing: 5) {
                                Text(quality.label).font(.headline)
                                Text(quality == .again ? "Try tomorrow" : (quality == .hard ? "Needed help" : (quality == .good ? "Recalled & used" : "Felt natural")))
                                    .font(.caption)
                            }.frame(maxWidth: .infinity, minHeight: 56)
                        }
                        .buttonStyle(.bordered).tint(LucidColour.mint)
                        .disabled(quality.rawValue >= 2 && !attemptedIndependently)
                    }
                }
            } else {
                Label("RECALL FIRST", systemImage: "brain.head.profile")
                    .font(.caption.weight(.bold)).tracking(1).foregroundStyle(LucidColour.mint)
                Text("Which word fits?").font(.system(.title, design: .serif))
                    .accessibilityAddTraits(.isHeader).accessibilityFocused($questionFocused)
                Text(word.meaning.replacingOccurrences(of: word.term, with: "______", options: [.caseInsensitive]))
                    .font(.title3).lineSpacing(4)
                Text("Recall the word and use it in a workplace sentence of at least five words before you reveal the answer.")
                    .foregroundStyle(LucidColour.secondaryOnDark)
                TextEditor(text: answer)
                    .frame(minHeight: 108).padding(8).scrollContentBackground(.hidden)
                    .background(LucidColour.midnight, in: RoundedRectangle(cornerRadius: 12))
                    .accessibilityLabel("Recall the word and write a workplace sentence")
                    .accessibilityIdentifier("review.answer")
                Text("\(answerWordCount) words · At least 5 needed to check")
                    .font(.caption).foregroundStyle(LucidColour.secondaryOnDark)
                Button {
                    store.revealReview(wordId: word.id, usingHint: false)
                } label: {
                    Text("Check my recall").frame(minHeight: 48)
                }
                .buttonStyle(.borderedProminent).tint(LucidColour.mint).foregroundStyle(LucidColour.midnight)
                .disabled(answerWordCount < 5)
                Button("I don’t remember — show me") {
                    store.revealReview(wordId: word.id, usingHint: true)
                }.font(.subheadline).frame(minHeight: 44)
            }
        }
        .padding(22).foregroundStyle(LucidColour.textOnDark)
        .background(LucidColour.surface, in: RoundedRectangle(cornerRadius: 22))
        .overlay(RoundedRectangle(cornerRadius: 22).stroke(.white.opacity(0.12)))
        .onChange(of: revealed) { _, isRevealed in if isRevealed { answerFocused = true } }
        .onAppear { if !revealed { questionFocused = true } }
    }

    private var contextLabel: String {
        if let role = store.selectedRole, word.roles.contains(role.id) { return role.shortLabel }
        return "Other roles · " + store.catalog.roles.filter { word.roles.contains($0.id) }.map(\.shortLabel).joined(separator: " · ")
    }
}

struct LibraryView: View {
    @EnvironmentObject private var store: LearningStore
    private var words: [ProfessionalWord] { store.visibleLibraryWords }
    private var roleLabel: String { store.selectedRole?.label ?? "Your role" }

    var body: some View {
        NavigationStack {
            List {
                VStack(alignment: .leading, spacing: 10) {
                    Text(store.libraryIncludesOtherRoles ? "All roles" : roleLabel)
                        .font(.system(.title2, design: .serif, weight: .bold))
                        .foregroundStyle(LucidColour.textOnDark)
                    Text(store.libraryIncludesOtherRoles ? "You’re browsing every role’s collection. Choose My role to return to \(roleLabel)." : "Your role’s full collection, not just today’s words. Some vocabulary is shared across professions.")
                        .font(.subheadline).foregroundStyle(LucidColour.secondaryOnDark)
                    Text("\(words.count) \(store.librarySavedOnly ? "saved " : "")\(words.count == 1 ? "word" : "words") shown")
                        .font(.subheadline.weight(.semibold)).foregroundStyle(LucidColour.mint)
                        .accessibilityIdentifier("library.result-count")
                }
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)

                Picker("Library scope", selection: $store.libraryIncludesOtherRoles) {
                    Text("My role").tag(false)
                    Text("All roles").tag(true)
                }
                .pickerStyle(.segmented)
                .listRowBackground(Color.clear)
                .accessibilityIdentifier("library.scope")

                Toggle("Saved words only", isOn: $store.librarySavedOnly)
                    .listRowBackground(LucidColour.surface).tint(LucidColour.mint)
                if words.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text(store.librarySavedOnly ? "No saved words match this collection and search. Turn off Saved words only, or reset to your role to browse words. Your bookmarks from other roles stay saved." : "No words match this collection and search. Try a different search, or reset to your role.")
                            .foregroundStyle(LucidColour.secondaryOnDark)
                        Button("Reset to my role", action: store.resetLibraryFilters)
                            .frame(minHeight: 44).tint(LucidColour.mint)
                            .accessibilityIdentifier("library.reset")
                    }.listRowBackground(LucidColour.surface)
                }
                ForEach(words) { word in
                    NavigationLink {
                        WordDetailView(word: word)
                    } label: {
                        HStack(spacing: 14) {
                            VStack(alignment: .leading, spacing: 5) {
                                Text(word.term)
                                    .font(.system(.title3, design: .serif, weight: .semibold))
                                    .foregroundStyle(LucidColour.textOnDark)
                                Text(word.meaning)
                                    .font(.subheadline)
                                    .foregroundStyle(LucidColour.secondaryOnDark)
                                    .lineLimit(2)
                                if store.libraryIncludesOtherRoles {
                                    Text(store.catalog.roles.filter { word.roles.contains($0.id) }.map(\.shortLabel).joined(separator: " · "))
                                        .font(.caption).foregroundStyle(LucidColour.mint)
                                } else if word.roles.count > 1 {
                                    Text("Shared vocabulary").font(.caption).foregroundStyle(LucidColour.mint)
                                }
                            }
                            Spacer()
                            if store.isFavourite(word.id) { Image(systemName: "bookmark.fill").foregroundStyle(LucidColour.coral) }
                            if store.data.progressByWordId[word.id]?.mastered == true { Image(systemName: "checkmark.seal.fill").foregroundStyle(LucidColour.mint) }
                        }
                        .padding(.vertical, 5)
                    }
                    .listRowBackground(LucidColour.surface)
                    .listRowSeparatorTint(.white.opacity(0.13))
                }
            }
            .scrollContentBackground(.hidden)
            .foregroundStyle(LucidColour.textOnDark)
            .background(LucidNightBackground().ignoresSafeArea())
            .searchable(text: $store.librarySearch, prompt: "Search this collection")
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle("Library")
            .lucidHomeNavigation()
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(LucidColour.midnight.opacity(0.94), for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
        .id(store.libraryNavigationReset)
        .preferredColorScheme(.dark)
    }
}

struct WordDetailView: View {
    @EnvironmentObject private var store: LearningStore
    @StateObject private var player = SpeechPlayer()
    let word: ProfessionalWord

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 5) {
                        Text(word.term)
                            .font(.system(.largeTitle, design: .serif))
                            .foregroundStyle(LucidColour.textOnDark)
                        Text("\(word.partOfSpeech.uppercased()) · \(word.pronunciation)")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(LucidColour.secondaryOnDark)
                    }
                    Spacer()
                    Button { player.speak("\(word.term). \(word.example)", rate: store.data.settings.speechRate) } label: {
                        Image(systemName: "speaker.wave.2.fill").frame(width: 44, height: 44)
                    }
                    .accessibilityLabel("Hear \(word.term) and its example")
                }
                Text(word.meaning).font(.title2).foregroundStyle(LucidColour.textOnDark).lineSpacing(4)
                CardDetail(label: "EXAMPLE", text: word.example)
                CardDetail(label: "NATURAL PAIRINGS", text: word.collocations.joined(separator: " · "))
                CardDetail(label: "WHEN TO USE", text: word.whenToUse)
                CardDetail(label: "AVOID", text: word.avoidOrMisuse)
                CardDetail(label: "PRACTICE MISSION", text: word.mission)
                Button { store.toggleFavourite(word.id) } label: {
                    Label(store.isFavourite(word.id) ? "Remove from favourites" : "Save to favourites", systemImage: store.isFavourite(word.id) ? "bookmark.slash" : "bookmark")
                        .frame(maxWidth: .infinity, minHeight: 48)
                }
                .buttonStyle(.bordered)
                .tint(LucidColour.mint)
            }
            .padding(22)
            .frame(maxWidth: 720)
            .frame(maxWidth: .infinity)
        }
        .background(LucidNightBackground().ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(LucidColour.midnight.opacity(0.94), for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .onDisappear { player.stop() }
    }
}

struct InsightsView: View {
    @EnvironmentObject private var store: LearningStore

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    PracticeStatusBanner()
                    LearningPathSummary()
                    PageHeading(
                        eyebrow: "PROGRESS THAT MEANS USE",
                        title: "Build language you can retrieve.",
                        description: "Real progress is being able to recall a word when you need it. Your practice and honest self-assessment build that habit."
                    )

                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 145), spacing: 12)], spacing: 12) {
                        MetricCard(value: "\(store.streak)", label: "day streak", colour: LucidColour.coral)
                        MetricCard(value: "\(store.learnedCount)", label: "words started", colour: LucidColour.teal)
                        MetricCard(value: "\(store.masteredCount)", label: "words mastered", colour: LucidColour.gold)
                        MetricCard(value: "\(store.data.sessions.count)", label: "lessons completed", colour: LucidColour.mint)
                    }

                    WeeklyPracticeView()
                    VStack(alignment: .leading, spacing: 16) {
                        HStack {
                            Text("Your milestones").font(.title2.bold())
                            Spacer()
                            Text("\(store.totalXP) XP").font(.headline).foregroundStyle(LucidColour.mint)
                        }
                        ForEach(store.achievements) { achievement in
                            HStack(spacing: 16) {
                                Image(systemName: achievement.earned ? achievement.symbol : "lock")
                                    .font(.title2).frame(width: 44, height: 44)
                                    .foregroundStyle(achievement.earned ? LucidColour.mint : LucidColour.secondaryOnDark)
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(achievement.title).font(.headline)
                                    Text(achievement.detail).font(.subheadline).foregroundStyle(LucidColour.secondaryOnDark)
                                }
                                Spacer()
                                if achievement.earned { Image(systemName: "checkmark.circle.fill").foregroundStyle(LucidColour.mint) }
                            }.accessibilityElement(children: .combine)
                                .accessibilityValue(achievement.earned ? "Earned" : "Not yet earned")
                        }
                    }
                    .padding(20).foregroundStyle(LucidColour.textOnDark)
                    .background(LucidColour.surface, in: RoundedRectangle(cornerRadius: 22))

                    VStack(alignment: .leading, spacing: 14) {
                        Text("Your retention system")
                            .font(.title2.weight(.semibold))
                            .foregroundStyle(LucidColour.textOnDark)
                        Text("Lucid schedules independent recall across 1, 3, 7, 14, and 30-day intervals. A word earns the retained milestone after successful recall on three separate days, including one at least 30 days after you first practised it. Ratings are your own self-assessment.")
                            .foregroundStyle(LucidColour.secondaryOnDark)
                            .lineSpacing(4)
                        HStack(spacing: 5) {
                            ForEach([1, 3, 7, 14, 30], id: \.self) { day in
                                Text("\(day)d")
                                    .font(.caption.weight(.bold))
                                    .foregroundStyle(LucidColour.textOnDark)
                                    .frame(maxWidth: .infinity, minHeight: 42)
                                    .background(LucidColour.raisedSurface.opacity(Double(day + 25) / 55), in: RoundedRectangle(cornerRadius: 9))
                            }
                        }
                    }
                    .padding(20)
                    .background(LucidColour.surface, in: RoundedRectangle(cornerRadius: 18))
                    .overlay(RoundedRectangle(cornerRadius: 18).stroke(.white.opacity(0.12)))
                }
                .padding(18)
                .frame(maxWidth: 760)
                .frame(maxWidth: .infinity)
            }
            .background(LucidNightBackground().ignoresSafeArea())
            .navigationTitle("Progress")
            .lucidHomeNavigation()
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(LucidColour.midnight.opacity(0.94), for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
    }
}

struct MetricCard: View {
    let value: String
    let label: String
    let colour: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text(value)
                .font(.system(.largeTitle, design: .serif))
                .foregroundStyle(LucidColour.textOnDark)
                .monospacedDigit()
            Text(label.uppercased())
                .font(.caption2.weight(.bold))
                .tracking(0.7)
                .foregroundStyle(LucidColour.secondaryOnDark)
        }
        .frame(maxWidth: .infinity, minHeight: 112, alignment: .leading)
        .padding(18)
        .background(LucidColour.surface, in: RoundedRectangle(cornerRadius: 17))
        .overlay(RoundedRectangle(cornerRadius: 17).stroke(colour.opacity(0.62), lineWidth: 1.5))
        .accessibilityElement(children: .combine)
    }
}

struct PageHeading: View {
    let eyebrow: String
    let title: String
    let description: String

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text(eyebrow).font(.caption2.weight(.bold)).tracking(1.2).foregroundStyle(LucidColour.mint)
            Text(title).font(.system(.largeTitle, design: .serif)).foregroundStyle(LucidColour.textOnDark)
                .accessibilityAddTraits(.isHeader)
            Text(description).foregroundStyle(LucidColour.secondaryOnDark).lineSpacing(4)
        }
        .padding(.vertical, 8)
    }
}

struct EmptyState: View {
    let icon: String
    let title: String
    let message: String

    var body: some View {
        VStack(spacing: 13) {
            Image(systemName: icon).font(.system(size: 42)).foregroundStyle(LucidColour.mint)
            Text(title).font(.title2.weight(.semibold)).foregroundStyle(LucidColour.textOnDark)
            Text(message).multilineTextAlignment(.center).foregroundStyle(LucidColour.secondaryOnDark)
        }
        .frame(maxWidth: .infinity, minHeight: 260)
        .padding(24)
        .background(LucidColour.surface, in: RoundedRectangle(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(.white.opacity(0.12)))
    }
}
