import Foundation

@MainActor
final class LearningStore: ObservableObject {
    @Published private(set) var catalog: ProfessionalCatalog
    @Published var data: LearnerData {
        didSet { persist() }
    }
    @Published var feedbackStatus: String?

    private static let storageKey = "lucid.learner-data.v1"
    private static let intervals = [1, 3, 7, 14, 30]

    init() {
        do {
            guard let url = Bundle.main.url(forResource: "professional-content", withExtension: "json") else {
                throw CocoaError(.fileNoSuchFile)
            }
            catalog = try JSONDecoder().decode(ProfessionalCatalog.self, from: Data(contentsOf: url))
        } catch {
            fatalError("Lucid could not load its vocabulary catalogue: \(error.localizedDescription)")
        }

        if let saved = UserDefaults.standard.data(forKey: Self.storageKey),
           let decoded = try? JSONDecoder().decode(LearnerData.self, from: saved) {
            data = decoded
        } else {
            data = LearnerData()
        }
    }

    var profile: LearnerProfile? { data.profile }

    var selectedRole: ProfessionalRole? {
        guard let roleId = profile?.roleId else { return nil }
        return catalog.roles.first { $0.id == roleId }
    }

    var todayWords: [ProfessionalWord] {
        data.currentWordIds.compactMap(word)
    }

    var dueWords: [ProfessionalWord] {
        let today = Date().lucidStartOfDay
        return data.progressByWordId
            .filter { $0.value.nextReviewOn.lucidStartOfDay <= today && !$0.value.mastered }
            .compactMap { word(id: $0.key) }
            .sorted { left, right in
                let leftDate = data.progressByWordId[left.id]?.nextReviewOn ?? today
                let rightDate = data.progressByWordId[right.id]?.nextReviewOn ?? today
                return leftDate < rightDate
            }
    }

    var learnedCount: Int { data.progressByWordId.count }
    var masteredCount: Int { data.progressByWordId.values.filter(\.mastered).count }

    var streak: Int {
        let days = Set(data.sessions.map { $0.date.lucidStartOfDay }).sorted(by: >)
        guard let first = days.first else { return 0 }
        let today = Date().lucidStartOfDay
        guard first == today || first == today.lucidAdding(days: -1) else { return 0 }
        var result = 1
        for index in 1..<days.count {
            guard Calendar.current.dateComponents([.day], from: days[index], to: days[index - 1]).day == 1 else { break }
            result += 1
        }
        return result
    }

    var lessonProgress: Double {
        guard !data.currentWordIds.isEmpty else { return 0 }
        let completed = data.currentWordIds.filter(data.completedWordIdsToday.contains).count
        return Double(completed) / Double(data.currentWordIds.count)
    }

    func finishOnboarding(profile: LearnerProfile) {
        data.profile = profile
        prepareToday(force: true)
    }

    func prepareToday(force: Bool = false) {
        guard let profile = data.profile else { return }
        let today = Date().lucidStartOfDay
        if !force,
           let lessonDate = data.currentLessonDate,
           lessonDate.lucidIsSameDay(as: today),
           !data.currentWordIds.isEmpty { return }

        data.completedWordIdsToday = []
        data.currentLessonDate = today

        let introduced = Set(data.introducedWordIds)
        let active = catalog.words.filter { $0.learningMode == "active" }
        let unseen = active.filter { !introduced.contains($0.id) }
        let candidates = unseen.count >= 3 ? unseen : active.filter { !data.currentWordIds.contains($0.id) }
        data.currentWordIds = candidates
            .map { ($0, relevance(of: $0, for: profile)) }
            .sorted {
                if $0.1 != $1.1 { return $0.1 > $1.1 }
                return $0.0.term.localizedCaseInsensitiveCompare($1.0.term) == .orderedAscending
            }
            .prefix(3)
            .map(\.0.id)

        for wordId in data.currentWordIds where !data.introducedWordIds.contains(wordId) {
            data.introducedWordIds.append(wordId)
            data.progressByWordId[wordId] = WordProgress(
                introducedOn: today,
                nextReviewOn: today.lucidAdding(days: Self.intervals[0])
            )
        }
    }

    func markTodayWord(_ wordId: String, quality: ReviewQuality) {
        let now = Date()
        var progress = data.progressByWordId[wordId] ?? WordProgress(
            introducedOn: now.lucidStartOfDay,
            nextReviewOn: now.lucidAdding(days: Self.intervals[0])
        )
        if quality.rawValue >= ReviewQuality.good.rawValue {
            if !progress.successfulReviewDates.contains(where: { $0.lucidIsSameDay(as: now) }) {
                progress.successfulReviewDates.append(now)
            }
            progress.reviewCount += 1
            progress.lastReviewedOn = now
            data.progressByWordId[wordId] = progress
            if !data.completedWordIdsToday.contains(wordId) {
                data.completedWordIdsToday.append(wordId)
            }
        } else if quality == .again {
            progress.lapses += 1
            data.progressByWordId[wordId] = progress
        }
    }

    func review(wordId: String, quality: ReviewQuality, productive: Bool) {
        let now = Date()
        var progress = data.progressByWordId[wordId] ?? WordProgress(
            introducedOn: now.lucidStartOfDay,
            nextReviewOn: now.lucidAdding(days: 1)
        )

        switch quality {
        case .again:
            progress.intervalIndex = 0
            progress.lapses += 1
        case .hard:
            progress.intervalIndex = max(0, progress.intervalIndex - 1)
        case .good:
            progress.intervalIndex = min(Self.intervals.count - 1, progress.intervalIndex + 1)
        case .strong:
            progress.intervalIndex = min(Self.intervals.count - 1, progress.intervalIndex + 2)
        }

        let successful = quality.rawValue >= ReviewQuality.good.rawValue
        if successful && productive && !progress.successfulReviewDates.contains(where: { $0.lucidIsSameDay(as: now) }) {
            progress.successfulReviewDates.append(now)
        }
        progress.reviewCount += 1
        progress.lastReviewedOn = now
        progress.nextReviewOn = now.lucidAdding(days: Self.intervals[progress.intervalIndex])
        let retainedAfterThirtyDays = progress.successfulReviewDates.contains {
            Calendar.current.dateComponents([.day], from: progress.introducedOn, to: $0).day ?? 0 >= 30
        }
        progress.mastered = successful && progress.successfulReviewDates.count >= 3 && retainedAfterThirtyDays
        data.progressByWordId[wordId] = progress
    }

    @discardableResult
    func completeToday() -> Bool {
        let ids = data.currentWordIds
        guard ids.count == 3, ids.allSatisfy(data.completedWordIdsToday.contains) else { return false }
        let today = Date().lucidStartOfDay
        if !data.sessions.contains(where: { $0.date.lucidIsSameDay(as: today) }) {
            data.sessions.append(DailySession(id: UUID(), date: today, wordIds: ids, completedAt: Date()))
        }
        return true
    }

    func shouldRequestReview() -> Bool {
        let count = data.sessions.count
        let milestone = count >= 12 ? 12 : (count >= 5 ? 5 : 0)
        guard milestone > data.reviewPromptMilestone else { return false }
        data.reviewPromptMilestone = milestone
        return true
    }

    func toggleFavourite(_ id: String) {
        if data.favouriteWordIds.contains(id) {
            data.favouriteWordIds.removeAll { $0 == id }
        } else {
            data.favouriteWordIds.append(id)
        }
    }

    func isFavourite(_ id: String) -> Bool { data.favouriteWordIds.contains(id) }

    func evaluate(sentence: String, for word: ProfessionalWord) -> UsageResult {
        let trimmed = sentence.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalized = trimmed.lowercased()
        let found = normalized.range(of: word.term.lowercased()) != nil
        let wordCount = trimmed.split(whereSeparator: \.isWhitespace).count
        let collocation = word.collocations.first { normalized.contains($0.lowercased()) }
        var score = 0
        var evidence: [String] = []
        var suggestions: [String] = []

        if found {
            score += 40
            evidence.append("The target word appears in your sentence.")
        } else {
            suggestions.append("Use “\(word.term)” explicitly.")
        }
        if wordCount >= 7 {
            score += 25
            evidence.append("There is enough context to understand the workplace situation.")
        } else {
            suggestions.append("Add the decision, action, or consequence so the context is clear.")
        }
        if let collocation {
            score += 25
            evidence.append("You used the reference phrase “\(collocation)”.")
        } else {
            suggestions.append("Try a natural pairing such as “\(word.collocations.first ?? word.term)”.")
        }
        if trimmed.last.map({ ".!?".contains($0) }) == true {
            score += 10
        } else {
            suggestions.append("Finish the sentence with punctuation.")
        }

        let title = score >= 80 ? "Strong professional use" : (score >= 55 ? "Promising — refine it" : "Needs more context")
        return UsageResult(score: score, title: title, evidence: evidence, suggestions: suggestions)
    }

    func submitBetaFeedback(rating: Int, helpful: String, confusing: String, missing: String) async {
        guard let roleId = profile?.roleId,
              let url = URL(string: "https://lucid-vocabulary-sunil.sunilkumar-kalabandi.chatgpt.site/api/feedback") else { return }
        feedbackStatus = "Sending…"
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let deviceKey = "lucid.feedback-device-id"
        let deviceId = UserDefaults.standard.string(forKey: deviceKey) ?? UUID().uuidString
        UserDefaults.standard.set(deviceId, forKey: deviceKey)
        request.setValue(deviceId, forHTTPHeaderField: "x-lucid-device-id")
        request.httpBody = try? JSONSerialization.data(withJSONObject: [
            "roleId": roleId,
            "rating": rating,
            "helpful": helpful,
            "confusing": confusing,
            "missing": missing,
        ])
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, 200..<300 ~= http.statusCode else {
                throw URLError(.badServerResponse)
            }
            feedbackStatus = "Thank you — your feedback was sent."
        } catch {
            feedbackStatus = "Feedback could not be sent. Please try again."
        }
    }

    func reset() {
        data = LearnerData()
        UserDefaults.standard.removeObject(forKey: Self.storageKey)
    }

    func word(id: String) -> ProfessionalWord? { catalog.words.first { $0.id == id } }

    private func relevance(of word: ProfessionalWord, for profile: LearnerProfile) -> Int {
        var result = 0
        if word.roles.contains(profile.roleId) { result += 40 }
        result += word.situations.filter(profile.situationIds.contains).count * 12
        result += word.goals.filter(profile.goalIds.contains).count * 9
        if word.seniority.contains(profile.seniorityId) { result += 8 }
        result += word.usefulness == "essential" ? 8 : (word.usefulness == "high" ? 5 : 2)
        return result
    }

    private func persist() {
        guard let encoded = try? JSONEncoder().encode(data) else { return }
        UserDefaults.standard.set(encoded, forKey: Self.storageKey)
    }
}
