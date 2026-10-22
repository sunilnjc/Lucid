import SwiftUI
import UniformTypeIdentifiers

struct LucidBackupDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.json] }
    static let maximumByteCount = 2_000_000
    let content: Data
    init(data: LearnerData) throws {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        var learner = data; learner.portableWebCompanion = nil
        let encoded = try encoder.encode(LearningPersistence.Envelope(version: 2, learner: learner, webLearningBackup: data.portableWebCompanion))
        guard encoded.count <= Self.maximumByteCount else { throw BackupError.tooLarge }
        content = encoded
    }
    init(configuration: ReadConfiguration) throws {
        guard let data = configuration.file.regularFileContents, data.count <= Self.maximumByteCount else { throw BackupError.invalid }
        content = data
    }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper { FileWrapper(regularFileWithContents: content) }
    enum BackupError: LocalizedError {
        case invalid, tooLarge
        var errorDescription: String? {
            switch self {
            case .invalid: "That file is not a supported Lucid backup. Your current progress has not changed."
            case .tooLarge: "This backup exceeds the current 2 MB limit. Your learning is still saved on this device. Contact support before moving or clearing this device."
            }
        }
    }
}

@MainActor
extension LearningStore {
    func importBackup(from url: URL, restoreProfile: Bool = false) throws {
        guard session == nil, !storageNeedsUpdate, catalogError == nil else { throw LucidBackupDocument.BackupError.invalid }
        let hasAccess = url.startAccessingSecurityScopedResource()
        defer { if hasAccess { url.stopAccessingSecurityScopedResource() } }
        let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
        guard size <= LucidBackupDocument.maximumByteCount else { throw LucidBackupDocument.BackupError.invalid }
        let bytes = try Data(contentsOf: url)
        guard bytes.count <= LucidBackupDocument.maximumByteCount else { throw LucidBackupDocument.BackupError.invalid }
        let envelope = try JSONDecoder().decode(LearningPersistence.Envelope.self, from: bytes)
        guard envelope.version == 2 else { throw LucidBackupDocument.BackupError.invalid }
        var incoming = envelope.learner
        incoming.portableWebCompanion = envelope.webLearningBackup ?? incoming.portableWebCompanion
        guard incoming.sharedLearning?.isValid ?? true else { throw LucidBackupDocument.BackupError.invalid }
        guard incoming.dailyVocabulary.map({ DailyVocabularyEngine.isValid($0, catalog: catalog, idioms: suppliedDailyIdiomCatalog) }) ?? true else { throw LucidBackupDocument.BackupError.invalid }
        let ids = Set(catalog.words.map(\.id))
        guard incoming.introducedWordIds.allSatisfy(ids.contains),
              incoming.currentWordIds.count <= 3,
              incoming.currentWordIds.allSatisfy(ids.contains),
              incoming.progressByWordId.keys.allSatisfy(ids.contains),
              incoming.progressByWordId.values.allSatisfy({ (0...4).contains($0.intervalIndex) && $0.reviewCount >= 0 && $0.lapses >= 0 }) else {
            throw LucidBackupDocument.BackupError.invalid
        }
        let groupedEvidence = Dictionary(grouping: incoming.contextEvidence ?? [], by: { $0.id.lowercased() })
        guard groupedEvidence.values.allSatisfy({ events in
            guard let first = events.first else { return true }
            return events.allSatisfy { $0.wordId == first.wordId && $0.roleId == first.roleId && $0.senseId == first.senseId && $0.kind == first.kind && $0.date == first.date }
        }), (incoming.contextIntroducedOn ?? [:]).allSatisfy({ key, date in
            date.timeIntervalSinceReferenceDate.isFinite && catalog.words.contains { word in word.roles.contains { key == "\(word.id)::\($0)" } }
        }) else { throw LucidBackupDocument.BackupError.invalid }
        guard (incoming.contextEvidence ?? []).allSatisfy({ event in
            event.isValid && ContextEvidence.calendarDay(event.date) != nil && catalog.words.contains { $0.id == event.wordId && $0.roles.contains(event.roleId) }
        }), (incoming.expressionGaps ?? []).allSatisfy({ gap in
            catalog.roles.contains { $0.id == gap.roleId } && gap.situation.count <= 2_000 && ["plain", "precise", "diplomatic"].contains(gap.selectedStyle)
        }), (incoming.rehearsalSessions ?? [:]).allSatisfy({ key, session in
            key == session.id.uuidString && catalog.roles.contains { $0.id == session.roleId } && session.response.count <= 2_000 && session.retry.count <= 2_000 && ["rehearsal", "delayed", "transfer", "comeback"].contains(session.mode)
        }), (incoming.transferSessions ?? [:]).allSatisfy({ key, session in
            key == session.id && catalog.roles.contains { $0.id == session.roleId } && session.scenarioIds.count <= 3 && session.completedScenarioIds.allSatisfy(session.scenarioIds.contains) && ["transfer", "comeback"].contains(session.mode)
        }) else { throw LucidBackupDocument.BackupError.invalid }
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
