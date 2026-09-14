import Foundation

/// A versioned, atomic record and last known good backup, protected by iOS Data Protection.
struct LearningPersistence {
    private struct Header: Decodable { let version: Int }
    struct Envelope: Codable {
        let version: Int
        let learner: LearnerData
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
        let envelope = try JSONDecoder().decode(Envelope.self, from: bytes)
        return envelope.learner
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
        if (remote.profileUpdatedAt ?? .distantPast) > (local.profileUpdatedAt ?? .distantPast)
            || (local.profile == nil && remote.profile != nil) {
            result.profile = remote.profile
            result.displayName = remote.displayName
            result.dailyWordGoal = remote.dailyWordGoal
            result.profileUpdatedAt = remote.profileUpdatedAt
        }
        result.introducedWordIds = Array(Set(local.introducedWordIds + remote.introducedWordIds)).sorted()
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
            let reviews = (result.activities ?? []).filter { $0.kind == .review && $0.wordId == id }
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
            if plans[roleId] == nil || plan.dayKey > plans[roleId]!.dayKey { plans[roleId] = plan }
        }
        // Cloud v2 has no cache fields; recover its active snapshot without discarding
        // the other locally visited roles. Catalogue validation happens in the store.
        for snapshot in [local, remote] {
            if let roleId = snapshot.lessonRoleId ?? snapshot.profile?.roleId,
               let day = snapshot.lessonDayKey ?? snapshot.currentLessonDate?.lucidDayKey,
               plans[roleId] == nil || day > plans[roleId]!.dayKey {
                plans[roleId] = DailyRolePlan(dayKey: day, wordIds: snapshot.currentWordIds)
            }
        }
        result.dailyRolePlans = plans.isEmpty ? nil : plans
        result.reviewPromptMilestone = max(local.reviewPromptMilestone, remote.reviewPromptMilestone)
        result.updatedAt = max(local.updatedAt ?? .distantPast, remote.updatedAt ?? .distantPast)
        return result
    }

    static func restoringBackup(local: LearnerData, incoming: LearnerData, restoreProfile: Bool) -> LearnerData {
        var result = combine(local: local, remote: incoming)
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
        return result
    }

    static func cloudRecord(_ data: LearnerData) -> LearnerData {
        var result = data
        result.schemaVersion = 2
        result.practiceDrafts = nil
        result.reviewAttempts = nil
        result.lessonRoleId = nil
        result.dailyRolePlans = nil
        result.settings = AppSettings()
        return result
    }
}
