import SwiftUI
import UniformTypeIdentifiers

struct LucidBackupDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.json] }
    let content: Data
    init(data: LearnerData) throws {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        content = try encoder.encode(LearningPersistence.Envelope(version: 2, learner: data))
    }
    init(configuration: ReadConfiguration) throws {
        guard let data = configuration.file.regularFileContents, data.count <= 2_000_000 else { throw BackupError.invalid }
        content = data
    }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper { FileWrapper(regularFileWithContents: content) }
    enum BackupError: LocalizedError {
        case invalid
        var errorDescription: String? { "That file is not a supported Lucid backup. Your current progress has not changed." }
    }
}

@MainActor
extension LearningStore {
    func importBackup(from url: URL, restoreProfile: Bool = false) throws {
        guard session == nil, !storageNeedsUpdate, catalogError == nil else { throw LucidBackupDocument.BackupError.invalid }
        let hasAccess = url.startAccessingSecurityScopedResource()
        defer { if hasAccess { url.stopAccessingSecurityScopedResource() } }
        let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
        guard size <= 2_000_000 else { throw LucidBackupDocument.BackupError.invalid }
        let bytes = try Data(contentsOf: url)
        guard bytes.count <= 2_000_000 else { throw LucidBackupDocument.BackupError.invalid }
        let envelope = try JSONDecoder().decode(LearningPersistence.Envelope.self, from: bytes)
        guard envelope.version == 2 else { throw LucidBackupDocument.BackupError.invalid }
        let incoming = envelope.learner
        let ids = Set(catalog.words.map(\.id))
        guard incoming.introducedWordIds.allSatisfy(ids.contains),
              incoming.currentWordIds.count <= 3,
              incoming.currentWordIds.allSatisfy(ids.contains),
              incoming.progressByWordId.keys.allSatisfy(ids.contains),
              incoming.progressByWordId.values.allSatisfy({ (0...4).contains($0.intervalIndex) && $0.reviewCount >= 0 && $0.lapses >= 0 }) else {
            throw LucidBackupDocument.BackupError.invalid
        }
        if let profile = incoming.profile {
            guard let role = catalog.roles.first(where: { $0.id == profile.roleId }),
                  catalog.seniorityLevels.contains(where: { $0.id == profile.seniorityId }),
                  profile.situationIds.allSatisfy({ id in role.situations.contains { $0.id == id } }),
                  profile.goalIds.allSatisfy({ id in catalog.goals.contains { $0.id == id } }) else { throw LucidBackupDocument.BackupError.invalid }
        }
        var merged = LearningMerge.restoringBackup(local: data, incoming: incoming, restoreProfile: restoreProfile)
        // An updated course can invalidate the local draft without invalidating a
        // matching backup. Compare against the current authored question set.
        for path in catalog.learningPaths ?? [] {
            let own = data.courseCheckDrafts?[path.roleId]
            if let saved = incoming.courseCheckDrafts?[path.roleId], saved.matches(path),
               own == nil || own?.matches(path) == false || own?.answers.isEmpty == true {
                var drafts = merged.courseCheckDrafts ?? [:]
                drafts[path.roleId] = saved
                merged.courseCheckDrafts = drafts
            }
        }
        if restoreProfile, incoming.profile != nil { merged.profileUpdatedAt = clock() }
        merged = normalizedDailyPlan(merged, at: clock())
        // A valid backup may repair a stale question draft without resetting earned history.
        for (roleId, plan) in merged.dailyRolePlans ?? [:] where plan.dayKey == clock().lucidDayKey {
            var validationRecord = merged
            validationRecord.profile?.roleId = roleId
            validationRecord.currentWordIds = plan.wordIds
            validationRecord.lessonDayKey = plan.dayKey
            for wordId in plan.wordIds {
                guard let challenge = practiceChallenge(for: wordId, record: validationRecord),
                      let saved = incoming.tapPracticeAttempts?[challenge.key], saved.signature == challenge.signature,
                      saved.choices.count <= 12,
                      saved.choices.allSatisfy({ id in challenge.options.contains { $0.id == id } }) else { continue }
                let own = merged.tapPracticeAttempts?[challenge.key]
                let ownValid = own?.signature == challenge.signature && (own?.choices.count ?? 0) <= 12
                    && own?.choices.allSatisfy({ id in challenge.options.contains { $0.id == id } }) == true
                if !ownValid {
                    var attempts = merged.tapPracticeAttempts ?? [:]; attempts[challenge.key] = saved
                    merged.tapPracticeAttempts = attempts
                }
            }
        }
        let recovering = storageBlocked
        if recovering { _ = try persistence.archiveForRecovery(scope: scope) }
        try persistence.save(merged, scope: scope)
        isApplyingRemote = true
        data = merged
        isApplyingRemote = false
        storageBlocked = false
        hasUnsavedChanges = false
        storageNotice = recovering ? "Your backup was restored. The previous unreadable files were also kept for recovery." : "Your backup was restored and merged with this device’s progress."
        prepareToday()
    }
}
