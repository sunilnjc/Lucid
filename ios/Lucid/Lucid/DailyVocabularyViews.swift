import SwiftUI

/// Discovery is a separate destination from the learner's existing course pace and spaced review.
struct DailyLearningOverview: View {
    @AppStorage(LearningLanguage.preferenceKey) private var learningLanguageCode = "en"
    @EnvironmentObject private var store: LearningStore

    private var exploredCount: Int {
        let revealed = Set(store.dailyVocabularyCollection?.revealedWordIds ?? [])
        return store.dailyVocabularyWords.filter { revealed.contains($0.id) }.count
    }
    private var wordCount: Int { store.dailyVocabularyWords.count }
    private var reviewStatus: String {
        let wordCount = store.currentRoleDueWords.count
        let idiomCount = store.dueDailyIdioms.count
        return wordCount + idiomCount == 0 ? learningText("No reviews due") : learningFormat("{count} word + {total} idiom reviews due", ["count": String(wordCount), "total": String(idiomCount)])
    }
    private var idiomOpened: Bool {
        store.dailyIdiom.flatMap { store.dailyIdiomPractice($0.id) }?.revealed == true
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(learningText("Make room for useful language."))
                .font(.system(.title2, design: .serif))
                .accessibilityAddTraits(.isHeader)
            Text(learningText("Discover today. Recall again over time."))
                .font(.subheadline).foregroundStyle(LucidColour.secondaryOnDark)
            NavigationLink {
                DailyVocabularyWordsView(token: store.dailyVocabularyToken)
            } label: {
                DailyDestinationLabel(title: learningText("Today’s Words"), subtitle: learningText("5 words + 3 optional · Useful, precise vocabulary"), status: wordCount == 0 ? learningText("Preparing today’s collection") : learningFormat("{count}/{total} explored", ["count": String(exploredCount), "total": String(wordCount)]), symbol: "text.book.closed")
            }
            .accessibilityIdentifier("today.daily-words")
            NavigationLink {
                DailyIdiomOverviewView(token: store.dailyIdiomToken)
            } label: {
                DailyDestinationLabel(title: learningText("Today’s Idiom"), subtitle: learningText("One expression · Meaning, example and when to use it"), status: store.dailyIdiom == nil ? learningText("Preparing today’s idiom") : (idiomOpened ? learningText("Guidance opened · Recall is separate") : learningText("Ready to explore")), symbol: "quote.bubble")
            }
            .accessibilityIdentifier("today.daily-idiom")
            Button(action: store.openReview) {
                DailyDestinationLabel(title: learningText("Review"), subtitle: learningText("Recall words and idioms already in your schedule"), status: reviewStatus, symbol: "arrow.triangle.2.circlepath")
            }
            .accessibilityIdentifier("today.review")
            if let path = store.learningPath {
                NavigationLink { LearningPathView(path: path) } label: {
                    DailyDestinationLabel(title: learningText("Courses"), subtitle: learningText("Chapters and lessons"), status: "", symbol: "map")
                }
                .accessibilityIdentifier("today.courses")
                .accessibilityHint(learningText("Opens your existing professional course. Daily discovery does not change its pace."))
            }
            LearningCoverageNote()
        }
        .buttonStyle(.plain).foregroundStyle(LucidColour.textOnDark)
        .task(id: store.dailyVocabularyToken) { store.prepareDailyVocabulary() }
    }
}

private struct DailyDestinationLabel: View {
    @AppStorage(LearningLanguage.preferenceKey) private var learningLanguageCode = "en"
    let title: String
    let subtitle: String
    let status: String
    let symbol: String

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            Image(systemName: symbol).font(.system(size: 22)).foregroundStyle(LucidColour.mint)
                .frame(width: 26).accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.headline)
                Text(subtitle).font(.caption).foregroundStyle(LucidColour.secondaryOnDark)
                if !status.isEmpty { Text(status).font(.caption.weight(.medium)).foregroundStyle(LucidColour.mint) }
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right").font(.caption).foregroundStyle(LucidColour.secondaryOnDark)
                .accessibilityHidden(true)
        }
        .padding(14).frame(maxWidth: .infinity, minHeight: 76, alignment: .leading)
        .background(LucidColour.surface, in: RoundedRectangle(cornerRadius: 17))
        .overlay(RoundedRectangle(cornerRadius: 17).stroke(.white.opacity(0.1)))
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

struct DailyVocabularyWordsView: View {
    @AppStorage(LearningLanguage.preferenceKey) private var learningLanguageCode = "en"
    @EnvironmentObject private var store: LearningStore
    let token: String
    @State private var notice: String?
    private var isCurrent: Bool { token == store.dailyVocabularyToken }
    private var revealed: Set<String> { Set(store.dailyVocabularyCollection?.revealedWordIds ?? []) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                PracticeStatusBanner()
                if !isCurrent {
                    DailyCollectionChanged()
                } else if store.dailyVocabularyWords.isEmpty {
                    Text(learningText("Today’s collection is not available yet.")).font(.headline)
                    Text(learningText("Return to Today and try again. Your course and review progress stay saved."))
                        .foregroundStyle(LucidColour.secondaryOnDark)
                    Button { store.prepareDailyVocabulary() } label: {
                        Text(learningText("Retry today’s collection")).frame(minHeight: 44)
                    }.buttonStyle(.bordered)
                } else {
                    VStack(alignment: .leading, spacing: 10) {
                        Text(learningText("5 words, with room for 3 more.")).font(.system(.title2, design: .serif))
                        Text(learningFormat("Useful, precise vocabulary for {role}. These are discovery cards, not a proficiency level or a mastery score.", ["role": learningText(store.selectedRole?.shortLabel ?? "your work")]))
                            .font(.subheadline).foregroundStyle(LucidColour.secondaryOnDark)
                        Text(learningFormat("{count}/{total} explored", ["count": String(store.dailyVocabularyWords.filter { revealed.contains($0.id) }.count), "total": String(store.dailyVocabularyWords.count)]))
                            .font(.subheadline.bold()).foregroundStyle(LucidColour.mint)
                            .accessibilityIdentifier("daily.words-progress")
                        Text(learningText("Your existing course pace is unchanged. Add any word to spaced review when you want to practise it again."))
                            .font(.footnote).foregroundStyle(LucidColour.secondaryOnDark)
                    }
                    ForEach(Array(store.dailyVocabularyWords.enumerated()), id: \.element.id) { index, word in
                        NavigationLink {
                            DailyVocabularyWordView(word: word, number: index + 1, token: token)
                        } label: {
                            DailyDestinationLabel(title: "\(index + 1). \(word.term)", subtitle: learningText(word.partOfSpeech), status: revealed.contains(word.id) ? learningText("Explored · Reopen and compare") : learningText("Try recall, then reveal"), symbol: revealed.contains(word.id) ? "book.fill" : "book.closed")
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("daily.word.\(word.id)")
                    }
                    if store.dailyVocabularyCollection?.extraUnlocked != true {
                        Button {
                            notice = store.unlockDailyVocabularyExtra(token: token) ? nil : dailySaveFailure(store)
                        } label: {
                            Label(learningText("Explore 3 more words"), systemImage: "plus.circle")
                                .font(.headline).frame(maxWidth: .infinity, minHeight: 48)
                        }
                        .buttonStyle(.bordered).tint(LucidColour.mint)
                        .disabled(store.storageBlocked || store.hasUnsavedChanges || store.accountBusy)
                        .accessibilityIdentifier("daily.extra-three")
                        Text(learningText("Optional. The same extra words stay available for the rest of today."))
                            .font(.footnote).foregroundStyle(LucidColour.secondaryOnDark)
                    } else {
                        Label(learningText("All 8 words available for today"), systemImage: "books.vertical")
                            .font(.subheadline).foregroundStyle(LucidColour.mint)
                    }
                    Text(learningText("Daily cards and private recall drafts stay on this device. Exploring a card does not earn review success, mastery or XP."))
                        .font(.footnote).foregroundStyle(LucidColour.secondaryOnDark)
                }
                if let notice { DailySaveNotice(text: notice) }
            }.padding(18).frame(maxWidth: 720).frame(maxWidth: .infinity)
        }
        .dailyPage(title: learningText("Today’s Words"))
    }
}

private struct DailyVocabularyWordView: View {
    @AppStorage(LearningLanguage.preferenceKey) private var learningLanguageCode = "en"
    @EnvironmentObject private var store: LearningStore
    @StateObject private var player = SpeechPlayer()
    let word: ProfessionalWord
    let number: Int
    let token: String
    @State private var notice: String?
    private var isCurrent: Bool { token == store.dailyVocabularyToken }
    private var isRevealed: Bool { store.dailyVocabularyCollection?.revealedWordIds.contains(word.id) == true }
    private var isInReview: Bool { store.dailyVocabularyWordIsInReview(word.id) }
    private var draft: Binding<String> {
        Binding(get: { isCurrent ? store.dailyVocabularyDraft(wordId: word.id) : "" }, set: { value in
            if !store.saveDailyVocabularyDraft(wordId: word.id, text: String(value.prefix(2_000)), token: token) {
                notice = dailySaveFailure(store)
            } else { notice = nil }
        })
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                PracticeStatusBanner()
                if !isCurrent {
                    DailyCollectionChanged()
                } else {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(learningFormat("DAILY DISCOVERY · WORD {number}", ["number": String(number)])).font(.caption.bold()).tracking(0.8).foregroundStyle(LucidColour.mint)
                        Text(word.term).font(.system(.largeTitle, design: .serif)).accessibilityAddTraits(.isHeader)
                        if !word.partOfSpeech.isEmpty { Text(learningText(word.partOfSpeech)).font(.subheadline).foregroundStyle(LucidColour.secondaryOnDark) }
                        if !word.pronunciation.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                            Text(learningFormat("Pronunciation: {pronunciation}", ["pronunciation": word.pronunciation])).font(.subheadline).foregroundStyle(LucidColour.secondaryOnDark)
                        }
                        Button { player.speak(word.term, rate: store.data.settings.speechRate) } label: {
                            Label(learningText("Listen to the word"), systemImage: "speaker.wave.2.fill").frame(minHeight: 44)
                        }.buttonStyle(.bordered).tint(LucidColour.mint)
                    }
                    if !isRevealed {
                        DailyRecallEditor(title: learningText("Try recall before you reveal"), prompt: learningText("What does this mean? Try a short workplace sentence, or reveal to learn it first."), text: draft, identifier: "daily.word-recall")
                        Button {
                            notice = store.revealDailyVocabularyWord(wordId: word.id, token: token) ? nil : dailySaveFailure(store)
                        } label: {
                            Label(learningText("Reveal meaning and example"), systemImage: "eye").font(.headline)
                                .frame(maxWidth: .infinity, minHeight: 48)
                        }.buttonStyle(.borderedProminent).tint(LucidColour.mint).foregroundStyle(LucidColour.midnight)
                            .disabled(store.storageBlocked || store.hasUnsavedChanges || store.accountBusy)
                            .accessibilityIdentifier("daily.word-reveal")
                    } else {
                        DailyGuidanceSection(title: learningText("Meaning"), text: word.meaning)
                        LearningKoreanWordGuidance(wordID: word.id, roleID: store.profile?.roleId ?? "", includesUsage: true)
                        DailyGuidanceSection(title: learningText("Work example"), text: word.example)
                        if !word.whenToUse.isEmpty { DailyGuidanceSection(title: learningText("When to use it"), text: word.whenToUse) }
                        if !word.avoidOrMisuse.isEmpty { DailyGuidanceSection(title: learningText("Use with care"), text: word.avoidOrMisuse) }
                        if !draft.wrappedValue.isEmpty {
                            DailyGuidanceSection(title: learningText("Your original recall"), text: draft.wrappedValue)
                        }
                        Text(learningText("Compare your response with the meaning and example. This is a private self-check; Lucid has not graded it."))
                            .font(.subheadline).foregroundStyle(LucidColour.secondaryOnDark)
                        Button {
                            notice = store.addDailyVocabularyWordToReview(wordId: word.id, token: token) ? nil : dailySaveFailure(store)
                        } label: {
                            Label(isInReview ? learningText("Already in spaced review") : learningText("Add to spaced review"), systemImage: "arrow.triangle.2.circlepath")
                                .font(.headline).frame(maxWidth: .infinity, minHeight: 48)
                        }.buttonStyle(.bordered).tint(LucidColour.mint)
                            .disabled(isInReview || store.storageBlocked || store.hasUnsavedChanges || store.accountBusy)
                            .accessibilityIdentifier("daily.word-add-review")
                        Text(isInReview ? learningText("Your existing review schedule is kept. Find this word in Review when it is due.") : learningText("The first review is scheduled for a later day. Opening this guidance does not count as successful recall or mastery."))
                            .font(.footnote).foregroundStyle(LucidColour.secondaryOnDark)
                    }
                    if let notice { DailySaveNotice(text: notice) }
                    Text(learningText("Private writing saves on this device. Use fictional workplace details."))
                        .font(.footnote).foregroundStyle(LucidColour.secondaryOnDark)
                }
            }.padding(20).frame(maxWidth: 720).frame(maxWidth: .infinity)
        }
        .dailyPage(title: learningText("Daily word"))
        .onDisappear { player.stop() }
    }
}

struct DailyIdiomOverviewView: View {
    @AppStorage(LearningLanguage.preferenceKey) private var learningLanguageCode = "en"
    @EnvironmentObject private var store: LearningStore
    let token: String
    private var isCurrent: Bool { token == store.dailyIdiomToken }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                PracticeStatusBanner()
                if !isCurrent {
                    DailyCollectionChanged()
                } else {
                    Text(learningText("One expression. The right context.")).font(.system(.title2, design: .serif))
                    Text(learningText("Idioms are separate from your 5–8 daily words. Compare the meaning, workplace example and plain-English alternative before using one."))
                        .font(.subheadline).foregroundStyle(LucidColour.secondaryOnDark)
                    if let idiom = store.dailyIdiom {
                        NavigationLink { DailyIdiomPracticeView(idiom: idiom, token: token, isReview: false) } label: {
                            DailyDestinationLabel(title: idiom.phrase, subtitle: learningText("Today’s idiom"), status: store.dailyIdiomPractice(idiom.id)?.revealed == true ? learningText("Guidance opened · Reopen to compare") : learningText("Try recall, then reveal"), symbol: "quote.bubble")
                        }.buttonStyle(.plain).accessibilityIdentifier("daily.idiom-open")
                    } else {
                        Text(learningText("Today’s idiom is not available. Your course and word reviews are still available."))
                            .foregroundStyle(LucidColour.secondaryOnDark)
                    }
                    if !store.dueDailyIdioms.isEmpty {
                        Text(learningText("Idiom review")).font(.headline).accessibilityAddTraits(.isHeader)
                        Text(learningFormat("{count} due · Recall before opening guidance. These self-checks are separate from word mastery.", ["count": String(store.dueDailyIdioms.count)]))
                            .font(.subheadline).foregroundStyle(LucidColour.secondaryOnDark)
                        ForEach(store.dueDailyIdioms) { idiom in
                            NavigationLink { DailyIdiomPracticeView(idiom: idiom, token: token, isReview: true) } label: {
                                DailyDestinationLabel(title: idiom.phrase, subtitle: learningText("Scheduled idiom recall"), status: learningText("Due today"), symbol: "arrow.triangle.2.circlepath")
                            }.buttonStyle(.plain).accessibilityIdentifier("daily.idiom-review.\(idiom.id)")
                        }
                    } else {
                        Text(learningText("No idiom reviews due. You can add today’s idiom after exploring its guidance."))
                            .font(.footnote).foregroundStyle(LucidColour.secondaryOnDark)
                    }
                    Text(learningText("Daily idiom choices and private writing stay on this device."))
                        .font(.footnote).foregroundStyle(LucidColour.secondaryOnDark)
                }
            }.padding(18).frame(maxWidth: 720).frame(maxWidth: .infinity)
        }
        .dailyPage(title: learningText("Today’s Idiom"))
    }
}

/// Mounted in the existing Review destination; word review behavior stays unchanged.
struct DailyIdiomReviewEntry: View {
    @AppStorage(LearningLanguage.preferenceKey) private var learningLanguageCode = "en"
    @EnvironmentObject private var store: LearningStore

    var body: some View {
        if !store.dueDailyIdioms.isEmpty {
            NavigationLink { DailyIdiomReviewsView(token: store.dailyIdiomToken) } label: {
                DailyDestinationLabel(title: learningText("Idiom review"), subtitle: learningText("Private recall self-checks · Separate from word mastery"), status: learningFormat("{count} due", ["count": String(store.dueDailyIdioms.count)]), symbol: "quote.bubble")
            }
            .buttonStyle(.plain).foregroundStyle(LucidColour.textOnDark)
            .accessibilityIdentifier("review.daily-idioms")
        }
    }
}

private struct DailyIdiomReviewsView: View {
    @AppStorage(LearningLanguage.preferenceKey) private var learningLanguageCode = "en"
    @EnvironmentObject private var store: LearningStore
    let token: String

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                PracticeStatusBanner()
                if token != store.dailyIdiomToken {
                    DailyCollectionChanged()
                } else if store.dueDailyIdioms.isEmpty {
                    Text(learningText("No idiom reviews due.")).font(.system(.title2, design: .serif))
                    Text(learningText("Your saved self-checks stay in their schedule. Use Back to return to your word reviews."))
                        .foregroundStyle(LucidColour.secondaryOnDark)
                } else {
                    Text(learningText("Recall an expression in your own words.")).font(.system(.title2, design: .serif))
                    Text(learningFormat("{count} idiom reviews due. Try recall before opening guidance, then compare honestly. This is a self-check, not a grade.", ["count": String(store.dueDailyIdioms.count)]))
                        .font(.subheadline).foregroundStyle(LucidColour.secondaryOnDark)
                    ForEach(store.dueDailyIdioms) { idiom in
                        NavigationLink { DailyIdiomPracticeView(idiom: idiom, token: token, isReview: true) } label: {
                            DailyDestinationLabel(title: idiom.phrase, subtitle: learningText("Scheduled idiom recall"), status: learningText("Due today"), symbol: "arrow.triangle.2.circlepath")
                        }.buttonStyle(.plain).accessibilityIdentifier("review.idiom.\(idiom.id)")
                    }
                }
            }.padding(18).frame(maxWidth: 720).frame(maxWidth: .infinity)
        }
        .dailyPage(title: learningText("Idiom review"))
    }
}

private struct DailyIdiomPracticeView: View {
    @AppStorage(LearningLanguage.preferenceKey) private var learningLanguageCode = "en"
    @EnvironmentObject private var store: LearningStore
    let idiom: DailyIdiom
    let token: String
    let isReview: Bool
    @State private var notice: String?
    @State private var reviewSaved = false
    private var isCurrent: Bool { token == store.dailyIdiomToken }
    private var isRevealed: Bool { store.dailyIdiomPractice(idiom.id)?.revealed == true }
    private var inReview: Bool { store.dailyIdiomReview(idiom.id) != nil }
    private var draft: Binding<String> {
        Binding(get: { isCurrent ? store.dailyIdiomPractice(idiom.id)?.draft ?? "" : "" }, set: { value in
            notice = store.saveDailyIdiomDraft(id: idiom.id, text: String(value.prefix(2_000)), token: token) ? nil : dailySaveFailure(store)
        })
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                PracticeStatusBanner()
                if !isCurrent {
                    DailyCollectionChanged()
                } else {
                    Text(isReview ? learningText("IDIOM REVIEW") : learningText("TODAY’S IDIOM")).font(.caption.bold()).tracking(0.8).foregroundStyle(LucidColour.mint)
                    Text(idiom.phrase).font(.system(.largeTitle, design: .serif)).accessibilityAddTraits(.isHeader)
                    if !isRevealed {
                        DailyRecallEditor(title: learningText("Recall the meaning first"), prompt: learningText("Explain it in plain English, or try a fictional workplace example. You can also reveal to learn it first."), text: draft, identifier: "daily.idiom-recall")
                        Button {
                            notice = store.revealDailyIdiom(id: idiom.id, token: token) ? nil : dailySaveFailure(store)
                        } label: {
                            Label(learningText("Reveal meaning and usage"), systemImage: "eye").font(.headline).frame(maxWidth: .infinity, minHeight: 48)
                        }.buttonStyle(.borderedProminent).tint(LucidColour.mint).foregroundStyle(LucidColour.midnight)
                            .disabled(store.storageBlocked || store.hasUnsavedChanges || store.accountBusy)
                            .accessibilityIdentifier("daily.idiom-reveal")
                    } else {
                        DailyGuidanceSection(title: learningText("Meaning"), text: idiom.meaning)
                        DailyGuidanceSection(title: learningText("Natural example"), text: idiom.example)
                        DailyGuidanceSection(title: learningText("Register"), text: idiom.register)
                        DailyGuidanceSection(title: learningText("When to use it"), text: idiom.context)
                        DailyGuidanceSection(title: learningText("Plain-English alternative"), text: idiom.plainEnglish)
                        if let avoid = idiom.avoid, !avoid.isEmpty { DailyGuidanceSection(title: learningText("Use with care"), text: avoid) }
                        LearningKoreanIdiomGuidance(idiomID: idiom.id)
                        if let original = store.dailyIdiomPractice(idiom.id)?.originalResponse, !original.isEmpty {
                            DailyGuidanceSection(title: learningText("Your original recall"), text: original)
                        }
                        Text(learningText("Compare your original response with this guidance. This is a private self-check, not automatic grading or word mastery."))
                            .font(.subheadline).foregroundStyle(LucidColour.secondaryOnDark)
                        if isReview {
                            idiomReviewActions
                        } else {
                            Button {
                                notice = store.addDailyIdiomToReview(id: idiom.id, token: token) ? nil : dailySaveFailure(store)
                            } label: {
                                Label(inReview ? learningText("Already in idiom review") : learningText("Add to idiom review"), systemImage: "arrow.triangle.2.circlepath")
                                    .font(.headline).frame(maxWidth: .infinity, minHeight: 48)
                            }.buttonStyle(.bordered).tint(LucidColour.mint)
                                .disabled(inReview || store.storageBlocked || store.hasUnsavedChanges || store.accountBusy)
                                .accessibilityIdentifier("daily.idiom-add-review")
                            Text(learningText("Scheduled idioms return here on a later day. Exploring this idiom does not replace any of today’s words."))
                                .font(.footnote).foregroundStyle(LucidColour.secondaryOnDark)
                        }
                    }
                    if let notice { DailySaveNotice(text: notice) }
                    Text(learningText("Private writing saves on this device. Use fictional details."))
                        .font(.footnote).foregroundStyle(LucidColour.secondaryOnDark)
                }
            }.padding(20).frame(maxWidth: 720).frame(maxWidth: .infinity)
        }
        .dailyPage(title: isReview ? learningText("Idiom review") : learningText("Daily idiom"))
    }

    private var idiomReviewActions: some View {
        VStack(alignment: .leading, spacing: 12) {
            if reviewSaved || store.dailyIdiomPractice(idiom.id)?.reviewed == true {
                Label(learningText("Self-check saved · No mastery or XP awarded"), systemImage: "checkmark.circle")
                    .foregroundStyle(LucidColour.mint)
            } else {
                Text(learningText("How did your original recall compare?")).font(.headline)
                Button { saveReview(remembered: true) } label: {
                    Text(learningText("Remembered before revealing")).frame(maxWidth: .infinity, minHeight: 48)
                }
                .buttonStyle(.borderedProminent).tint(LucidColour.mint).foregroundStyle(LucidColour.midnight)
                .disabled(!hasOriginalRecall || store.storageBlocked || store.hasUnsavedChanges || store.accountBusy)
                .accessibilityIdentifier("daily.idiom-remembered")
                Button { saveReview(remembered: false) } label: {
                    Text(learningText("Needs another look")).frame(maxWidth: .infinity, minHeight: 48)
                }
                .buttonStyle(.bordered).tint(LucidColour.mint)
                .disabled(store.storageBlocked || store.hasUnsavedChanges || store.accountBusy)
                .accessibilityIdentifier("daily.idiom-again")
                if !hasOriginalRecall {
                    Text(learningText("Guidance opened without an original recall response. Choose Needs another look to practise again later."))
                        .font(.footnote).foregroundStyle(LucidColour.secondaryOnDark)
                }
            }
        }
    }

    private var hasOriginalRecall: Bool {
        !(store.dailyIdiomPractice(idiom.id)?.originalResponse ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func saveReview(remembered: Bool) {
        let saved = store.completeDailyIdiomReview(id: idiom.id, remembered: remembered, token: token)
        reviewSaved = saved
        notice = saved ? nil : (store.storageNotice ?? learningText("To record remembered recall, write an original response before revealing on a later review day. Otherwise choose Needs another look. A self-check can be saved only once today."))
    }
}

private struct DailyRecallEditor: View {
    @AppStorage(LearningLanguage.preferenceKey) private var learningLanguageCode = "en"
    @EnvironmentObject private var store: LearningStore
    let title: String
    let prompt: String
    @Binding var text: String
    let identifier: String

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title).font(.headline)
            Text(prompt).font(.subheadline).foregroundStyle(LucidColour.secondaryOnDark)
            TextEditor(text: $text).scrollContentBackground(.hidden)
                .disabled(store.storageBlocked || store.hasUnsavedChanges || store.accountBusy)
                .padding(10).frame(minHeight: 120)
                .background(LucidColour.midnight, in: RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(.white.opacity(0.2)))
                .accessibilityLabel(title).accessibilityHint(learningText("Optional private recall. Saved on this device, not graded."))
                .accessibilityIdentifier(identifier)
            Text(store.hasUnsavedChanges ? learningText("Waiting to save — use Try saving again above.") : learningFormat("Optional · {count}/2,000 characters · Saved privately on this device", ["count": String(text.count)]))
                .font(.caption).foregroundStyle(LucidColour.secondaryOnDark)
        }
    }
}

private struct DailyGuidanceSection: View {
    @AppStorage(LearningLanguage.preferenceKey) private var learningLanguageCode = "en"
    let title: String
    let text: String
    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(title).font(.subheadline.weight(.semibold)).foregroundStyle(LucidColour.mint)
                .accessibilityAddTraits(.isHeader)
            Text(text).font(.body).fixedSize(horizontal: false, vertical: true)
        }.frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct DailyCollectionChanged: View {
    @AppStorage(LearningLanguage.preferenceKey) private var learningLanguageCode = "en"
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(learningText("This daily collection has changed.")).font(.headline)
            Text(learningText("The date, role or account changed. Use Back to return to Today and open the current collection. Earlier saved writing stays with its original collection."))
                .foregroundStyle(LucidColour.secondaryOnDark)
        }
    }
}

private struct DailySaveNotice: View {
    @AppStorage(LearningLanguage.preferenceKey) private var learningLanguageCode = "en"
    let text: String
    var body: some View {
        Label(text, systemImage: "exclamationmark.circle")
            .font(.subheadline).foregroundStyle(LucidColour.coral)
            .accessibilityIdentifier("daily.save-error")
    }
}

@MainActor private func dailySaveFailure(_ store: LearningStore) -> String {
    store.storageNotice ?? store.accountNotice ?? learningText("This change could not be saved. The date, role or account may have changed. Return to Today, then reopen the current collection.")
}

private extension View {
    func dailyPage(title: String) -> some View {
        self.foregroundStyle(LucidColour.textOnDark).lucidBackground()
            .lucidKeyboardDismissal()
            .navigationTitle(title).navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(LucidColour.midnight, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar).toolbarColorScheme(.dark, for: .navigationBar)
    }
}


/// A device preference only: changing it preserves the current view, recall drafts and learner IDs.
struct LearningLanguagePicker: View {
    @AppStorage(LearningLanguage.preferenceKey) private var learningLanguageCode = "en"
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Picker(learningText("Learning language"), selection: Binding(
                get: { LearningLanguage(preference: learningLanguageCode).rawValue },
                set: { learningLanguageCode = $0 }
            )) {
                ForEach(LearningLanguage.allCases, id: \.rawValue) { language in
                    Text(language.label).tag(language.rawValue)
                }
            }
            .pickerStyle(.segmented)
            .accessibilityIdentifier("learning.language")
            .accessibilityLabel(learningText("Learning language"))
            Text(learningText("Language changes do not change your progress or private drafts."))
                .font(.caption).foregroundStyle(LucidColour.secondaryOnDark)
        }
    }
}

struct LearningCoverageNote: View {
    @AppStorage(LearningLanguage.preferenceKey) private var learningLanguageCode = "en"
    var body: some View {
        if LearningLanguage(preference: learningLanguageCode) == .ko {
            if !LearningLocalization.shared.locales.contains("ko") {
                Text("Korean support could not be loaded. English is shown; your progress is unchanged.")
                    .font(.caption).foregroundStyle(LucidColour.coral)
                    .accessibilityIdentifier("learning.resource-unavailable")
            }
            Text(learningText("Korean support covers navigation, setup, daily words, idioms and review guidance. Course questions, Express, Library, Progress, account controls, detailed settings, privacy and support remain in English."))
                .font(.caption).foregroundStyle(LucidColour.secondaryOnDark)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityIdentifier("learning.coverage")
        }
    }
}

struct LearningKoreanWordGuidance: View {
    @AppStorage(LearningLanguage.preferenceKey) private var learningLanguageCode = "en"
    let wordID: String
    let roleID: String
    var includesUsage = false
    var body: some View {
        if LearningLanguage(preference: learningLanguageCode) == .ko {
            if let support = LearningLocalization.shared.word(id: wordID, roleID: roleID, language: .ko) {
                DailyGuidanceSection(title: learningText("Korean meaning"), text: support.meaning)
                if includesUsage, let usage = support.usage, !usage.isEmpty {
                    DailyGuidanceSection(title: learningText("Korean usage note"), text: usage)
                }
            } else {
                Text(learningText("English guidance is shown for this item. Korean support is not available yet."))
                    .font(.caption).foregroundStyle(LucidColour.secondaryOnDark)
            }
        }
    }
}

struct LearningKoreanIdiomGuidance: View {
    @AppStorage(LearningLanguage.preferenceKey) private var learningLanguageCode = "en"
    let idiomID: String
    var body: some View {
        if LearningLanguage(preference: learningLanguageCode) == .ko {
            if let support = LearningLocalization.shared.idiom(id: idiomID, language: .ko) {
                VStack(alignment: .leading, spacing: 16) {
                    Text(learningText("Korean explanation")).font(.headline)
                    DailyGuidanceSection(title: learningText("Meaning"), text: support.meaning)
                    DailyGuidanceSection(title: learningText("Register"), text: support.register)
                    DailyGuidanceSection(title: learningText("When to use it"), text: support.context)
                    DailyGuidanceSection(title: learningText("Plain-English alternative"), text: support.plainEnglish)
                    if let avoid = support.avoid, !avoid.isEmpty { DailyGuidanceSection(title: learningText("Use with care"), text: avoid) }
                }
                .padding(16).background(LucidColour.raisedSurface, in: RoundedRectangle(cornerRadius: 16))
                .accessibilityIdentifier("learning.korean-idiom")
            } else {
                Text(learningText("English guidance is shown for this item. Korean support is not available yet."))
                    .font(.caption).foregroundStyle(LucidColour.secondaryOnDark)
            }
        }
    }
}
