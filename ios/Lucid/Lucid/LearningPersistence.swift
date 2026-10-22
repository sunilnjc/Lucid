import Foundation

/// A versioned, atomic record and last known good backup, protected by iOS Data Protection.
struct LearningPersistence {
    private struct Header: Decodable { let version: Int }
    // Read a future sidecar's version before decoding its unknown payload shape.
    private struct DailyVersionHeader: Decodable {
        struct Learner: Decodable {
            struct Feature: Decodable { let version: Int }
            let dailyVocabulary: Feature?
        }
        let learner: Learner
    }
    struct Envelope: Codable {
        let version: Int
        let learner: LearnerData
        var webLearningBackup: StudioJSONValue? = nil
    }
    struct Loaded {
        let data: LearnerData
        let notice: String?
    }
    struct AccountDeletionReceipt: Codable {
        let userID: UUID
        let confirmed: Bool
    }
    let directory: URL
    private let manager = FileManager.default

    init(directory: URL? = nil) {
        self.directory = directory ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Lucid", isDirectory: true)
    }

    func file(for scope: String) -> URL {
        // Scopes are internal UUIDs or the literal guest; never use an email or path from a server.
        let safe = UUID(uuidString: scope)?.uuidString.lowercased() ?? "guest"
        return directory.appendingPathComponent("learner-\(safe).json")
    }

    private func deletionFile(for userID: UUID) -> URL {
        directory.appendingPathComponent("account-deletion-\(userID.uuidString.lowercased()).json")
    }

    func accountDeletionReceipt(for userID: UUID) throws -> AccountDeletionReceipt? {
        let url = deletionFile(for: userID)
        guard manager.fileExists(atPath: url.path) else { return nil }
        let receipt = try JSONDecoder().decode(AccountDeletionReceipt.self, from: Data(contentsOf: url))
        guard receipt.userID == userID else { throw PersistenceError.unreadable }
        return receipt
    }

    /// Write before the network request. A lost response must never restore this session
    /// automatically; fresh email verification can recover a request that did not succeed.
    func markAccountDeletion(userID: UUID, confirmed: Bool) throws {
        try manager.createDirectory(at: directory, withIntermediateDirectories: true)
        let receipt = AccountDeletionReceipt(userID: userID, confirmed: confirmed)
        try JSONEncoder().encode(receipt).write(to: deletionFile(for: userID), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }

    /// Only a new verified session for this same UUID may cancel an unconfirmed request.
    func recoverUnconfirmedAccountDeletion(userID: UUID) throws {
        guard let receipt = try accountDeletionReceipt(for: userID) else { return }
        guard !receipt.confirmed else { throw AccountError.sessionExpired }
        try manager.removeItem(at: deletionFile(for: userID))
    }

    func load(scope: String) throws -> Loaded {
        let url = file(for: scope)
        let backup = url.appendingPathExtension("backup")
        guard manager.fileExists(atPath: url.path) || manager.fileExists(atPath: backup.path) else {
            if scope == "guest", let legacy = UserDefaults.standard.data(forKey: "lucid.learner-data.v1") {
                var decoded = try JSONDecoder().decode(LearnerData.self, from: legacy)
                decoded.schemaVersion = 2
                try save(decoded, scope: scope)
                UserDefaults.standard.removeObject(forKey: "lucid.learner-data.v1")
                return Loaded(data: decoded, notice: nil)
            }
            return Loaded(data: LearnerData(), notice: nil)
        }
        do {
            return Loaded(data: try decode(url), notice: nil)
        } catch PersistenceError.newerVersion {
            throw PersistenceError.newerVersion
        } catch {
            do {
                let recovered = try decode(backup)
                return Loaded(data: recovered, notice: "Your last saved backup was recovered. Your most recent change may need to be repeated.")
            } catch PersistenceError.newerVersion {
                // A damaged primary must not make a future-version backup
                // eligible for a destructive downgrade through import recovery.
                throw PersistenceError.newerVersion
            } catch {
                // Never replace an unreadable record with an empty account.
                throw PersistenceError.unreadable
            }
        }
    }

    private func decode(_ url: URL) throws -> LearnerData {
        let bytes = try Data(contentsOf: url)
        guard try JSONDecoder().decode(Header.self, from: bytes).version == 2 else { throw PersistenceError.newerVersion }
        if let version = try JSONDecoder().decode(DailyVersionHeader.self, from: bytes).learner.dailyVocabulary?.version, version != 1 { throw PersistenceError.newerVersion }
        let envelope = try JSONDecoder().decode(Envelope.self, from: bytes)
        var learner = envelope.learner
        if let shared = learner.sharedLearning, shared.version != 1 { throw PersistenceError.newerVersion }
        if let shared = learner.sharedLearning, !shared.isValid { throw PersistenceError.unreadable }
        learner.portableWebCompanion = envelope.webLearningBackup ?? learner.portableWebCompanion
        return learner
    }

    func save(_ data: LearnerData, scope: String) throws {
        try manager.createDirectory(at: directory, withIntermediateDirectories: true)
        let url = file(for: scope)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let encoded = try encoder.encode(Envelope(version: 2, learner: data))
        // A corrupt primary must never replace the last valid backup.
        if let old = try? Data(contentsOf: url), (try? JSONDecoder().decode(Envelope.self, from: old))?.version == 2 {
            try old.write(to: url.appendingPathExtension("backup"), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        }
        try encoded.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }

    func remove(scope: String) throws {
        let url = file(for: scope)
        for candidate in [url, url.appendingPathExtension("backup")] where manager.fileExists(atPath: candidate.path) {
            try manager.removeItem(at: candidate)
        }
        // Recovery evidence belongs to this learner too; honour explicit erasure without
        // touching another account's files or arbitrary directories.
        if manager.fileExists(atPath: directory.path) {
            let entries = try manager.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)
            for archive in entries where archive.lastPathComponent.hasPrefix("Recovery-")
                && UUID(uuidString: String(archive.lastPathComponent.dropFirst("Recovery-".count))) != nil {
                var names = [url.lastPathComponent, url.lastPathComponent + ".backup"]
                if scope == "guest" { names.append("legacy-v1.json") }
                for name in names {
                    let candidate = archive.appendingPathComponent(name)
                    if manager.fileExists(atPath: candidate.path) { try manager.removeItem(at: candidate) }
                }
                if try manager.contentsOfDirectory(atPath: archive.path).isEmpty { try manager.removeItem(at: archive) }
            }
        }
        if scope == "guest" { UserDefaults.standard.removeObject(forKey: "lucid.learner-data.v1") }
    }

    /// Preserve damaged evidence before a learner explicitly restores an exported backup.
    /// Never use recovery to downgrade data created by a newer app.
    func archiveForRecovery(scope: String) throws -> URL {
        let primary = file(for: scope)
        for source in [primary, primary.appendingPathExtension("backup")] {
            if let bytes = try? Data(contentsOf: source),
               let header = try? JSONDecoder().decode(Header.self, from: bytes), header.version != 2 {
                throw PersistenceError.newerVersion
            }
            if let bytes = try? Data(contentsOf: source),
               let root = try? JSONSerialization.jsonObject(with: bytes) as? [String: Any],
               let learner = root["learner"] as? [String: Any] {
                for key in ["sharedLearning", "dailyVocabulary"] {
                    if let feature = learner[key] as? [String: Any], let version = feature["version"] as? Int, version != 1 {
                        throw PersistenceError.newerVersion
                    }
                }
            }
        }
        let archive = directory.appendingPathComponent("Recovery-\(UUID().uuidString)", isDirectory: true)
        try manager.createDirectory(at: archive, withIntermediateDirectories: true)
        for source in [primary, primary.appendingPathExtension("backup")] where manager.fileExists(atPath: source.path) {
            let bytes = try Data(contentsOf: source)
            try bytes.write(to: archive.appendingPathComponent(source.lastPathComponent), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        }
        if scope == "guest", let legacy = UserDefaults.standard.data(forKey: "lucid.learner-data.v1") {
            try legacy.write(to: archive.appendingPathComponent("legacy-v1.json"), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        }
        return archive
    }

    enum PersistenceError: LocalizedError {
        case unreadable, newerVersion
        var errorDescription: String? {
            switch self {
            case .unreadable: "Your saved progress could not be opened. It has been kept safely. Retry after restarting Lucid or contact support before erasing anything."
            case .newerVersion: "This progress was saved by a newer Lucid version. Update Lucid to continue."
            }
        }
    }
}

enum LearningMerge {
    /// Merge immutable activity IDs and preserve the most recent profile and explicit favourite removals.
    /// Practice drafts and notification settings deliberately remain on their originating device.
    static func combine(local: LearnerData, remote: LearnerData) -> LearnerData {
        var result = local
        let milestones = Set((local.historicalMasteredWordIds ?? []) + local.progressByWordId.filter { $0.value.mastered }.map(\.key))
        result.historicalMasteredWordIds = milestones.isEmpty ? nil : milestones.sorted()
        result.sharedLearning = SharedLearningMerge.combine(local.sharedLearning, remote.sharedLearning)
        if (remote.profileUpdatedAt ?? .distantPast) > (local.profileUpdatedAt ?? .distantPast)
            || (local.profile == nil && remote.profile != nil) {
            result.profile = remote.profile
            result.displayName = remote.displayName
            result.dailyWordGoal = remote.dailyWordGoal
            result.profileUpdatedAt = remote.profileUpdatedAt
        }
        let allContextEvents = ((local.contextEvidence ?? []) + (remote.contextEvidence ?? [])).filter(\.isValid).map { event in
            SharedLearningMerge.applyingExposure(to: event, shared: result.sharedLearning)
        }
        let groupedContextEvents = Dictionary(grouping: allContextEvents, by: { $0.id.lowercased() })
        var contextEvents: [String: ContextEvidence] = [:]
        for (id, events) in groupedContextEvents {
            guard let first = events.first,
                  events.allSatisfy({ $0.wordId == first.wordId && $0.roleId == first.roleId && $0.senseId == first.senseId && $0.kind == first.kind && $0.date == first.date }) else { continue }
            contextEvents[id] = events.dropFirst().reduce(first, ContextEvidence.conservative)
        }
        result.contextIntroducedOn = (local.contextIntroducedOn ?? [:]).merging(remote.contextIntroducedOn ?? [:]) { min($0, $1) }
        result.contextEvidence = contextEvents.isEmpty ? nil : contextEvents.values.sorted { $0.recordedAt == $1.recordedAt ? $0.id < $1.id : $0.recordedAt < $1.recordedAt }
        result.introducedWordIds = Array(Set(local.introducedWordIds + remote.introducedWordIds)).sorted()
        var placements = local.pathPlacements ?? [:]
        for (roleId, incoming) in remote.pathPlacements ?? [:] {
            if let own = placements[roleId] {
                let ownTie = own.pathId + "|" + own.startingModuleId
                let incomingTie = incoming.pathId + "|" + incoming.startingModuleId
                if incoming.checkedAt > own.checkedAt || (incoming.checkedAt == own.checkedAt && incomingTie > ownTie) {
                    placements[roleId] = incoming
                }
            } else { placements[roleId] = incoming }
        }
        result.pathPlacements = placements.isEmpty ? nil : placements
        let exposedRecallKeys = Set(allContextEvents.filter { event in
            event.kind == .unaidedRecall && !event.independent && ((local.contextEvidence ?? []) + (remote.contextEvidence ?? [])).contains { $0.id.lowercased() == event.id.lowercased() && $0.independent }
        }.map { "\($0.date):\($0.wordId)" })
        func safeActivity(_ event: LearningActivity) -> LearningActivity {
            guard event.kind == .review, exposedRecallKeys.contains("\(event.dayKey):\(event.wordId ?? "")") else { return event }
            return .init(id: event.id, kind: event.kind, wordId: event.wordId, date: event.date, dayKey: event.dayKey,
                         quality: min(1, event.quality), productive: false)
        }
        var events = Dictionary((local.activities ?? []).map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        for event in remote.activities ?? [] { events[event.id] = event }
        result.activities = events.values.sorted { $0.date == $1.date ? $0.id.uuidString < $1.id.uuidString : $0.date < $1.date }
        var sessions = Dictionary(local.sessions.map { ($0.localDayKey, $0) }, uniquingKeysWith: { first, _ in first })
        for session in remote.sessions where sessions[session.localDayKey] == nil { sessions[session.localDayKey] = session }
        result.sessions = sessions.values.sorted { $0.date < $1.date }
        for (id, other) in remote.progressByWordId {
            guard let own = result.progressByWordId[id] else { result.progressByWordId[id] = other; continue }
            var progress = (other.lastReviewedOn ?? .distantPast) > (own.lastReviewedOn ?? .distantPast) ? other : own
            progress.introducedOn = min(own.introducedOn, other.introducedOn)
            // Independent devices can answer the same local day at different
            // times. Reconcile the schedule conservatively, not just mastery.
            let ownReviewDay = (local.activities ?? []).first {
                $0.kind == .review && $0.wordId == id && $0.date == own.lastReviewedOn
            }?.dayKey ?? own.lastReviewedOn?.lucidDayKey
            let otherReviewDay = (remote.activities ?? []).first {
                $0.kind == .review && $0.wordId == id && $0.date == other.lastReviewedOn
            }?.dayKey ?? other.lastReviewedOn?.lucidDayKey
            if ownReviewDay == otherReviewDay {
                progress.intervalIndex = min(own.intervalIndex, other.intervalIndex)
                progress.nextReviewOn = min(own.nextReviewOn, other.nextReviewOn)
            }
            progress.successfulReviewDates = Array(Set(own.successfulReviewDates + other.successfulReviewDates)).sorted()
            progress.reviewCount = max(own.reviewCount, other.reviewCount)
            progress.lapses = max(own.lapses, other.lapses)
            result.progressByWordId[id] = progress
        }
        for (id, original) in result.progressByWordId {
            let reviews = (result.activities ?? []).filter { $0.kind == .review && $0.wordId == id }.map(safeActivity)
            guard !reviews.isEmpty else { continue }
            // One review per local calendar day. Conflicting same-day answers choose the harder result.
            let byDay = Dictionary(reviews.map { ($0.dayKey, $0) }, uniquingKeysWith: { left, right in
                if left.quality != right.quality { return left.quality < right.quality ? left : right }
                return left.date > right.date ? left : right
            })
            let unique = byDay.values.sorted { $0.date < $1.date }
            var progress = original
            let successes = unique.filter { $0.productive && $0.quality >= 2 }
            progress.reviewCount = max(progress.reviewCount, unique.count)
            progress.lapses = max(progress.lapses, unique.filter { $0.quality == 0 }.count)
            if let latest = unique.last {
                let retained = successes.contains { (Calendar.current.dateComponents([.day], from: progress.introducedOn.lucidStartOfDay, to: $0.date.lucidStartOfDay).day ?? 0) >= 30 }
                progress.mastered = latest.productive && latest.quality >= 2 && successes.count >= 3 && retained
            }
            result.progressByWordId[id] = progress
        }
        var favourites = local.favouriteChanges ?? [:]
        for (id, change) in remote.favouriteChanges ?? [:] {
            if change.updatedAt >= (favourites[id]?.updatedAt ?? .distantPast) { favourites[id] = change }
        }
        result.favouriteChanges = favourites
        let legacyFavourites = Set(local.favouriteWordIds + remote.favouriteWordIds)
        result.favouriteWordIds = Array(legacyFavourites.union(favourites.keys)).filter { favourites[$0]?.selected ?? legacyFavourites.contains($0) }.sorted()
        let localDay = local.lessonDayKey ?? local.currentLessonDate?.lucidDayKey
        let remoteDay = remote.lessonDayKey ?? remote.currentLessonDate?.lucidDayKey
        let sameDay = localDay != nil && localDay == remoteDay
        let localRole = local.lessonRoleId ?? local.profile?.roleId
        let remoteRole = remote.lessonRoleId ?? remote.profile?.roleId
        // Profile timestamps, not midnight lesson timestamps, decide a same-day role switch.
        let useRemotePlan = sameDay && localRole != remoteRole
            ? remoteRole == result.profile?.roleId
            : (remote.currentLessonDate ?? .distantPast) > (local.currentLessonDate ?? .distantPast)
        let chosenPlan = useRemotePlan ? remote : local
        result.currentLessonDate = chosenPlan.currentLessonDate
        result.lessonDayKey = chosenPlan.lessonDayKey
        result.currentWordIds = chosenPlan.currentWordIds
        result.lessonRoleId = chosenPlan.lessonRoleId ?? chosenPlan.profile?.roleId
        result.completedWordIdsToday = sameDay
            ? Array(Set(local.completedWordIdsToday + remote.completedWordIdsToday)).sorted()
            : chosenPlan.completedWordIdsToday
        var plans = local.dailyRolePlans ?? [:]
        for (roleId, plan) in remote.dailyRolePlans ?? [:] {
            if let own = plans[roleId], own.dayKey == plan.dayKey, own.wordIds == plan.wordIds {
                var combined = own
                combined.completedWordIds = Array(Set((own.completedWordIds ?? []) + (plan.completedWordIds ?? []))).sorted()
                plans[roleId] = combined
            } else if plans[roleId] == nil || plan.dayKey > plans[roleId]!.dayKey { plans[roleId] = plan }
        }
        // Cloud v2 has no cache fields; recover its active snapshot without discarding
        // the other locally visited roles. Catalogue validation happens in the store.
        for snapshot in [local, remote] {
            if let roleId = snapshot.lessonRoleId ?? snapshot.profile?.roleId,
               let day = snapshot.lessonDayKey ?? snapshot.currentLessonDate?.lucidDayKey,
               plans[roleId] == nil || day > plans[roleId]!.dayKey {
                plans[roleId] = DailyRolePlan(dayKey: day, wordIds: snapshot.currentWordIds, completedWordIds: snapshot.dailyRolePlans?[roleId]?.completedWordIds)
            }
        }
        result.dailyRolePlans = plans.isEmpty ? nil : plans
        result.reviewPromptMilestone = max(local.reviewPromptMilestone, remote.reviewPromptMilestone)
        let archived = Set((result.historicalMasteredWordIds ?? []) + result.progressByWordId.filter { $0.value.mastered }.map(\.key))
        result.historicalMasteredWordIds = archived.isEmpty ? nil : archived.sorted()
        result.updatedAt = [local.updatedAt, remote.updatedAt].compactMap { $0 }.max()
        return result
    }

    static func restoringBackup(local: LearnerData, incoming: LearnerData, restoreProfile: Bool) -> LearnerData {
        var result = combine(local: local, remote: incoming)
        let historical = Set((result.historicalMasteredWordIds ?? []) + (incoming.historicalMasteredWordIds ?? []) + incoming.progressByWordId.filter { $0.value.mastered }.map(\.key))
        result.historicalMasteredWordIds = historical.isEmpty ? nil : historical.sorted()
        let chosen = restoreProfile || local.profile == nil ? incoming : local
        if chosen.profile != nil {
            result.profile = chosen.profile
            result.displayName = chosen.displayName
            result.dailyWordGoal = chosen.dailyWordGoal
            result.profileUpdatedAt = chosen.profileUpdatedAt
        }
        result.practiceDrafts = (incoming.practiceDrafts ?? [:]).merging(local.practiceDrafts ?? [:]) { saved, existing in
            existing.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? saved : existing
        }
        result.reviewAttempts = (incoming.reviewAttempts ?? [:]).merging(local.reviewAttempts ?? [:]) { saved, existing in
            // A revealed hint must not turn into independent recall after restoring a backup.
            !saved.independent ? saved : existing
        }
        result.courseCheckDrafts = (incoming.courseCheckDrafts ?? [:]).merging(local.courseCheckDrafts ?? [:]) { saved, existing in
            existing.answers.isEmpty ? saved : existing
        }
        result.tapPracticeAttempts = (incoming.tapPracticeAttempts ?? [:]).merging(local.tapPracticeAttempts ?? [:]) { saved, existing in
            existing.choices.isEmpty && !existing.revealed ? saved : existing
        }
        result.practiceCursors = (incoming.practiceCursors ?? [:]).merging(local.practiceCursors ?? [:]) { saved, existing in
            saved.dayKey > existing.dayKey ? saved : existing
        }
        let gaps = Dictionary(((incoming.expressionGaps ?? []) + (local.expressionGaps ?? [])).map { ($0.id, $0) }, uniquingKeysWith: { saved, existing in
            (existing.lastPractisedAt ?? existing.createdAt) >= (saved.lastPractisedAt ?? saved.createdAt) ? existing : saved
        })
        result.expressionGaps = gaps.isEmpty ? nil : gaps.values.sorted { $0.createdAt < $1.createdAt }
        result.studioDrafts = (incoming.studioDrafts ?? [:]).merging(local.studioDrafts ?? [:]) { saved, existing in existing.isEmpty ? saved : existing }
        result.contextExposures = (incoming.contextExposures ?? [:]).merging(local.contextExposures ?? [:]) { max($0, $1) }
        result.rehearsalSessions = (incoming.rehearsalSessions ?? [:]).merging(local.rehearsalSessions ?? [:]) { saved, existing in
            var chosen = existing.completedAt != nil || (saved.completedAt == nil && existing.checked) ? existing : saved
            chosen.modelSeen = saved.modelSeen || existing.modelSeen
            return chosen
        }
        result.transferSessions = (incoming.transferSessions ?? [:]).merging(local.transferSessions ?? [:]) { saved, existing in
            guard saved.roleId == existing.roleId && saved.scenarioIds == existing.scenarioIds else { return existing }
            var chosen = existing
            chosen.completedScenarioIds = Array(Set(saved.completedScenarioIds + existing.completedScenarioIds)).sorted()
            chosen.completedAt = existing.completedAt ?? saved.completedAt
            return chosen
        }
        result.portableWebCompanion = local.portableWebCompanion ?? incoming.portableWebCompanion
        result.dailyVocabulary = DailyVocabularyEngine.restoringBackup(local: local.dailyVocabulary, incoming: incoming.dailyVocabulary)
        return result
    }

    static func cloudRecord(_ data: LearnerData) -> LearnerData {
        var result = data
        result.schemaVersion = 2
        result.practiceDrafts = nil
        result.reviewAttempts = nil
        result.courseCheckDrafts = nil
        result.tapPracticeAttempts = nil
        result.practiceCursors = nil
        result.lessonRoleId = nil
        result.dailyRolePlans = nil
        result.contextExposures = nil
        result.expressionGaps = nil
        result.rehearsalSessions = nil
        result.transferSessions = nil
        result.studioDrafts = nil
        result.portableWebCompanion = nil
        result.dailyVocabulary = nil
        result.historicalMasteredWordIds = nil
        result.contextEvidence = result.contextEvidence?.filter(\.isValid)
        result.settings = AppSettings()
        return result
    }
}


/// Both clients reduce the same immutable records. Raw device-local work is never merged here.
enum SharedLearningMerge {
    static func earlier(_ left: String, _ right: String) -> String {
        guard let a = SharedLearningState.instant(left), let b = SharedLearningState.instant(right) else { return min(left, right) }
        return a <= b ? left : right
    }
    static func later(_ left: String?, _ right: String?) -> String? {
        guard let left else { return right }; guard let right else { return left }
        guard let a = SharedLearningState.instant(left), let b = SharedLearningState.instant(right) else { return max(left, right) }
        return a >= b ? left : right
    }
    static func canonical(_ value: StudioJSONValue) -> String {
        let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        return String(decoding: (try? encoder.encode(value)) ?? Data(), as: UTF8.self)
    }
    static func checkpointTie(_ entry: SharedLessonCheckpoint) -> String {
        let answers = (entry.answers ?? [:]).mapValues { StudioJSONValue.object(["choiceId": .string($0.choiceId), "hinted": .bool($0.hinted)]) }
        return canonical(.object(["cursorWordId": entry.cursorWordId.map(StudioJSONValue.string) ?? .null, "answers": .object(answers)]))
    }
    static func startingTie(_ entry: SharedStartingCheck) -> String {
        canonical(.object(["questionIds": .array(entry.questionIds.map(StudioJSONValue.string)), "answers": .array(entry.answers.map { .number(Double($0)) })]))
    }
    static func applyingExposure(to event: ContextEvidence, shared: SharedLearningState?) -> ContextEvidence {
        guard event.independent, let seen = shared?.exposures[event.senseId], seen.dayKey == event.date,
              let first = SharedLearningState.instant(seen.firstSeenAt) else { return event }
        if let capture = event.capturedAt, capture < first { return event }
        var conservative = event; conservative.independent = false; conservative.quality = min(1, event.quality)
        return conservative
    }
    static func combine(_ local: SharedLearningState?, _ remote: SharedLearningState?) -> SharedLearningState? {
        guard let remote, remote.isValid else { return local }
        guard var result = local, result.isValid else { return remote }
        for (key, incoming) in remote.lessonCheckpoints {
            guard let own = result.lessonCheckpoints[key] else { result.lessonCheckpoints[key] = incoming; continue }
            let ownTime = SharedLearningState.instant(own.updatedAt)!, incomingTime = SharedLearningState.instant(incoming.updatedAt)!
            if own.wordIds != incoming.wordIds {
                let ownTie = canonical(.array(own.wordIds.map(StudioJSONValue.string)))
                let otherTie = canonical(.array(incoming.wordIds.map(StudioJSONValue.string)))
                result.lessonCheckpoints[key] = ownTime < incomingTime || (ownTime == incomingTime && ownTie <= otherTie) ? own : incoming
            } else {
                let incomingIsNewest = incomingTime > ownTime || (incomingTime == ownTime && checkpointTie(incoming) < checkpointTie(own))
                var chosen = incomingIsNewest ? incoming : own
                let first = ownTime <= incomingTime ? own : incoming
                chosen.cursorWordId = chosen.cursorWordId ?? first.cursorWordId
                chosen.completedWordIds = Array(Set(own.completedWordIds + incoming.completedWordIds)).sorted()
                var answers = own.answers ?? [:]
                for (word, answer) in incoming.answers ?? [:] {
                    if let prior = answers[word] {
                        let pick = chosen.answers?[word] ?? prior
                        answers[word] = .init(choiceId: pick.choiceId, hinted: prior.hinted || answer.hinted)
                    } else { answers[word] = answer }
                }
                chosen.answers = answers.isEmpty ? nil : answers
                result.lessonCheckpoints[key] = chosen
            }
        }
        for (key, incoming) in remote.startingChecks {
            guard let own = result.startingChecks[key] else { result.startingChecks[key] = incoming; continue }
            let sameQuestions = own.pathId == incoming.pathId && own.questionIds == incoming.questionIds
            let isPrefix = Array(own.answers.prefix(min(own.answers.count, incoming.answers.count))) == Array(incoming.answers.prefix(min(own.answers.count, incoming.answers.count)))
            if sameQuestions && isPrefix { result.startingChecks[key] = incoming.answers.count > own.answers.count ? incoming : own }
            else {
                let ownTime = SharedLearningState.instant(own.updatedAt)!, incomingTime = SharedLearningState.instant(incoming.updatedAt)!
                result.startingChecks[key] = incomingTime < ownTime || (incomingTime == ownTime && startingTie(incoming) < startingTie(own)) ? incoming : own
            }
        }
        for (key, incoming) in remote.notebook {
            guard let own = result.notebook[key] else { result.notebook[key] = incoming; continue }
            guard own.id.lowercased() == incoming.id.lowercased(), own.roleId == incoming.roleId,
                  own.expressionId == incoming.expressionId, own.style == incoming.style, own.phrase == incoming.phrase else { continue }
            let ownPractice = own.lastPractisedAt.flatMap(SharedLearningState.instant) ?? .distantPast
            let incomingPractice = incoming.lastPractisedAt.flatMap(SharedLearningState.instant) ?? .distantPast
            let chosen = SharedNotebookEntry(id: own.id, roleId: own.roleId, expressionId: own.expressionId, style: own.style, phrase: own.phrase,
                createdAt: earlier(own.createdAt, incoming.createdAt),
                nextReviewOn: ownPractice == incomingPractice ? min(own.nextReviewOn, incoming.nextReviewOn) : incomingPractice > ownPractice ? incoming.nextReviewOn : own.nextReviewOn,
                lastPractisedAt: later(own.lastPractisedAt, incoming.lastPractisedAt))
            result.notebook[key] = chosen
        }
        for (key, incoming) in remote.rehearsals {
            guard let own = result.rehearsals[key] else { result.rehearsals[key] = incoming; continue }
            guard own.id.lowercased() == incoming.id.lowercased(), own.roleId == incoming.roleId,
                  own.scenarioId == incoming.scenarioId, own.expressionId == incoming.expressionId,
                  own.mode == incoming.mode, (own.gapId == nil || incoming.gapId == nil || own.gapId == incoming.gapId) else { continue }
            var chosen = own; chosen.modelSeen = own.modelSeen || incoming.modelSeen
            chosen.startedAt = earlier(own.startedAt, incoming.startedAt); chosen.gapId = own.gapId ?? incoming.gapId
            chosen.completedAt = own.completedAt.flatMap { left in incoming.completedAt.map { earlier(left, $0) } ?? left } ?? incoming.completedAt
            result.rehearsals[key] = chosen
        }
        for (key, incoming) in remote.challenges {
            guard let own = result.challenges[key] else { result.challenges[key] = incoming; continue }
            guard own.roleId == incoming.roleId, own.mode == incoming.mode, own.milestone == incoming.milestone,
                  own.scenarioIds == incoming.scenarioIds else { continue }
            var chosen = own
            chosen.startedAt = earlier(own.startedAt, incoming.startedAt)
            chosen.completedScenarioIds = Array(Set(own.completedScenarioIds + incoming.completedScenarioIds)).sorted()
            chosen.completedAt = Set(chosen.completedScenarioIds) == Set(chosen.scenarioIds)
                ? ((own.completedAt.flatMap { left in incoming.completedAt.map { earlier(left, $0) } ?? left } ?? incoming.completedAt) ?? later(own.startedAt, incoming.startedAt)!) : nil
            result.challenges[key] = chosen
        }
        for (key, incoming) in remote.exposures {
            guard let own = result.exposures[key] else { result.exposures[key] = incoming; continue }
            result.exposures[key] = incoming.dayKey > own.dayKey ? incoming : own.dayKey > incoming.dayKey ? own
                : .init(dayKey: own.dayKey, firstSeenAt: earlier(own.firstSeenAt, incoming.firstSeenAt))
        }
        return result
    }
}
