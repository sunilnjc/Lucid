import Combine
import Foundation
import UserNotifications

@MainActor
final class LearningStore: ObservableObject {
    @Published private(set) var catalog: ProfessionalCatalog
    @Published var data: LearnerData {
        didSet {
            if data.profile?.roleId != oldValue.profile?.roleId {
                reviewIncludesOtherRoles = false
                resetLibraryFilters()
            }
            persist()
        }
    }
    @Published var feedbackStatus: String?
    @Published var isSendingFeedback = false
    @Published var storageNotice: String?
    @Published var storageBlocked = false
    @Published var storageNeedsUpdate = false
    @Published var hasUnsavedChanges = false
    @Published var catalogError: String?
    @Published var currentDate: Date
    @Published var selectedTab = 0 {
        didSet { if selectedTab == 2 && oldValue != 2 { resetLibraryFilters() } }
    }
    @Published var hasEnteredLucid = false
    @Published var reviewIncludesOtherRoles = false
    @Published var libraryIncludesOtherRoles = false
    @Published var librarySearch = ""
    @Published var librarySavedOnly = false
    @Published var libraryNavigationReset = UUID()
    @Published var todayNavigationReset = UUID()
    @Published var session: AccountSession?
    @Published var accountBusy = false
    @Published var accountNotice: String?
    @Published var syncStatus = "Saved on this device"
    @Published var lastSyncedAt: Date?
    @Published var cloudRestorePending = false
    @Published var needsAccountVerification = false

    let persistence: LearningPersistence
    let accountService: AccountService?
    let sessionStorage: AccountSessionStorage
    var scope = "guest" {
        didSet { if scope != oldValue { resetLibraryFilters() } }
    }
    var isApplyingRemote = false
    var syncTask: Task<Void, Never>?
    var isSyncing = false
    var syncAgain = false
    var accountGeneration = UUID()
    var dataRevision = 0
    var clock: () -> Date
    static let intervals = [1, 3, 7, 14, 30]

    func openToday() {
        todayNavigationReset = UUID()
        selectedTab = 0
        hasEnteredLucid = true
    }

    func openHome() { hasEnteredLucid = false; reviewIncludesOtherRoles = false; resetLibraryFilters() }
    func openReview() { reviewIncludesOtherRoles = false; selectedTab = 1; hasEnteredLucid = true }
    func openLibrary() {
        if selectedTab == 2 { resetLibraryFilters() }
        selectedTab = 2
        hasEnteredLucid = true
    }
    func resetLibraryFilters() {
        libraryIncludesOtherRoles = false
        librarySearch = ""
        librarySavedOnly = false
        libraryNavigationReset = UUID()
    }

    init(catalog suppliedCatalog: ProfessionalCatalog? = nil, persistence: LearningPersistence = LearningPersistence(), now: @escaping () -> Date = Date.init, accountService: AccountService? = AccountService.configured(), sessionStorage: AccountSessionStorage = .keychain) {
        self.persistence = persistence
        self.accountService = accountService
        self.sessionStorage = sessionStorage
        clock = now
        currentDate = now()
        if let suppliedCatalog {
            catalog = suppliedCatalog
        } else if let url = Bundle.main.url(forResource: "professional-content", withExtension: "json"),
                  let content = try? Data(contentsOf: url),
                  let decoded = try? JSONDecoder().decode(ProfessionalCatalog.self, from: content),
                  !decoded.roles.isEmpty, !decoded.words.isEmpty {
            catalog = decoded
        } else {
            catalog = ProfessionalCatalog(schemaVersion: 1, roles: [], seniorityLevels: [], goals: [], words: [])
            catalogError = "The word collection could not be opened. Please update Lucid. Your saved learning data has been kept."
        }
        var restoredSession: AccountSession?
        do {
            if accountService != nil, let cached = try sessionStorage.load() {
                if let receipt = try persistence.accountDeletionReceipt(for: cached.user.id) {
                    // Even if Keychain cleanup still fails, never bind this session to UI/data.
                    try? sessionStorage.clear()
                    if receipt.confirmed { try? persistence.remove(scope: cached.user.id.uuidString.lowercased()) }
                    accountNotice = receipt.confirmed ? "Your deleted account has been signed out." : "An earlier deletion request could not be confirmed. Sign in again to check your account."
                } else {
                    restoredSession = cached
                }
            }
        }
        catch { accountNotice = "Your account session could not be restored. Sign in again to reconnect your progress." }
        session = restoredSession
        scope = restoredSession?.user.id.uuidString.lowercased() ?? "guest"
        do {
            let loaded = try persistence.load(scope: scope)
            data = loaded.data
            storageNotice = loaded.notice
        } catch {
            data = LearnerData()
            storageBlocked = true
            if case LearningPersistence.PersistenceError.newerVersion = error { storageNeedsUpdate = true }
            storageNotice = error.localizedDescription
        }
        if session != nil { syncStatus = "Saved on device · waiting to sync" }
        cloudRestorePending = session != nil && data.profile == nil
    }

    var profile: LearnerProfile? { data.profile }
    var selectedRole: ProfessionalRole? { catalog.roles.first { $0.id == profile?.roleId } }
    var learningPath: ProfessionalLearningPath? { learningPath(for: profile?.roleId) }
    private func learningPath(for roleId: String?) -> ProfessionalLearningPath? {
        catalog.learningPaths?.first { path in
            path.roleId == roleId && !path.wordIds.isEmpty && path.wordIds.allSatisfy { id in
                guard let entry = word(id: id) else { return false }
                return entry.learningMode == "active" && entry.roles.contains(path.roleId)
            }
        }
    }
    func pathLesson(for wordId: String) -> ProfessionalPathLesson? {
        learningPath?.lessons.first { $0.wordIds.contains(wordId) }
    }
    var pathCompletedWordCount: Int {
        Set(learningPath?.wordIds ?? []).intersection(data.introducedWordIds).count
    }
    var pathProgress: Double {
        guard let path = learningPath, !path.wordIds.isEmpty else { return 0 }
        return Double(pathCompletedWordCount) / Double(Set(path.wordIds).count)
    }
    var nextPathLesson: ProfessionalPathLesson? {
        guard let path = learningPath else { return nil }
        return orderedModules(in: path, for: data).flatMap(\.lessons)
            .first { lesson in lesson.wordIds.contains { !data.introducedWordIds.contains($0) } }
    }

    func orderedModules(in path: ProfessionalLearningPath, for learner: LearnerData) -> [ProfessionalPathModule] {
        guard let placement = learner.pathPlacements?[path.roleId], placement.pathId == path.id,
              let index = path.modules.firstIndex(where: { $0.id == placement.startingModuleId }) else { return path.modules }
        // A starting point changes sequence only. Earlier content remains available and returns later.
        return Array(path.modules.dropFirst(index)) + Array(path.modules.prefix(index))
    }

    var courseStartingModule: ProfessionalPathModule? {
        guard let path = learningPath, let placement = data.pathPlacements?[path.roleId], placement.pathId == path.id else { return nil }
        return path.modules.first { $0.id == placement.startingModuleId }
    }

    var startingCheckQuestions: [CourseCheckQuestion] {
        guard let questions = learningPath?.startingCheck, questions.count == 6,
              Set(questions.map(\.id)).count == questions.count,
              questions.allSatisfy({ !$0.prompt.isEmpty && !$0.explanation.isEmpty && $0.options.count == 3 && Set($0.options).count == 3 && $0.options.indices.contains($0.correctIndex) }) else { return [] }
        return questions
    }

    var startingCheckAnswers: [Int] {
        guard let path = learningPath, !startingCheckQuestions.isEmpty,
              let draft = data.courseCheckDrafts?[path.roleId], draft.pathId == path.id,
              draft.questionSignature == startingCheckSignature,
              draft.answers.count <= startingCheckQuestions.count,
              draft.answers.allSatisfy({ (-1...2).contains($0) }) else { return [] }
        return draft.answers
    }

    private var startingCheckSignature: String {
        // Stable cache identity only, not a security digest. Bind positional answers to
        // the exact authored questions/options so an app update cannot reinterpret them.
        CourseCheckDraft.signature(for: startingCheckQuestions)
    }

    var startingCheckWasUpdated: Bool {
        guard let path = learningPath, let draft = data.courseCheckDrafts?[path.roleId], !draft.answers.isEmpty else { return false }
        return draft.pathId != path.id || draft.questionSignature != startingCheckSignature
    }

    var startingCheckScore: Int? {
        let questions = startingCheckQuestions, answers = startingCheckAnswers
        guard !questions.isEmpty, answers.count == questions.count else { return nil }
        return zip(questions, answers).filter { $0.correctIndex == $1 }.count
    }

    var suggestedStartingModuleIndex: Int? {
        guard let score = startingCheckScore, let path = learningPath else { return nil }
        let foundationCorrect = zip(startingCheckQuestions.prefix(2), startingCheckAnswers.prefix(2)).allSatisfy { $0.correctIndex == $1 }
        let proposed = foundationCorrect && score >= 4 ? (score == 6 ? 4 : 2) : 0
        return min(proposed, max(0, path.modules.count - 1))
    }

    /// Never replace written work, a completed word, or a day's earned milestone.
    var startingCheckCanReplaceToday: Bool {
        !isTodayComplete && !hasTapWorkToday(roleId: profile?.roleId ?? "") && data.currentWordIds.allSatisfy { id in
            !data.completedWordIdsToday.contains(id) && draft(for: id).trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }
    }

    @discardableResult
    func answerStartingCheck(pathId: String, questionId: String, choice: Int) -> Bool {
        guard !storageBlocked, let path = learningPath, path.id == pathId, (-1...2).contains(choice) else { return false }
        let questions = startingCheckQuestions, answers = startingCheckAnswers
        guard answers.count < questions.count, questions[answers.count].id == questionId else { return false }
        var drafts = data.courseCheckDrafts ?? [:]
        drafts[path.roleId] = CourseCheckDraft(pathId: path.id, answers: answers + [choice], questionSignature: startingCheckSignature)
        data.courseCheckDrafts = drafts
        return !hasUnsavedChanges
    }

    func restartStartingCheck(pathId: String) {
        guard !storageBlocked, let path = learningPath, path.id == pathId else { return }
        var drafts = data.courseCheckDrafts ?? [:]
        drafts[path.roleId] = CourseCheckDraft(pathId: path.id, answers: [], questionSignature: startingCheckSignature)
        data.courseCheckDrafts = drafts
    }

    @discardableResult
    func applyStartingPoint(pathId: String, useSuggested: Bool) -> Bool {
        guard !storageBlocked, let path = learningPath, path.id == pathId,
              let score = startingCheckScore, let suggested = suggestedStartingModuleIndex,
              !path.modules.isEmpty else { return false }
        let index = useSuggested ? suggested : 0
        let replaceToday = startingCheckCanReplaceToday
        let now = clock()
        var next = data
        var placements = next.pathPlacements ?? [:]
        placements[path.roleId] = PathPlacement(pathId: path.id, startingModuleId: path.modules[index].id,
                                               checkedAt: now, correctAnswers: score, questionCount: startingCheckQuestions.count)
        next.pathPlacements = placements
        // Keep the answered check until its result has actually reached durable storage.
        data = normalizedDailyPlan(next, at: now, replacingUnstartedRole: replaceToday ? path.roleId : nil)
        currentDate = now
        return !hasUnsavedChanges
    }
    func pathDraft(for lessonId: String) -> String { data.practiceDrafts?["path:\(lessonId)"] ?? "" }
    func savePathDraft(_ text: String, lessonId: String) {
        guard !storageBlocked, catalog.learningPaths?.contains(where: { $0.lessons.contains { $0.id == lessonId } }) == true else { return }
        var drafts = data.practiceDrafts ?? [:]
        drafts["path:\(lessonId)"] = String(text.prefix(4_000))
        data.practiceDrafts = drafts
    }
    var todayWords: [ProfessionalWord] { data.currentWordIds.compactMap(word) }
    var dailyGoal: Int { min(3, max(1, data.dailyWordGoal ?? 3)) }
    var displayName: String { data.displayName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "" }
    var activities: [LearningActivity] { data.activities ?? [] }
    var todayActivities: [LearningActivity] { activities.filter { $0.dayKey == currentDate.lucidDayKey } }
    var isTodayComplete: Bool { todayActivities.contains { $0.kind == .lesson } || data.sessions.contains { $0.localDayKey == currentDate.lucidDayKey } }
    var isCurrentPlanComplete: Bool { !todayWords.isEmpty && lessonProgress >= 1 && isTodayComplete }
    var practiceDayKeys: Set<String> {
        // A streak measures showing up; difficult reviews still count as study.
        Set(activities.map(\.dayKey))
            .union(data.sessions.map(\.localDayKey))
    }
    var dueWords: [ProfessionalWord] {
        let today = currentDate.lucidStartOfDay
        return data.progressByWordId.filter { $0.value.nextReviewOn.lucidStartOfDay <= today && !reviewedToday($0.key) }
            .compactMap { word(id: $0.key) }.sorted {
                let left = data.progressByWordId[$0.id]?.nextReviewOn ?? today
                let right = data.progressByWordId[$1.id]?.nextReviewOn ?? today
                return left == right ? $0.id < $1.id : left < right
            }
    }
    var nextReviewDate: Date? { data.progressByWordId.values.map(\.nextReviewOn).min() }
    var currentRoleDueWords: [ProfessionalWord] { dueWords.filter { $0.roles.contains(profile?.roleId ?? "") } }
    var otherRoleDueWords: [ProfessionalWord] { dueWords.filter { !$0.roles.contains(profile?.roleId ?? "") } }
    func reviewWords(includeOtherRoles: Bool) -> [ProfessionalWord] { includeOtherRoles ? dueWords : currentRoleDueWords }
    var visibleReviewWords: [ProfessionalWord] { reviewWords(includeOtherRoles: reviewIncludesOtherRoles) }
    func libraryWords(includeOtherRoles: Bool, search: String = "", savedOnly: Bool = false) -> [ProfessionalWord] {
        let query = search.trimmingCharacters(in: .whitespacesAndNewlines)
        return catalog.words.map { $0.contextualized(for: profile?.roleId) }.filter { word in
            let roleMatches = includeOtherRoles || word.roles.contains(profile?.roleId ?? "")
            let queryMatches = query.isEmpty || word.term.localizedCaseInsensitiveContains(query) || word.meaning.localizedCaseInsensitiveContains(query)
            return roleMatches && queryMatches && (!savedOnly || isFavourite(word.id))
        }
    }
    var visibleLibraryWords: [ProfessionalWord] {
        libraryWords(includeOtherRoles: libraryIncludesOtherRoles, search: librarySearch, savedOnly: librarySavedOnly)
    }
    var nextReviewDateForCurrentRole: Date? { nextScheduledReview(includeOtherRoles: false) }
    func nextScheduledReview(includeOtherRoles: Bool) -> Date? {
        data.progressByWordId.compactMap { id, progress -> Date? in
            guard let word = word(id: id), includeOtherRoles || word.roles.contains(profile?.roleId ?? ""),
                  progress.nextReviewOn.lucidStartOfDay > currentDate.lucidStartOfDay else { return nil }
            return progress.nextReviewOn
        }.min()
    }
    func reviewedToday(_ wordId: String) -> Bool {
        data.progressByWordId[wordId]?.lastReviewedOn?.lucidDayKey == currentDate.lucidDayKey
            || todayActivities.contains { $0.kind == .review && $0.wordId == wordId }
    }
    var learnedCount: Int { data.progressByWordId.count }
    var masteredCount: Int { data.progressByWordId.values.filter(\.mastered).count }
    var streak: Int {
        let keys = practiceDayKeys
        var day = currentDate.lucidStartOfDay
        if !keys.contains(day.lucidDayKey) { day = day.lucidAdding(days: -1) }
        var count = 0
        while keys.contains(day.lucidDayKey) { count += 1; day = day.lucidAdding(days: -1) }
        return count
    }
    var totalXP: Int {
        var awards: [String: Int] = [:]
        for event in activities {
            let key = "\(event.dayKey):\(event.kind.rawValue):\(event.wordId ?? "lesson")"
            let points: Int
            switch event.kind {
            case .practice: points = 10
            case .review: points = event.productive && event.quality >= 2 ? 15 : 5
            case .lesson: points = 20
            }
            // Offline devices can submit different answers on the same day. Keep
            // the harder answer's effort credit, independent of event ordering.
            awards[key] = min(awards[key] ?? points, points)
        }
        return awards.values.reduce(0, +)
    }
    var achievements: [LearningAchievement] {
        [
            LearningAchievement(id: "first", title: "First step", detail: "Complete a daily lesson", symbol: "sparkle", earned: !data.sessions.isEmpty),
            LearningAchievement(id: "return", title: "Showing up", detail: "Practise on three different days", symbol: "flame.fill", earned: practiceDayKeys.count >= 3),
            LearningAchievement(id: "voice", title: "Finding your words", detail: "Practise ten different words", symbol: "text.bubble.fill", earned: learnedCount >= 10),
            LearningAchievement(id: "retain", title: "Built to last", detail: "Retain a word for at least 30 days", symbol: "seal.fill", earned: masteredCount > 0)
        ]
    }
    var lessonProgress: Double {
        guard !data.currentWordIds.isEmpty else { return 0 }
        return Double(data.currentWordIds.filter(data.completedWordIdsToday.contains).count) / Double(data.currentWordIds.count)
    }

    @discardableResult
    func finishOnboarding(profile: LearnerProfile, name: String? = nil, goal: Int? = nil) -> Bool {
        guard !(cloudRestorePending && session != nil && data.profile == nil) else {
            accountNotice = "Restore your account first so its existing learning plan stays safe."
            return false
        }
        guard !storageBlocked, let role = catalog.roles.first(where: { $0.id == profile.roleId }),
              catalog.seniorityLevels.contains(where: { $0.id == profile.seniorityId }),
              !profile.situationIds.isEmpty, !profile.goalIds.isEmpty,
              profile.situationIds.allSatisfy({ id in role.situations.contains { $0.id == id } }),
              profile.goalIds.allSatisfy({ id in catalog.goals.contains { $0.id == id } }) else { return false }
        currentDate = clock()
        // Snapshot the old role before replacing its profile, including legacy plans.
        var next = normalizedDailyPlan(data, at: currentDate)
        next.profile = profile
        if let name { next.displayName = String(name.trimmingCharacters(in: .whitespacesAndNewlines).prefix(40)) }
        if let goal { next.dailyWordGoal = min(3, max(1, goal)) }
        next.profileUpdatedAt = currentDate
        data = normalizedDailyPlan(next, at: currentDate)
        return !hasUnsavedChanges
    }

    func refreshDay() { currentDate = clock(); prepareToday() }

    func prepareToday(force: Bool = false) {
        guard !storageBlocked else { return }
        currentDate = clock()
        let next = normalizedDailyPlan(data, at: currentDate)
        if next != data { data = next }
    }

    /// One role/day owns one frozen plan. Safe for local edits, upgrades, backup and sync.
    /// Never uses the store's current profile to interpret an incoming account snapshot.
    func normalizedDailyPlan(_ input: LearnerData, at now: Date, replacingUnstartedRole: String? = nil) -> LearnerData {
        guard let profile = input.profile, catalog.roles.contains(where: { $0.id == profile.roleId }) else { return input }
        let dayKey = now.lucidDayKey
        let sameDay = (input.lessonDayKey ?? input.currentLessonDate?.lucidDayKey) == dayKey
        let introduced = Set(input.introducedWordIds)
        let candidates = catalog.words.filter { $0.learningMode == "active" && $0.roles.contains(profile.roleId) && !introduced.contains($0.id) }
        func valid(_ ids: [String], for roleId: String) -> Bool {
            guard !ids.isEmpty || !catalog.words.contains(where: {
                $0.learningMode == "active" && $0.roles.contains(roleId) && !introduced.contains($0.id)
            }) else { return false }
            return ids.count <= 3 && Set(ids).count == ids.count && ids.allSatisfy { id in
                guard let entry = word(id: id) else { return false }
                return entry.learningMode == "active" && entry.roles.contains(roleId)
            }
        }
        var plans = (input.dailyRolePlans ?? [:]).filter { roleId, plan in
            plan.dayKey == dayKey && catalog.roles.contains { $0.id == roleId } && valid(plan.wordIds, for: roleId)
        }
        // A known current plan can be saved even when a newer profile came from sync.
        if sameDay, let owner = input.lessonRoleId,
           catalog.roles.contains(where: { $0.id == owner }), valid(input.currentWordIds, for: owner) {
            plans[owner] = DailyRolePlan(dayKey: dayKey, wordIds: input.currentWordIds)
        }
        let replacing = replacingUnstartedRole == profile.roleId
        if replacing { plans.removeValue(forKey: profile.roleId) }
        let adoptCurrent = !replacing && sameDay && (input.lessonRoleId == nil || input.lessonRoleId == profile.roleId)
            && valid(input.currentWordIds, for: profile.roleId)
            && (!input.currentWordIds.isEmpty || input.lessonRoleId == profile.roleId || candidates.isEmpty)
        var next = input
        next.currentLessonDate = now.lucidStartOfDay
        next.lessonDayKey = dayKey
        next.lessonRoleId = profile.roleId
        if adoptCurrent {
            next.currentWordIds = input.currentWordIds
        } else if let saved = plans[profile.roleId] {
            next.currentWordIds = saved.wordIds
        } else if let path = learningPath(for: profile.roleId) {
            var seen = Set<String>()
            next.currentWordIds = orderedModules(in: path, for: input).flatMap(\.lessons).flatMap(\.wordIds)
                .filter { !introduced.contains($0) && seen.insert($0).inserted }
                .prefix(min(3, max(1, input.dailyWordGoal ?? 3))).map { $0 }
        } else {
            next.currentWordIds = candidates.sorted {
                let left = relevance(of: $0, for: profile), right = relevance(of: $1, for: profile)
                return left == right ? $0.id < $1.id : left > right
            }.prefix(min(3, max(1, input.dailyWordGoal ?? 3))).map(\.id)
        }
        plans[profile.roleId] = DailyRolePlan(dayKey: dayKey, wordIds: next.currentWordIds)
        next.dailyRolePlans = plans
        let practised = (input.activities ?? []).filter { $0.dayKey == dayKey && $0.kind == .practice }.compactMap(\.wordId)
        let completed = input.sessions.filter { $0.localDayKey == dayKey }.flatMap(\.wordIds)
        // This is the day's credit across ALL roles, not just the three visible cards.
        var seen = Set<String>()
        next.completedWordIdsToday = ((sameDay ? input.completedWordIdsToday : []) + practised + completed)
            .filter { word(id: $0) != nil && seen.insert($0).inserted }
        if !sameDay {
            next.tapPracticeAttempts = (next.tapPracticeAttempts ?? [:]).filter { $0.key.hasPrefix("\(dayKey):") }
            next.practiceCursors = (next.practiceCursors ?? [:]).filter { $0.value.dayKey == dayKey }
            next.practiceDrafts = (next.practiceDrafts ?? [:]).filter { key, _ in
                word(id: key) != nil || key.hasPrefix("recall:\(dayKey):")
                    || (key.hasPrefix("path:") && catalog.learningPaths?.contains(where: { $0.lessons.contains { "path:\($0.id)" == key } }) == true)
            }
            next.reviewAttempts = (next.reviewAttempts ?? [:]).filter { $0.key.hasPrefix("\(dayKey):") }
        }
        return next
    }

    func reviewAttempt(for wordId: String) -> ReviewAttempt? {
        data.reviewAttempts?["\(currentDate.lucidDayKey):\(wordId)"]
    }

    func revealReview(wordId: String, usingHint: Bool) {
        guard !storageBlocked, currentDate.lucidDayKey == clock().lucidDayKey,
              let word = word(id: wordId), dueWords.contains(where: { $0.id == wordId }),
              reviewAttempt(for: wordId) == nil else { return }
        let key = "\(currentDate.lucidDayKey):\(wordId)"
        let sentence = String((data.practiceDrafts?["recall:\(key)"] ?? "").prefix(2_000))
        var attempts = data.reviewAttempts ?? [:]
        attempts[key] = ReviewAttempt(originalAttempt: sentence, independent: !usingHint && hasPracticeContext(sentence, for: word))
        data.reviewAttempts = attempts
    }

    func draft(for wordId: String) -> String { data.practiceDrafts?[wordId] ?? "" }
    func saveDraft(_ draft: String, wordId: String) {
        guard !storageBlocked, word(id: wordId) != nil else { return }
        var drafts = data.practiceDrafts ?? [:]
        drafts[wordId] = String(draft.prefix(2_000))
        data.practiceDrafts = drafts
    }
    func hasPracticeContext(_ sentence: String, for word: ProfessionalWord) -> Bool {
        sentence.split(whereSeparator: \.isWhitespace).count >= 5 && containsTerm(sentence, word: word)
    }
    func containsTerm(_ sentence: String, word: ProfessionalWord) -> Bool {
        let term = word.term.lowercased()
        var forms = [term]
        if !term.contains(" ") {
            forms += [term + "s", term + "ed", term + "ing"]
            if term.hasSuffix("e") { forms += [String(term.dropLast()) + "ed", String(term.dropLast()) + "ing"] }
            if term.hasSuffix("y") { forms += [String(term.dropLast()) + "ies", String(term.dropLast()) + "ied"] }
        } else if word.partOfSpeech == "noun phrase", let space = term.lastIndex(of: " ") {
            let prefix = String(term[...space])
            let noun = String(term[term.index(after: space)...])
            let plural: String
            if noun.hasSuffix("sis") { plural = String(noun.dropLast(2)) + "es" }
            else if noun.hasSuffix("y"), let beforeY = noun.dropLast().last, !"aeiou".contains(beforeY) {
                plural = String(noun.dropLast()) + "ies"
            } else if ["s", "x", "z", "ch", "sh"].contains(where: noun.hasSuffix) {
                plural = noun + "es"
            } else { plural = noun + "s" }
            forms.append(prefix + plural)
        }
        return forms.contains { form in
            sentence.range(of: "(?<![\\p{L}\\p{N}])" + NSRegularExpression.escapedPattern(for: form) + "(?![\\p{L}\\p{N}])", options: [.regularExpression, .caseInsensitive]) != nil
        }
    }

    @discardableResult
    func markTodayWord(_ wordId: String, quality: ReviewQuality) -> Bool {
        guard !storageBlocked, data.lessonDayKey == clock().lucidDayKey,
              data.currentWordIds.contains(wordId), !data.completedWordIdsToday.contains(wordId),
              let word = word(id: wordId), hasPracticeContext(draft(for: wordId), for: word) else { return false }
        let now = clock()
        var next = data
        if !next.introducedWordIds.contains(wordId) { next.introducedWordIds.append(wordId) }
        // Guided practice introduces a word, but is not independent retrieval/mastery.
        next.progressByWordId[wordId] = next.progressByWordId[wordId] ?? WordProgress(introducedOn: now, nextReviewOn: now.lucidAdding(days: 1))
        next.completedWordIdsToday.append(wordId)
        next.activities = activities + [LearningActivity(id: UUID(), kind: .practice, wordId: wordId, date: now, dayKey: now.lucidDayKey, quality: quality.rawValue, productive: false)]
        data = next
        return !hasUnsavedChanges
    }

    @discardableResult
    func review(wordId: String, quality: ReviewQuality, productive: Bool) -> Bool {
        guard !storageBlocked, let existing = data.progressByWordId[wordId], word(id: wordId) != nil else { return false }
        let now = clock()
        guard currentDate.lucidDayKey == now.lucidDayKey,
              existing.nextReviewOn.lucidStartOfDay <= now.lucidStartOfDay,
              !reviewedToday(wordId),
              !activities.contains(where: { $0.kind == .review && $0.wordId == wordId && $0.dayKey == now.lucidDayKey }) else { return false }
        var progress = existing
        let persistedAttempt = data.reviewAttempts?["\(now.lucidDayKey):\(wordId)"]
        let successful = quality.rawValue >= 2 && productive && (persistedAttempt?.independent ?? true)
        let effective = successful ? quality : (quality == .again ? .again : .hard)
        switch effective {
        case .again: progress.intervalIndex = 0; progress.lapses += 1
        case .hard: progress.intervalIndex = max(0, progress.intervalIndex - 1)
        case .good: progress.intervalIndex = min(Self.intervals.count - 1, progress.intervalIndex + 1)
        case .strong: progress.intervalIndex = min(Self.intervals.count - 1, progress.intervalIndex + 2)
        }
        if successful && !progress.successfulReviewDates.contains(where: { $0.lucidDayKey == now.lucidDayKey }) { progress.successfulReviewDates.append(now) }
        progress.reviewCount += 1
        progress.lastReviewedOn = now
        progress.nextReviewOn = now.lucidAdding(days: Self.intervals[min(4, max(0, progress.intervalIndex))])
        // Keep the same conservative per-day rule as cloud merge: one helped
        // answer on another device must not become an independent success later.
        let priorReviewDays = Dictionary(activities.filter { $0.kind == .review && $0.wordId == wordId }
            .map { ($0.dayKey, $0.productive && $0.quality >= 2) }, uniquingKeysWith: { $0 && $1 })
        let successDayKeys = Set(priorReviewDays.filter { $0.value }.map(\.key))
            .union(successful ? [now.lucidDayKey] : [])
        let retainedThirtyDays = (Calendar.current.dateComponents([.day], from: progress.introducedOn.lucidStartOfDay, to: now.lucidStartOfDay).day ?? 0) >= 30
        progress.mastered = successful && successDayKeys.count >= 3 && retainedThirtyDays
        var next = data
        next.progressByWordId[wordId] = progress
        next.activities = activities + [LearningActivity(id: UUID(), kind: .review, wordId: wordId, date: now, dayKey: now.lucidDayKey, quality: effective.rawValue, productive: successful)]
        data = next
        currentDate = now
        return true
    }

    @discardableResult
    func completeToday() -> Bool {
        let now = clock()
        guard !storageBlocked, !hasUnsavedChanges, data.lessonDayKey == now.lucidDayKey, !data.currentWordIds.isEmpty,
              data.currentWordIds.allSatisfy(data.completedWordIdsToday.contains),
              !data.sessions.contains(where: { $0.localDayKey == now.lucidDayKey }),
              !activities.contains(where: { $0.dayKey == now.lucidDayKey && $0.kind == .lesson }) else { return false }
        var next = data
        next.sessions.append(DailySession(id: UUID(), date: now.lucidStartOfDay, wordIds: next.currentWordIds, completedAt: now, dayKey: now.lucidDayKey))
        next.activities = activities + [LearningActivity(id: UUID(), kind: .lesson, wordId: nil, date: now, dayKey: now.lucidDayKey, quality: 2, productive: true)]
        data = next
        return !hasUnsavedChanges
    }

    func shouldRequestReview() -> Bool {
        let count = data.sessions.count
        let milestone = count >= 12 ? 12 : (count >= 5 ? 5 : 0)
        guard milestone > data.reviewPromptMilestone else { return false }
        data.reviewPromptMilestone = milestone
        return true
    }
    func toggleFavourite(_ id: String) {
        guard !storageBlocked, word(id: id) != nil else { return }
        var next = data
        let selected = !next.favouriteWordIds.contains(id)
        if selected { next.favouriteWordIds.append(id) } else { next.favouriteWordIds.removeAll { $0 == id } }
        var changes = next.favouriteChanges ?? [:]
        changes[id] = FavouriteChange(selected: selected, updatedAt: clock())
        next.favouriteChanges = changes
        data = next
    }
    func isFavourite(_ id: String) -> Bool { data.favouriteWordIds.contains(id) }
    func evaluate(sentence: String, for word: ProfessionalWord) -> UsageResult {
        let trimmed = sentence.trimmingCharacters(in: .whitespacesAndNewlines)
        let found = containsTerm(trimmed, word: word)
        let enough = trimmed.split(whereSeparator: \.isWhitespace).count >= 5
        let pairing = word.collocations.first { trimmed.localizedCaseInsensitiveContains($0) }
        var evidence: [String] = [], suggestions: [String] = []
        if found { evidence.append("The target word or a common inflection is present.") } else { suggestions.append("Include “\(word.term)” in your sentence.") }
        if enough { evidence.append("You wrote a complete-length practice attempt.") } else { suggestions.append("Write at least five words with a clear workplace action.") }
        if let pairing { evidence.append("Reference pairing: “\(pairing)”.") } else { suggestions.append("Compare your wording with “\(word.collocations.first ?? word.term)”.") }
        suggestions.append("Check the meaning against the example. This check does not judge grammar or accuracy.")
        return UsageResult(score: (found ? 40 : 0) + (enough ? 30 : 0) + (pairing != nil ? 30 : 0), title: found && enough ? "Ready for your self-check" : "Keep building your sentence", evidence: evidence, suggestions: suggestions)
    }

    @discardableResult
    func submitBetaFeedback(rating: Int, helpful: String, confusing: String, missing: String) async -> Bool {
        guard !isSendingFeedback, let roleId = profile?.roleId, (1...5).contains(rating),
              !helpful.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              let url = URL(string: "https://lucid-vocabulary-sunil.sunilkumar-kalabandi.chatgpt.site/api/feedback") else { return false }
        isSendingFeedback = true
        defer { isSendingFeedback = false }
        feedbackStatus = "Sending…"
        var request = URLRequest(url: url, timeoutInterval: 20)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let deviceKey = "lucid.feedback-device-id"
        let deviceId = UserDefaults.standard.string(forKey: deviceKey) ?? UUID().uuidString
        UserDefaults.standard.set(deviceId, forKey: deviceKey)
        request.setValue(deviceId, forHTTPHeaderField: "x-lucid-device-id")
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["roleId": roleId, "rating": rating, "helpful": String(helpful.prefix(2000)), "confusing": String(confusing.prefix(2000)), "missing": String(missing.prefix(2000))])
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, 200..<300 ~= http.statusCode else { throw URLError(.badServerResponse) }
            feedbackStatus = "Thank you — your feedback was sent."
            return true
        } catch {
            feedbackStatus = "Feedback could not be sent. Your answers are still here; please try again."
            return false
        }
    }

    func retryStorage() {
        if hasUnsavedChanges { persist(); return }
        do {
            let loaded = try persistence.load(scope: scope)
            isApplyingRemote = true
            data = loaded.data
            isApplyingRemote = false
            storageBlocked = false
            storageNeedsUpdate = false
            storageNotice = loaded.notice
            prepareToday()
        } catch {
            if case LearningPersistence.PersistenceError.newerVersion = error { storageNeedsUpdate = true }
            storageNotice = error.localizedDescription
        }
    }
    func reset() {
        guard session == nil else { accountNotice = "Delete your account to erase saved cloud progress."; return }
        do {
            try persistence.remove(scope: scope)
            storageBlocked = false
            data = LearnerData()
            storageNotice = nil
            UserDefaults.standard.removeObject(forKey: "lucid.feedback-device-id")
            ReminderScheduler.cancel()
        } catch { storageNotice = "The data could not be erased. Please try again." }
    }
    func word(id: String) -> ProfessionalWord? { catalog.words.first { $0.id == id }?.contextualized(for: profile?.roleId) }
    private func relevance(of word: ProfessionalWord, for profile: LearnerProfile) -> Int {
        (word.roles.contains(profile.roleId) ? 40 : 0) + word.situations.filter(profile.situationIds.contains).count * 12
            + word.goals.filter(profile.goalIds.contains).count * 9 + (word.seniority.contains(profile.seniorityId) ? 8 : 0)
            + (word.usefulness == "essential" ? 8 : (word.usefulness == "high" ? 5 : 2))
    }
    func persist() {
        guard !isApplyingRemote, !storageBlocked else { return }
        // Track memory mutations even when the disk write fails. An in-flight
        // cloud response must never replace a newer, temporarily unsaved draft.
        dataRevision += 1
        do {
            try persistence.save(data, scope: scope)
            if hasUnsavedChanges { storageNotice = nil }
            hasUnsavedChanges = false
            queueSync()
        } catch {
            hasUnsavedChanges = true
            storageNotice = "Lucid could not save your latest change. Free some device storage and try again before closing the app."
        }
    }
}
