import Foundation

/// Local-only, additive v2 sidecar. No existing course goal or account schema changes.
struct DailyVocabularyLocal: Codable, Equatable {
    var version = 1
    var collections: [String: DailyVocabularyCollection] = [:]
    var idiomsByDay: [String: String] = [:]
    var idiomPractice: [String: DailyIdiomPractice] = [:]
    var idiomReviews: [String: DailyIdiomReview] = [:]
}

struct DailyVocabularyCollection: Codable, Equatable {
    let day: String
    let roleId: String
    let wordIds: [String]
    var extraUnlocked = false
    var revealedWordIds: [String] = []
    var drafts: [String: String] = [:]
    var visibleWordIds: [String] { Array(wordIds.prefix(extraUnlocked ? 8 : 5)) }
}

struct DailyIdiomPractice: Codable, Equatable {
    var draft = ""
    var originalResponse: String? = nil
    var revealed = false
    var reviewed: Bool? = nil
}

/// Dates deliberately use shared YYYY-MM-DD learning-day keys, not Foundation instants.
struct DailyIdiomReview: Codable, Equatable {
    let introducedOn: String
    var intervalIndex = 0
    var nextReviewOn: String
    var lastReviewedOn: String? = nil
    var reviewCount = 0
}

struct DailyIdiom: Codable, Identifiable, Equatable {
    let id: String
    let phrase: String
    let meaning: String
    let example: String
    let register: String
    let context: String
    let plainEnglish: String
    var avoid: String? = nil
}

struct DailyIdiomCatalog: Codable {
    let schemaVersion: Int
    let idioms: [DailyIdiom]
    static var bundled: DailyIdiomCatalog? {
        guard let url = Bundle.main.url(forResource: "daily-idioms", withExtension: "json"),
              let bytes = try? Data(contentsOf: url),
              let result = try? JSONDecoder().decode(Self.self, from: bytes),
              result.schemaVersion == 1, !result.idioms.isEmpty,
              Set(result.idioms.map(\.id)).count == result.idioms.count else { return nil }
        return result
    }
}

enum DailyVocabularyEngine {
    static func collectionKey(day: String, roleId: String) -> String { "\(day):\(roleId)" }
    static func idiomPracticeKey(day: String, idiomId: String) -> String { "\(day):\(idiomId)" }
    /// Proleptic Gregorian ISO arithmetic also matches JavaScript for years 0000–0099.
    /// DateFormatter's historical calendar cutover must not change a pinned collection.
    static func dayOrdinal(_ day: String) -> Int? {
        let bytes = Array(day.utf8)
        guard bytes.count == 10, bytes[4] == 45, bytes[7] == 45,
              bytes.enumerated().allSatisfy({ $0.offset == 4 || $0.offset == 7 || (48...57).contains($0.element) }),
              let year = Int(day.prefix(4)), let month = Int(day.dropFirst(5).prefix(2)), let date = Int(day.suffix(2)),
              (1...12).contains(month) else { return nil }
        let leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0)
        let lengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
        guard (1...lengths[month - 1]).contains(date) else { return nil }
        let y = year - (month <= 2 ? 1 : 0)
        let era = Int(floor(Double(y) / 400))
        let yoe = y - era * 400
        let doy = (153 * (month + (month > 2 ? -3 : 9)) + 2) / 5 + date - 1
        return era * 146_097 + yoe * 365 + yoe / 4 - yoe / 100 + doy - 719_468
    }
    static func adding(days: Int, to day: String) -> String? {
        guard let ordinal = dayOrdinal(day) else { return nil }
        let z = ordinal + days + 719_468
        let era = Int(floor(Double(z) / 146_097))
        let doe = z - era * 146_097
        let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365
        var year = yoe + era * 400
        let doy = doe - (365 * yoe + yoe / 4 - yoe / 100)
        let mp = (5 * doy + 2) / 153
        let date = doy - (153 * mp + 2) / 5 + 1
        let month = mp + (mp < 10 ? 3 : -9)
        year += month <= 2 ? 1 : 0
        guard (0...9_999).contains(year) else { return nil }
        return String(format: "%04d-%02d-%02d", year, month, date)
    }
    static func positiveModulo(_ value: Int, _ modulus: Int) -> Int { ((value % modulus) + modulus) % modulus }
    static func roleSalt(_ roleId: String, modulus: Int) -> Int {
        let hash = roleId.utf8.reduce(UInt64(14_695_981_039_346_656_037)) { ($0 ^ UInt64($1)) &* 1_099_511_628_211 }
        return Int(hash % UInt64(modulus))
    }

    /// c1 is an editorial catalogue tag, never a validated learner-level claim.
    /// Sorting and UTF-8 FNV-1a are identical to web; terms and IDs are unique.
    static func wordIds(catalog: ProfessionalCatalog, roleId: String, day: String, excluding: [String]) -> [String] {
        guard let ordinal = dayOrdinal(day) else { return [] }
        let excluded = Set(excluding)
        let eligible = catalog.words.filter { $0.learningMode == "active" && $0.roles.contains(roleId) && !excluded.contains($0.id) }
            .sorted { $0.id < $1.id }
        var ids = Set<String>(); var terms = Set<String>()
        func unique(_ entries: [ProfessionalWord]) -> [ProfessionalWord] {
            entries.filter { word in
                let term = word.term.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                guard !term.isEmpty, !ids.contains(word.id), !terms.contains(term) else { return false }
                ids.insert(word.id); terms.insert(term); return true
            }
        }
        let advanced = unique(eligible.filter { $0.contextualized(for: roleId).difficulty == "c1" })
        let pool = advanced.count >= 8 ? advanced : advanced + unique(eligible)
        guard !pool.isEmpty else { return [] }
        let offset = positiveModulo(ordinal * 8 + roleSalt(roleId, modulus: pool.count), pool.count)
        return (0..<min(8, pool.count)).map { pool[(offset + $0) % pool.count].id }
    }

    static func idiomId(day: String, catalog: DailyIdiomCatalog?) -> String? {
        guard let ordinal = dayOrdinal(day), let idioms = catalog?.idioms, !idioms.isEmpty else { return nil }
        return idioms[positiveModulo(ordinal, idioms.count)].id
    }

    static func prepared(_ local: DailyVocabularyLocal?, catalog: ProfessionalCatalog, idioms: DailyIdiomCatalog?, roleId: String, day: String, excluding: [String]) -> DailyVocabularyLocal? {
        guard dayOrdinal(day) != nil, catalog.roles.contains(where: { $0.id == roleId }), local?.version ?? 1 == 1 else { return local }
        var result = local ?? DailyVocabularyLocal()
        let key = collectionKey(day: day, roleId: roleId)
        if result.collections[key] == nil {
            result.collections[key] = DailyVocabularyCollection(day: day, roleId: roleId,
                wordIds: wordIds(catalog: catalog, roleId: roleId, day: day, excluding: excluding))
        }
        if result.idiomsByDay[day] == nil { result.idiomsByDay[day] = idiomId(day: day, catalog: idioms) }
        return result
    }

    static func isValid(_ local: DailyVocabularyLocal, catalog: ProfessionalCatalog, idioms: DailyIdiomCatalog?) -> Bool {
        guard local.version == 1 else { return false }
        let idiomIds = Set(idioms?.idioms.map(\.id) ?? [])
        for (key, collection) in local.collections {
            guard key == collectionKey(day: collection.day, roleId: collection.roleId), dayOrdinal(collection.day) != nil,
                  catalog.roles.contains(where: { $0.id == collection.roleId }), collection.wordIds.count <= 8,
                  Set(collection.wordIds).count == collection.wordIds.count,
                  Set(collection.revealedWordIds).count == collection.revealedWordIds.count,
                  collection.revealedWordIds.allSatisfy(collection.visibleWordIds.contains),
                  collection.drafts.allSatisfy({ collection.visibleWordIds.contains($0.key) && $0.value.count <= 2_000 }) else { return false }
            let entries = collection.wordIds.compactMap { id in catalog.words.first { $0.id == id && $0.roles.contains(collection.roleId) && $0.learningMode == "active" } }
            guard entries.count == collection.wordIds.count,
                  Set(entries.map { $0.term.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }).count == entries.count else { return false }
        }
        guard local.idiomsByDay.allSatisfy({ dayOrdinal($0.key) != nil && idiomIds.contains($0.value) }) else { return false }
        for (key, practice) in local.idiomPractice {
            let day = String(key.prefix(10)); let id = String(key.dropFirst(11))
            guard key == idiomPracticeKey(day: day, idiomId: id), dayOrdinal(day) != nil, idiomIds.contains(id),
                  practice.draft.count <= 2_000, (practice.originalResponse?.count ?? 0) <= 2_000,
                  !practice.revealed || practice.originalResponse != nil else { return false }
        }
        return local.idiomReviews.allSatisfy { id, review in
            idiomIds.contains(id) && dayOrdinal(review.introducedOn) != nil && dayOrdinal(review.nextReviewOn) != nil
                && review.nextReviewOn >= review.introducedOn && (0...4).contains(review.intervalIndex) && review.reviewCount >= 0
                && (review.lastReviewedOn == nil || (dayOrdinal(review.lastReviewedOn!) != nil && review.lastReviewedOn! >= review.introducedOn))
        }
    }

    /// Only explicit private backup/guest import can merge this sidecar. Local pinning wins.
    static func restoringBackup(local: DailyVocabularyLocal?, incoming: DailyVocabularyLocal?) -> DailyVocabularyLocal? {
        guard let incoming, incoming.version == 1 else { return local }
        guard var result = local, result.version == 1 else { return local == nil ? incoming : local }
        for (key, saved) in incoming.collections {
            guard var own = result.collections[key] else { result.collections[key] = saved; continue }
            if own.wordIds == saved.wordIds {
                own.extraUnlocked = own.extraUnlocked || saved.extraUnlocked
                own.revealedWordIds = Array(Set(own.revealedWordIds + saved.revealedWordIds)).sorted()
                own.drafts = saved.drafts.merging(own.drafts) { saved, own in own.isEmpty ? saved : own }
                result.collections[key] = own
            }
        }
        result.idiomsByDay = incoming.idiomsByDay.merging(result.idiomsByDay) { _, own in own }
        result.idiomPractice = incoming.idiomPractice.merging(result.idiomPractice) { saved, own in
            var merged = own
            if merged.draft.isEmpty { merged.draft = saved.draft }
            // Even an empty frozen original is retained; later editing cannot remove assistance.
            let knownSupported = [own, saved].contains { $0.revealed && ($0.originalResponse ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
            merged.originalResponse = knownSupported ? "" : own.originalResponse ?? saved.originalResponse
            merged.revealed = own.revealed || saved.revealed
            merged.reviewed = (own.reviewed == true || saved.reviewed == true) ? true : own.reviewed ?? saved.reviewed
            return merged
        }
        result.idiomReviews = incoming.idiomReviews.merging(result.idiomReviews) { saved, own in
            DailyIdiomReview(introducedOn: min(own.introducedOn, saved.introducedOn),
                intervalIndex: min(own.intervalIndex, saved.intervalIndex), nextReviewOn: min(own.nextReviewOn, saved.nextReviewOn),
                lastReviewedOn: [own.lastReviewedOn, saved.lastReviewedOn].compactMap { $0 }.max(), reviewCount: max(own.reviewCount, saved.reviewCount))
        }
        return result
    }
}

@MainActor extension LearningStore {
    var dailyVocabularyToken: String { "\(currentDate.lucidDayKey):\(profile?.roleId ?? ""):\(practiceAccountToken)" }
    var dailyIdiomToken: String { "\(currentDate.lucidDayKey):\(profile?.roleId ?? ""):\(practiceAccountToken)" }
    var dailyVocabularyCollection: DailyVocabularyCollection? {
        guard data.dailyVocabulary?.version == 1, let roleId = profile?.roleId else { return nil }
        return data.dailyVocabulary?.collections[DailyVocabularyEngine.collectionKey(day: currentDate.lucidDayKey, roleId: roleId)]
    }
    var dailyVocabularyWords: [ProfessionalWord] { dailyVocabularyCollection?.visibleWordIds.compactMap(word) ?? [] }
    var dailyIdiom: DailyIdiom? {
        guard data.dailyVocabulary?.version == 1, let id = data.dailyVocabulary?.idiomsByDay[currentDate.lucidDayKey] else { return nil }
        return suppliedDailyIdiomCatalog?.idioms.first { $0.id == id }
    }
    var dueDailyIdioms: [DailyIdiom] {
        guard data.dailyVocabulary?.version == 1 else { return [] }
        let day = currentDate.lucidDayKey
        return (suppliedDailyIdiomCatalog?.idioms ?? []).filter { idiom in
            guard let review = dailyIdiomReview(idiom.id) else { return false }
            return review.nextReviewOn <= day && review.lastReviewedOn != day && review.introducedOn < day
        }.sorted { left, right in
            let a = dailyIdiomReview(left.id)!.nextReviewOn; let b = dailyIdiomReview(right.id)!.nextReviewOn
            return a == b ? left.id < right.id : a < b
        }
    }
    private var dailyCanMutate: Bool { (data.dailyVocabulary?.version ?? 1) == 1 && !storageBlocked && !hasUnsavedChanges && !accountBusy && !(cloudRestorePending && profile == nil) }
    private func validDailyToken(_ token: String) -> Bool {
        dailyCanMutate && currentDate.lucidDayKey == clock().lucidDayKey && token == dailyVocabularyToken
    }
    private func validIdiomToken(_ token: String, id: String) -> Bool {
        dailyCanMutate && currentDate.lucidDayKey == clock().lucidDayKey && token == dailyIdiomToken
            && (dailyIdiom?.id == id || dueDailyIdioms.contains { $0.id == id })
    }
    func prepareDailyVocabulary() {
        guard dailyCanMutate, let roleId = profile?.roleId else { return }
        prepareToday()
        guard dailyCanMutate else { return }
        let sidecar = DailyVocabularyEngine.prepared(data.dailyVocabulary, catalog: catalog, idioms: suppliedDailyIdiomCatalog,
            roleId: roleId, day: currentDate.lucidDayKey, excluding: data.currentWordIds)
        if sidecar != data.dailyVocabulary { data.dailyVocabulary = sidecar }
    }
    @discardableResult func unlockDailyVocabularyExtra(token: String) -> Bool {
        guard validDailyToken(token), var collection = dailyVocabularyCollection else { return false }
        if collection.extraUnlocked { return true }
        collection.extraUnlocked = true
        var next = data; next.dailyVocabulary?.collections[DailyVocabularyEngine.collectionKey(day: collection.day, roleId: collection.roleId)] = collection
        data = next; return !hasUnsavedChanges
    }
    func dailyVocabularyDraft(wordId: String) -> String { dailyVocabularyCollection?.drafts[wordId] ?? "" }
    @discardableResult func saveDailyVocabularyDraft(wordId: String, text: String, token: String) -> Bool {
        guard validDailyToken(token), var collection = dailyVocabularyCollection, collection.visibleWordIds.contains(wordId), !collection.revealedWordIds.contains(wordId) else { return false }
        collection.drafts[wordId] = String(text.prefix(2_000))
        var next = data; next.dailyVocabulary?.collections[DailyVocabularyEngine.collectionKey(day: collection.day, roleId: collection.roleId)] = collection
        data = next; return !hasUnsavedChanges
    }
    @discardableResult func revealDailyVocabularyWord(wordId: String, token: String) -> Bool {
        guard validDailyToken(token), var collection = dailyVocabularyCollection, collection.visibleWordIds.contains(wordId) else { return false }
        if collection.revealedWordIds.contains(wordId) { return true }
        collection.revealedWordIds.append(wordId)
        var next = data; next.dailyVocabulary?.collections[DailyVocabularyEngine.collectionKey(day: collection.day, roleId: collection.roleId)] = collection
        markContextExposure(wordId: wordId, in: &next, at: clock())
        data = next; return !hasUnsavedChanges
    }
    func dailyVocabularyWordIsInReview(_ wordId: String) -> Bool {
        guard let roleId = profile?.roleId else { return false }
        return contextHasIntroduction(wordId: wordId, roleId: roleId)
    }
    @discardableResult func addDailyVocabularyWordToReview(wordId: String, token: String) -> Bool {
        guard validDailyToken(token), let collection = dailyVocabularyCollection,
              collection.visibleWordIds.contains(wordId), collection.revealedWordIds.contains(wordId),
              let roleId = profile?.roleId else { return false }
        if dailyVocabularyWordIsInReview(wordId) { return true }
        let now = clock(); var next = data
        var introductions = next.contextIntroducedOn ?? [:]
        introductions["\(wordId)::\(roleId)"] = ContextEvidence.calendarDay(now.lucidDayKey)?.addingTimeInterval(12 * 3600) ?? now
        next.contextIntroducedOn = introductions
        if !next.introducedWordIds.contains(wordId) { next.introducedWordIds.append(wordId) }
        next.progressByWordId[wordId] = next.progressByWordId[wordId] ?? WordProgress(introducedOn: now, nextReviewOn: now.lucidAdding(days: 1))
        data = next; return !hasUnsavedChanges
    }
    func dailyIdiomPractice(_ idiomId: String) -> DailyIdiomPractice? {
        data.dailyVocabulary?.idiomPractice[DailyVocabularyEngine.idiomPracticeKey(day: currentDate.lucidDayKey, idiomId: idiomId)]
    }
    func dailyIdiomReview(_ idiomId: String) -> DailyIdiomReview? { data.dailyVocabulary?.idiomReviews[idiomId] }
    @discardableResult func saveDailyIdiomDraft(id: String, text: String, token: String) -> Bool {
        guard validIdiomToken(token, id: id) else { return false }
        var practice = dailyIdiomPractice(id) ?? DailyIdiomPractice()
        guard !practice.revealed, practice.reviewed != true else { return false }
        practice.draft = String(text.prefix(2_000))
        var next = data; next.dailyVocabulary?.idiomPractice[DailyVocabularyEngine.idiomPracticeKey(day: currentDate.lucidDayKey, idiomId: id)] = practice
        data = next; return !hasUnsavedChanges
    }
    @discardableResult func revealDailyIdiom(id: String, token: String) -> Bool {
        guard validIdiomToken(token, id: id) else { return false }
        var practice = dailyIdiomPractice(id) ?? DailyIdiomPractice()
        if practice.revealed { return true }
        practice.originalResponse = practice.originalResponse ?? practice.draft
        practice.revealed = true
        var next = data; next.dailyVocabulary?.idiomPractice[DailyVocabularyEngine.idiomPracticeKey(day: currentDate.lucidDayKey, idiomId: id)] = practice
        data = next; return !hasUnsavedChanges
    }
    @discardableResult func addDailyIdiomToReview(id: String, token: String) -> Bool {
        guard validIdiomToken(token, id: id), dailyIdiomPractice(id)?.revealed == true else { return false }
        if dailyIdiomReview(id) != nil { return true }
        let day = currentDate.lucidDayKey
        guard let nextDay = DailyVocabularyEngine.adding(days: 1, to: day) else { return false }
        var next = data; next.dailyVocabulary?.idiomReviews[id] = DailyIdiomReview(introducedOn: day, nextReviewOn: nextDay)
        data = next; return !hasUnsavedChanges
    }
    /// Self-assessed spaced recall, never vocabulary mastery, an AI grade or XP.
    @discardableResult func completeDailyIdiomReview(id: String, remembered: Bool, token: String) -> Bool {
        guard validIdiomToken(token, id: id), var review = dailyIdiomReview(id) else { return false }
        let day = currentDate.lucidDayKey
        guard review.introducedOn < day, review.nextReviewOn <= day, review.lastReviewedOn != day else { return false }
        var practice = dailyIdiomPractice(id) ?? DailyIdiomPractice()
        guard practice.revealed, practice.reviewed != true else { return false }
        // The first response is frozen before guidance. Comparing afterwards is
        // allowed; an empty already-revealed response or a retry cannot become recall.
        practice.originalResponse = practice.originalResponse ?? practice.draft
        let independent = !practice.originalResponse!.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        practice.reviewed = true
        let success = remembered && independent
        review.intervalIndex = success ? min(4, review.intervalIndex + 1) : 0
        review.nextReviewOn = DailyVocabularyEngine.adding(days: success ? Self.intervals[review.intervalIndex] : 1, to: day)!
        review.lastReviewedOn = day; review.reviewCount += 1
        var next = data
        next.dailyVocabulary?.idiomPractice[DailyVocabularyEngine.idiomPracticeKey(day: day, idiomId: id)] = practice
        next.dailyVocabulary?.idiomReviews[id] = review
        data = next; return !hasUnsavedChanges
    }
}
