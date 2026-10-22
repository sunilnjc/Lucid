import Foundation

/// Optional v2 metadata. This records the learner's assessment, never an AI grade.
struct ContextEvidence: Codable, Equatable, Identifiable {
    enum Kind: String, Codable { case recognition; case unaidedRecall = "unaided-recall"; case selfAssessedProduction = "self-assessed-production" }
    let id: String
    let wordId: String
    let roleId: String
    let senseId: String
    let date: String
    let recordedAt: Date
    let kind: Kind
    var quality: Int
    var independent: Bool
    var capturedAt: Date? = nil
    var isValid: Bool { UUID(uuidString: id) != nil && senseId == "\(wordId)::\(roleId)" && (0...3).contains(quality) && Self.calendarDay(date) != nil && recordedAt.timeIntervalSinceReferenceDate.isFinite && (capturedAt == nil || (capturedAt!.timeIntervalSinceReferenceDate.isFinite && capturedAt! <= recordedAt)) && Self.dayMatches(date, instant: recordedAt) && (capturedAt == nil || Self.dayMatches(date, instant: capturedAt!)) && (kind != .recognition || !independent) }
}

/// Opaque companion preserves a web backup through a native round trip. It supplies no credit.
indirect enum StudioJSONValue: Codable, Equatable {
    case object([String: StudioJSONValue]), array([StudioJSONValue]), string(String), number(Double), bool(Bool), null
    init(from decoder: Decoder) throws {
        let value = try decoder.singleValueContainer()
        if value.decodeNil() { self = .null }
        else if let decoded = try? value.decode(Bool.self) { self = .bool(decoded) }
        else if let decoded = try? value.decode(Double.self) { self = .number(decoded) }
        else if let decoded = try? value.decode(String.self) { self = .string(decoded) }
        else if let decoded = try? value.decode([StudioJSONValue].self) { self = .array(decoded) }
        else { self = .object(try value.decode([String: StudioJSONValue].self)) }
    }
    func encode(to encoder: Encoder) throws {
        var value = encoder.singleValueContainer()
        switch self {
        case .object(let content): try value.encode(content)
        case .array(let content): try value.encode(content)
        case .string(let content): try value.encode(content)
        case .number(let content): try value.encode(content)
        case .bool(let content): try value.encode(content)
        case .null: try value.encodeNil()
        }
    }
}

struct ExpressionContent: Codable {
    struct Goal: Codable, Identifiable { let id: String; let label: String }
    let schemaVersion: Int
    let goals: [Goal]
    let expressions: [StudioExpression]
    let scenarios: [StudioScenario]
    static var bundled: ExpressionContent? {
        guard let url = Bundle.main.url(forResource: "expression-content", withExtension: "json"),
              let bytes = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(Self.self, from: bytes)
    }
}
struct StudioExpression: Codable, Identifiable, Equatable {
    struct Contrast: Codable, Equatable { let nearby: String; let distinction: String; let fitting: String; let awkward: String; let explanation: String }
    let id: String; let wordId: String; let term: String; let roleIds: [String]; let senseId: String
    let title: String; let theme: String; let goalIds: [String]; let intentKeywords: [String]
    let plain: String; let precise: String; let diplomatic: String; let register: String
    let collocations: [String]; let misuse: String; let contrasts: [Contrast]
}
struct StudioScenario: Codable, Identifiable, Equatable {
    let id: String; let expressionId: String; let roleIds: [String]; let kind: String; let wordIds: [String]
    let prompt: String; let focus: String; let exampleResponse: String; let freshPrompt: String; let freshExampleResponse: String
}
struct ExpressionGap: Codable, Equatable, Identifiable {
    let id: UUID; let roleId: String; let expressionId: String; let createdAt: Date
    let situation: String; let selectedStyle: String; let selectedPhrase: String
    var nextReviewOn: Date
    var lastPractisedAt: Date? = nil
}
struct RehearsalSession: Codable, Equatable, Identifiable {
    let id: UUID; let roleId: String; let scenarioId: String; let expressionId: String
    var startedAt: Date; let mode: String; let gapId: UUID?
    var response = ""; var retry = ""; var modelSeen = false; var checked = false
    var capturedAt: Date? = nil
    var receivedFromSync: Bool? = nil
    var meaningConfirmed = false; var naturalnessConfirmed = false
    var completedAt: Date? = nil
}
struct TransferSession: Codable, Equatable, Identifiable {
    let id: String; let roleId: String; let milestone: Int; var startedAt: Date
    let mode: String; let scenarioIds: [String]
    var completedScenarioIds: [String] = []
    var completedAt: Date? = nil
}
struct StudioCheck: Equatable {
    let wordCount: Int; let termFound: Bool; let collocationFound: Bool; let message: String
}

@MainActor
extension LearningStore {
    var expressionContent: ExpressionContent? { suppliedExpressionContent }
    var studioExpressions: [StudioExpression] { expressionContent?.expressions.filter { $0.roleIds.contains(profile?.roleId ?? "") } ?? [] }
    var studioScenarios: [StudioScenario] { expressionContent?.scenarios.filter { $0.roleIds.contains(profile?.roleId ?? "") } ?? [] }
    var expressionGaps: [ExpressionGap] { (data.expressionGaps ?? []).filter { $0.roleId == profile?.roleId }.sorted { $0.createdAt > $1.createdAt } }
    var dueExpressionGaps: [ExpressionGap] { expressionGaps.filter { $0.nextReviewOn.lucidStartOfDay <= currentDate.lucidStartOfDay } }
    var contextEvidence: [ContextEvidence] { (data.contextEvidence ?? []).filter { event in event.isValid && catalog.words.contains { $0.id == event.wordId && $0.roles.contains(event.roleId) } } }
    func evidence(for roleId: String? = nil, kind: ContextEvidence.Kind? = nil) -> [ContextEvidence] {
        contextEvidence.filter { $0.roleId == (roleId ?? profile?.roleId ?? "") && (kind == nil || $0.kind == kind) }
    }
    var recognizedContextCount: Int { Set(evidence(kind: .recognition).map(\.senseId)).count }
    var recalledContextCount: Int { Set(evidence(kind: .unaidedRecall).filter { $0.independent && $0.quality >= 2 }.map(\.senseId)).count }
    var producedContextCount: Int { Set(evidence(kind: .selfAssessedProduction).filter { $0.independent && $0.quality >= 2 }.map(\.senseId)).count }
    var retainedContextCount: Int { Set(evidence().map(\.wordId)).filter { contextIsRetained(wordId: $0, roleId: profile?.roleId ?? "") }.count }
    func contextIsRetained(wordId: String, roleId: String) -> Bool {
        let all = evidence(for: roleId).filter { $0.wordId == wordId }
        let attempts = all.filter { $0.kind == .unaidedRecall }
        let byDay = Dictionary(attempts.map { ($0.date, $0) }, uniquingKeysWith: ContextEvidence.conservative)
        let successes = byDay.values.filter { $0.independent && $0.quality >= 2 }
        guard successes.count >= 3, let latest = byDay.values.max(by: { $0.date < $1.date }),
              latest.independent && latest.quality >= 2,
              let first = all.map(\.date).min(), let start = data.contextIntroducedOn?["\(wordId)::\(roleId)"].flatMap(ContextEvidence.utcAnchorDay) ?? ContextEvidence.calendarDay(first) else { return false }
        // Legacy global schedules never establish context-specific retention.
        return successes.contains { event in
            guard let day = ContextEvidence.calendarDay(event.date) else { return false }
            return day.timeIntervalSince(start) >= 30 * 86_400
        }
    }
    func contextHasIntroduction(wordId: String, roleId: String, record: LearnerData? = nil) -> Bool {
        let learner = record ?? data
        let sense = "\(wordId)::\(roleId)"
        return learner.contextIntroducedOn?[sense] != nil || (learner.contextEvidence ?? []).contains { $0.isValid && $0.senseId == sense }
    }
    func contextSchedule(wordId: String, roleId: String, record: LearnerData? = nil) -> WordProgress? {
        let learner = record ?? data
        let sense = "\(wordId)::\(roleId)"
        let events = (learner.contextEvidence ?? []).filter { $0.isValid && $0.senseId == sense }
        let anchor = learner.contextIntroducedOn?[sense].flatMap(ContextEvidence.utcAnchorDay)
        let anchorKey = anchor.map(ContextEvidence.utcDayKey) ?? events.map(\.date).min()
        guard let anchorKey, let introduced = ContextEvidence.localCalendarDay(anchorKey) else { return nil }
        var state = WordProgress(introducedOn: introduced, nextReviewOn: introduced.lucidAdding(days: 1))
        let reviews = events.filter { $0.kind == .unaidedRecall && $0.date >= anchorKey }
        let days = Dictionary(reviews.map { ($0.date, $0) }, uniquingKeysWith: ContextEvidence.conservative)
        for event in days.values.sorted(by: { $0.date < $1.date }) {
            guard let date = ContextEvidence.localCalendarDay(event.date) else { continue }
            let quality = event.independent ? event.quality : min(1, event.quality)
            switch quality {
            case 0: state.intervalIndex = 0; state.lapses += 1
            case 1: state.intervalIndex = max(0, state.intervalIndex - 1)
            case 2: state.intervalIndex = min(4, state.intervalIndex + 1)
            default: state.intervalIndex = min(4, state.intervalIndex + 2)
            }
            state.reviewCount += 1
            state.lastReviewedOn = date
            state.nextReviewOn = date.lucidAdding(days: quality <= 1 ? 1 : Self.intervals[state.intervalIndex])
            if quality >= 2 { state.successfulReviewDates.append(date) }
        }
        return state
    }
    func rolePracticeIsComplete(wordId: String, roleId: String, record: LearnerData? = nil, dayKey: String? = nil) -> Bool {
        let learner = record ?? data
        let day = dayKey ?? clock().lucidDayKey
        if let plan = learner.dailyRolePlans?[roleId], plan.dayKey == day, let completed = plan.completedWordIds { return completed.contains(wordId) }
        let guidedActivity = (learner.activities ?? []).contains { $0.kind == .practice && $0.wordId == wordId && $0.dayKey == day }
        return guidedActivity && (learner.contextEvidence ?? []).contains { $0.isValid && $0.wordId == wordId && $0.roleId == roleId && $0.date == day && $0.kind == .recognition }
    }
    func isCurrentRoleWordComplete(_ wordId: String) -> Bool {
        rolePracticeIsComplete(wordId: wordId, roleId: profile?.roleId ?? "")
    }
    func markRolePracticeComplete(wordId: String, in record: inout LearnerData, at date: Date) {
        guard let role = record.profile?.roleId else { return }
        var plans = record.dailyRolePlans ?? [:]
        var plan = plans[role] ?? DailyRolePlan(dayKey: date.lucidDayKey, wordIds: record.currentWordIds)
        if plan.dayKey != date.lucidDayKey { plan = DailyRolePlan(dayKey: date.lucidDayKey, wordIds: record.currentWordIds) }
        if !(plan.completedWordIds ?? []).contains(wordId) { plan.completedWordIds = (plan.completedWordIds ?? []) + [wordId] }
        plans[role] = plan; record.dailyRolePlans = plans
    }
    func contextWasExposed(wordId: String) -> Bool {
        let key = "\(wordId)::\(profile?.roleId ?? "")"
        return data.contextExposures?[key] == clock().lucidDayKey || data.sharedLearning?.exposures[key]?.dayKey == clock().lucidDayKey
    }
    func markContextExposure(wordId: String, in record: inout LearnerData, at date: Date) {
        guard let role = record.profile?.roleId, catalog.words.contains(where: { $0.id == wordId && $0.roles.contains(role) }) else { return }
        var exposures = record.contextExposures ?? [:]
        exposures["\(wordId)::\(role)"] = date.lucidDayKey
        record.contextExposures = exposures
        var shared = record.sharedLearning ?? SharedLearningState()
        let key = "\(wordId)::\(role)"
        // The model is shown after the original was frozen. Preserve that ordering
        // even with a millisecond clock or a fixed isolated test clock.
        let frozenReview = record.reviewAttempts?.values.filter { $0.senseId == key }.compactMap(\.capturedAt).max()
        let frozenRehearsal = record.rehearsalSessions?.values.filter { session in
            session.checked && session.roleId == role && suppliedExpressionContent?.expressions.contains { $0.id == session.expressionId && $0.wordId == wordId } == true
        }.compactMap(\.capturedAt).max()
        let capture = [frozenReview, frozenRehearsal].compactMap { $0 }.max()
        let shownAt = capture.map { max(date, $0.addingTimeInterval(0.001)) } ?? date
        let incoming = SharedExposure(dayKey: date.lucidDayKey, firstSeenAt: SharedLearningState.stamp(shownAt))
        if let own = shared.exposures[key], own.dayKey == incoming.dayKey {
            shared.exposures[key] = .init(dayKey: own.dayKey, firstSeenAt: SharedLearningMerge.earlier(own.firstSeenAt, incoming.firstSeenAt))
        } else if shared.exposures[key] == nil || incoming.dayKey > shared.exposures[key]!.dayKey { shared.exposures[key] = incoming }
        record.sharedLearning = shared
    }
    func markContextExposure(wordId: String) { markContextExposures(wordIds: [wordId]) }
    func markContextExposures(wordIds: [String]) {
        guard studioCanMutate else { return }
        var next = data
        for wordId in wordIds where !contextWasExposed(wordId: wordId) { markContextExposure(wordId: wordId, in: &next, at: clock()) }
        if next != data { data = next }
    }
    func appendContextEvidence(to record: inout LearnerData, wordId: String, kind: ContextEvidence.Kind, quality: Int, independent: Bool, at date: Date, capturedAt: Date? = nil) {
        guard let roleId = record.profile?.roleId, let entry = catalog.words.first(where: { $0.id == wordId }), entry.roles.contains(roleId) else { return }
        let evidence = ContextEvidence(id: UUID().uuidString.lowercased(), wordId: wordId, roleId: roleId, senseId: "\(wordId)::\(roleId)", date: date.lucidDayKey, recordedAt: date, kind: kind, quality: min(3, max(0, quality)), independent: independent, capturedAt: capturedAt)
        record.contextEvidence = (record.contextEvidence ?? []) + [evidence]
        var introduced = record.contextIntroducedOn ?? [:]
        if introduced[evidence.senseId] == nil { introduced[evidence.senseId] = ContextEvidence.calendarDay(evidence.date)?.addingTimeInterval(12 * 3600) ?? date }
        record.contextIntroducedOn = introduced
    }
    private var studioCanMutate: Bool { !storageBlocked && !hasUnsavedChanges && !accountBusy && !(cloudRestorePending && profile == nil) }
    func recordNuanceRecognition(expressionId: String) {
        guard studioCanMutate, let expression = studioExpressions.first(where: { $0.id == expressionId }) else { return }
        var next = data
        let now = clock()
        if !next.introducedWordIds.contains(expression.wordId) { next.introducedWordIds.append(expression.wordId) }
        next.progressByWordId[expression.wordId] = next.progressByWordId[expression.wordId] ?? WordProgress(introducedOn: now, nextReviewOn: now.lucidAdding(days: 1))
        appendContextEvidence(to: &next, wordId: expression.wordId, kind: .recognition, quality: 2, independent: false, at: now)
        markContextExposure(wordId: expression.wordId, in: &next, at: clock())
        data = next
    }
    func expressionMatches(text: String, goalId: String?) -> [StudioExpression] {
        var scored: [(entry: StudioExpression, score: Int)] = []
        for entry in studioExpressions {
            let keywordCount = entry.intentKeywords.filter { studioContains(text, phrase: $0) }.count
            let goalScore = entry.goalIds.contains(goalId ?? "") ? 2 : 0
            let score = keywordCount * 3 + goalScore
            if score > 0 { scored.append((entry: entry, score: score)) }
        }
        scored.sort { left, right in
            if left.score != right.score { return left.score > right.score }
            if left.entry.contrasts.isEmpty != right.entry.contrasts.isEmpty { return !left.entry.contrasts.isEmpty }
            return left.entry.id < right.entry.id
        }
        return scored.map { $0.entry }
    }
    func studioDraft(_ key: String) -> String { data.studioDrafts?["\(profile?.roleId ?? ""):\(key)"] ?? "" }
    func saveStudioDraft(_ value: String, key: String) {
        guard studioCanMutate else { return }
        var drafts = data.studioDrafts ?? [:]; drafts["\(profile?.roleId ?? ""):\(key)"] = String(value.prefix(2_000)); data.studioDrafts = drafts
    }
    @discardableResult
    func saveExpressionGap(situation: String, expressionId: String, style: String) -> Bool {
        guard studioCanMutate, let role = profile?.roleId,
              let entry = studioExpressions.first(where: { $0.id == expressionId }), ["plain", "precise", "diplomatic"].contains(style),
              !situation.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return false }
        let phrase = style == "plain" ? entry.plain : (style == "precise" ? entry.precise : entry.diplomatic)
        let now = clock()
        let gap = ExpressionGap(id: UUID(), roleId: role, expressionId: entry.id, createdAt: now, situation: String(situation.prefix(2_000)), selectedStyle: style, selectedPhrase: phrase, nextReviewOn: now.lucidAdding(days: 1))
        var next = data; next.expressionGaps = Array(((next.expressionGaps ?? []) + [gap]).suffix(500)); data = next
        return !hasUnsavedChanges
    }
    @discardableResult
    func startRehearsal(scenarioId: String, mode: String = "rehearsal", gapId: UUID? = nil) -> UUID? {
        guard studioCanMutate, let role = profile?.roleId, ["rehearsal", "delayed", "transfer", "comeback"].contains(mode),
              let scenario = studioScenarios.first(where: { $0.id == scenarioId }) else { return nil }
        if let gapId { guard expressionGaps.contains(where: { $0.id == gapId && $0.expressionId == scenario.expressionId && (mode != "delayed" || $0.nextReviewOn.lucidStartOfDay <= clock().lucidStartOfDay) }) else { return nil } }
        if mode == "delayed" && gapId == nil { return nil }
        if ["transfer", "comeback"].contains(mode) { guard (data.transferSessions ?? [:]).values.contains(where: { $0.roleId == role && $0.mode == mode && $0.completedAt == nil && $0.scenarioIds.contains(scenarioId) && !$0.completedScenarioIds.contains(scenarioId) }) else { return nil } }
        // Continue the unfinished response. Re-entering cannot reset a revealed model.
        if let existing = data.rehearsalSessions?.values.first(where: { $0.roleId == role && $0.scenarioId == scenarioId && $0.mode == mode && $0.gapId == gapId && $0.completedAt == nil }) { return existing.id }
        var session = RehearsalSession(id: UUID(), roleId: role, scenarioId: scenarioId, expressionId: scenario.expressionId, startedAt: clock(), mode: mode, gapId: gapId)
        if let expression = studioExpressions.first(where: { $0.id == scenario.expressionId }) { session.modelSeen = contextWasExposed(wordId: expression.wordId) }
        var sessions = data.rehearsalSessions ?? [:]; sessions[session.id.uuidString] = session; data.rehearsalSessions = sessions
        return hasUnsavedChanges ? nil : session.id
    }
    func rehearsal(_ id: UUID) -> RehearsalSession? { data.rehearsalSessions?[id.uuidString].flatMap { $0.roleId == profile?.roleId ? $0 : nil } }
    func rehearsalScenario(_ session: RehearsalSession) -> StudioScenario? { studioScenarios.first { $0.id == session.scenarioId } }
    func rehearsalExpression(_ session: RehearsalSession) -> StudioExpression? { studioExpressions.first { $0.id == session.expressionId } }
    func rehearsalPrompt(_ session: RehearsalSession) -> String { guard let scenario = rehearsalScenario(session) else { return "" }; return session.mode == "rehearsal" ? scenario.prompt : scenario.freshPrompt }
    func rehearsalExample(_ session: RehearsalSession) -> String { guard let scenario = rehearsalScenario(session) else { return "" }; return session.mode == "rehearsal" ? scenario.exampleResponse : scenario.freshExampleResponse }
    func saveRehearsalResponse(_ value: String, id: UUID, retry: Bool = false) {
        guard studioCanMutate, var session = rehearsal(id), session.completedAt == nil else { return }
        if retry { guard session.checked else { return }; session.retry = String(value.prefix(2_000)) }
        else { guard !session.checked else { return }; session.response = String(value.prefix(2_000)) }
        var sessions = data.rehearsalSessions ?? [:]; sessions[id.uuidString] = session; data.rehearsalSessions = sessions
    }
    func checkRehearsal(_ id: UUID, revealWithoutAttempt: Bool = false) {
        guard studioCanMutate, var session = rehearsal(id), !session.checked, session.completedAt == nil else { return }
        guard revealWithoutAttempt || studioWords(session.response).count >= 4 else { return }
        session.checked = true
        session.capturedAt = clock()
        if let expression = rehearsalExpression(session) { session.modelSeen = session.modelSeen || revealWithoutAttempt || contextWasExposed(wordId: expression.wordId) }
        else { session.modelSeen = true }
        var next = data
        var sessions = next.rehearsalSessions ?? [:]; sessions[id.uuidString] = session; next.rehearsalSessions = sessions
        if let expression = rehearsalExpression(session) { markContextExposure(wordId: expression.wordId, in: &next, at: clock()) }
        data = next
    }
    func setRehearsalAssessment(_ id: UUID, meaning: Bool, naturalness: Bool) {
        guard studioCanMutate, var session = rehearsal(id), session.checked, session.completedAt == nil else { return }
        session.meaningConfirmed = meaning; session.naturalnessConfirmed = naturalness
        var sessions = data.rehearsalSessions ?? [:]; sessions[id.uuidString] = session; data.rehearsalSessions = sessions
    }
    func studioCheck(_ session: RehearsalSession, retry: Bool = false) -> StudioCheck {
        let response = retry ? session.retry : session.response
        let count = studioWords(response).count
        guard let entry = rehearsalExpression(session) else { return StudioCheck(wordCount: count, termFound: false, collocationFound: false, message: "The authored expression is unavailable. Your response is saved locally.") }
        let found = studioContains(response, phrase: entry.term)
        let pairing = entry.collocations.contains { studioContains(response, phrase: $0) }
        let message = count < 4 ? "Add context so you can compare your intended meaning with the example." : (found ? "The focus term is present. Compare meaning and naturalness yourself; this local phrase check does not grade them." : "The focus term is absent. Plain English may communicate well; this check cannot assess its meaning.")
        return StudioCheck(wordCount: count, termFound: found, collocationFound: pairing, message: message)
    }
    func rehearsalOriginalIsFresh(_ session: RehearsalSession) -> Bool {
        guard let captured = session.capturedAt else { return false }
        return captured <= clock() && captured.lucidDayKey == clock().lucidDayKey
    }
    @discardableResult
    func finishRehearsal(_ id: UUID, quality: ReviewQuality) -> Bool {
        guard studioCanMutate, var session = rehearsal(id), session.checked, session.completedAt == nil,
              let expression = rehearsalExpression(session) else { return false }
        let check = studioCheck(session)
        let claimedSuccess = quality.rawValue >= 2
        if claimedSuccess { guard !session.modelSeen, rehearsalOriginalIsFresh(session), check.wordCount >= 4, check.termFound, session.meaningConfirmed, session.naturalnessConfirmed else { return false } }
        let now = clock(); session.completedAt = now
        var next = data
        var sessions = next.rehearsalSessions ?? [:]; sessions[id.uuidString] = session; next.rehearsalSessions = sessions
        // A revised sentence follows the model; only the frozen original is independent.
        let retryCheck = studioCheck(session, retry: true)
        if (check.termFound && check.wordCount >= 4) || (retryCheck.termFound && retryCheck.wordCount >= 4) {
            if !next.introducedWordIds.contains(expression.wordId) { next.introducedWordIds.append(expression.wordId) }
            next.progressByWordId[expression.wordId] = next.progressByWordId[expression.wordId] ?? WordProgress(introducedOn: now, nextReviewOn: now.lucidAdding(days: 1))
            appendContextEvidence(to: &next, wordId: expression.wordId, kind: .selfAssessedProduction, quality: claimedSuccess ? quality.rawValue : min(1, quality.rawValue), independent: check.termFound && check.wordCount >= 4 && !session.modelSeen && rehearsalOriginalIsFresh(session), at: now, capturedAt: rehearsalOriginalIsFresh(session) ? session.capturedAt : nil)
        }
        if let gapId = session.gapId, let index = next.expressionGaps?.firstIndex(where: { $0.id == gapId }) {
            next.expressionGaps?[index].lastPractisedAt = now
            next.expressionGaps?[index].nextReviewOn = now.lucidAdding(days: claimedSuccess ? 3 : 1)
        }
        // Initial rehearsal schedules the phrase for a different situation tomorrow.
        if session.mode == "rehearsal", session.gapId == nil, !(next.expressionGaps ?? []).contains(where: { $0.expressionId == expression.id && $0.roleId == session.roleId }) {
            next.expressionGaps = (next.expressionGaps ?? []) + [ExpressionGap(id: UUID(), roleId: session.roleId, expressionId: expression.id, createdAt: now, situation: rehearsalPrompt(session), selectedStyle: "precise", selectedPhrase: expression.precise, nextReviewOn: now.lucidAdding(days: 1))]
        }
        for (key, var transfer) in next.transferSessions ?? [:] where transfer.completedAt == nil && transfer.mode == session.mode && transfer.roleId == session.roleId && transfer.scenarioIds.contains(session.scenarioId) {
            if !transfer.completedScenarioIds.contains(session.scenarioId) { transfer.completedScenarioIds.append(session.scenarioId) }
            if transfer.scenarioIds.allSatisfy(transfer.completedScenarioIds.contains) { transfer.completedAt = now }
            var transfers = next.transferSessions ?? [:]; transfers[key] = transfer; next.transferSessions = transfers
        }
        data = next
        return !hasUnsavedChanges
    }
    var fifthDayMilestone: Int {
        let pending = (data.transferSessions ?? [:]).values.filter { $0.roleId == profile?.roleId && $0.mode == "transfer" && $0.completedAt == nil }.map(\.milestone).min()
        if let pending { return pending }
        let completed = (data.transferSessions ?? [:]).values.filter { $0.roleId == profile?.roleId && $0.mode == "transfer" && $0.completedAt != nil }.map(\.milestone).max() ?? 0
        let next = completed + 5
        return practiceDayKeys.count >= next ? next : 0
    }
    private var eligibleTransferScenarios: [StudioScenario] {
        let saved = Set(expressionGaps.map(\.expressionId))
        let practised = Set(data.introducedWordIds + evidence().map(\.wordId))
        var includedWords = Set<String>()
        return studioScenarios.filter { scenario in
            guard scenario.wordIds.contains(where: practised.contains) || saved.contains(scenario.expressionId) else { return false }
            // A shared curated and catalogue scenario should not quiz the same term twice.
            guard scenario.wordIds.allSatisfy({ !includedWords.contains($0) }) else { return false }
            includedWords.formUnion(scenario.wordIds)
            return true
        }
    }
    var fifthDayChallengeDue: Bool {
        fifthDayMilestone >= 5 && !eligibleTransferScenarios.isEmpty
    }
    var daysAway: Int {
        guard let last = (activities.map(\.date) + data.sessions.map(\.completedAt) + contextEvidence.map(\.recordedAt) + (data.rehearsalSessions ?? [:]).values.compactMap(\.completedAt)).max() else { return 0 }
        return max(0, Calendar.current.dateComponents([.day], from: last.lucidStartOfDay, to: currentDate.lucidStartOfDay).day ?? 0)
    }
    var comebackSuggested: Bool {
        daysAway >= 3 && !eligibleTransferScenarios.isEmpty && !(data.transferSessions ?? [:]).values.contains { $0.roleId == profile?.roleId && $0.mode == "comeback" && $0.startedAt.lucidDayKey == currentDate.lucidDayKey && $0.completedAt != nil }
    }
    @discardableResult
    func startTransfer(mode: String) -> String? {
        guard studioCanMutate, let role = profile?.roleId, mode == "transfer" ? fifthDayChallengeDue : (mode == "comeback" && comebackSuggested) else { return nil }
        if let pending = (data.transferSessions ?? [:]).values.filter({ $0.roleId == role && $0.mode == mode && $0.completedAt == nil }).sorted(by: { $0.startedAt < $1.startedAt }).first { return pending.id }
        let key = "\(role):\(mode):\(mode == "transfer" ? String(fifthDayMilestone) : currentDate.lucidDayKey)"
        if data.transferSessions?[key] != nil { return key }
        let selected = Array(eligibleTransferScenarios.prefix(3)).map(\.id)
        guard !selected.isEmpty else { return nil }
        let session = TransferSession(id: key, roleId: role, milestone: mode == "transfer" ? fifthDayMilestone : 0, startedAt: clock(), mode: mode, scenarioIds: selected)
        var sessions = data.transferSessions ?? [:]; sessions[key] = session; data.transferSessions = sessions
        return hasUnsavedChanges ? nil : key
    }
    var discoveryWords: [ProfessionalWord] {
        let words = catalog.words.filter { $0.learningMode == "active" && $0.roles.contains(profile?.roleId ?? "") }.map { $0.contextualized(for: profile?.roleId) }
        return Array((words.filter { !data.introducedWordIds.contains($0.id) } + words.filter { data.introducedWordIds.contains($0.id) }).prefix(10))
    }
    private func studioWords(_ value: String) -> [String] { studioNormalized(value).split(separator: " ").map(String.init) }
    private func studioNormalized(_ value: String) -> String { value.lowercased().replacingOccurrences(of: "[’']", with: "", options: .regularExpression).replacingOccurrences(of: "[^a-z0-9]+", with: " ", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines) }
    private func studioContains(_ value: String, phrase: String) -> Bool { (" " + studioNormalized(value) + " ").contains(" " + studioNormalized(phrase) + " ") }
}


extension ContextEvidence {
    static func dayMatches(_ key: String, instant: Date) -> Bool {
        guard let day = calendarDay(key), let actual = utcAnchorDay(instant) else { return false }
        // Local calendar dates can differ from UTC by one day, including travel.
        return abs(day.timeIntervalSince(actual)) <= 86_400
    }
    static func conservative(_ left: Self, _ right: Self) -> Self {
        var chosen: Self
        if left.independent != right.independent { chosen = left.independent ? right : left }
        else if left.quality != right.quality { chosen = left.quality < right.quality ? left : right }
        else { chosen = left.recordedAt <= right.recordedAt ? left : right }
        // Missing original capture cannot become evidence after the event was saved.
        // A later capture is the conservative interpretation of conflicting copies.
        if let a = left.capturedAt, let b = right.capturedAt { chosen.capturedAt = max(a, b) }
        else { chosen.capturedAt = nil }
        return chosen
    }
    static func utcDayKey(_ date: Date) -> String { String(ISO8601DateFormatter().string(from: date).prefix(10)) }
    static func localCalendarDay(_ key: String) -> Date? {
        guard calendarDay(key) != nil else { return nil }
        let parts = key.split(separator: "-").compactMap { Int($0) }
        return Calendar.current.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2], hour: 12))
    }
    static func utcAnchorDay(_ date: Date) -> Date? {
        guard date.timeIntervalSince1970.isFinite else { return nil }
        return Date(timeIntervalSince1970: floor(date.timeIntervalSince1970 / 86_400) * 86_400)
    }
    static func calendarDay(_ key: String) -> Date? {
        let formatter = DateFormatter(); formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX"); formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"; formatter.isLenient = false
        guard let date = formatter.date(from: key), formatter.string(from: date) == key else { return nil }
        return date
    }
}


@MainActor
extension LearningStore {
    /// Project only authored selections and text-free progress from the actual UI store.
    /// A private draft edit does not advance checkpoint timestamps unless its safe state changed.
    func projectSharedLearning(_ learner: LearnerData, at now: Date) -> SharedLearningState? {
        var shared = learner.sharedLearning ?? SharedLearningState()
        let instant = SharedLearningState.stamp(now)
        for (role, plan) in learner.dailyRolePlans ?? [:] {
            guard catalog.roles.contains(where: { $0.id == role }), ContextEvidence.calendarDay(plan.dayKey) != nil,
                  plan.wordIds.count <= 3, plan.wordIds.allSatisfy({ id in catalog.words.contains { $0.id == id && $0.roles.contains(role) } }) else { continue }
            let key = "\(plan.dayKey):\(role)"
            let cursor = learner.practiceCursors?[role].flatMap { $0.dayKey == plan.dayKey && plan.wordIds.contains($0.wordId) ? $0.wordId : nil }
            var answers: [String: SharedLessonAnswer] = [:]
            var record = learner; record.profile?.roleId = role; record.currentWordIds = plan.wordIds; record.lessonDayKey = plan.dayKey
            for id in plan.wordIds {
                if let challenge = practiceChallenge(for: id, record: record), let attempt = learner.tapPracticeAttempts?[challenge.key], attempt.signature == challenge.signature,
                   let last = attempt.choices.last, challenge.options.contains(where: { $0.id == last }) {
                    answers[id] = .init(choiceId: last, hinted: attempt.revealed)
                }
                if learner.tapPracticeAttempts?["\(plan.dayKey):\(role):\(id)"]?.revealed == true {
                    let sense = "\(id)::\(role)"
                    if shared.exposures[sense] == nil || shared.exposures[sense]!.dayKey < plan.dayKey {
                        let first = ContextEvidence.localCalendarDay(plan.dayKey)?.lucidStartOfDay ?? now
                        shared.exposures[sense] = .init(dayKey: plan.dayKey, firstSeenAt: SharedLearningState.stamp(first))
                    }
                }
            }
            var candidate = SharedLessonCheckpoint(roleId: role, dayKey: plan.dayKey, wordIds: plan.wordIds,
                completedWordIds: Array(Set(plan.completedWordIds ?? [])).filter(plan.wordIds.contains).sorted(),
                cursorWordId: cursor, answers: answers.isEmpty ? nil : answers, updatedAt: instant)
            if let own = shared.lessonCheckpoints[key] { candidate.updatedAt = own.updatedAt; if candidate != own { candidate.updatedAt = instant } }
            shared.lessonCheckpoints[key] = candidate
        }
        for (role, draft) in learner.courseCheckDrafts ?? [:] {
            guard let path = catalog.learningPaths?.first(where: { $0.roleId == role }), draft.matches(path), let questions = path.startingCheck else { continue }
            var candidate = SharedStartingCheck(roleId: role, pathId: path.id, questionIds: questions.map(\.id), answers: draft.answers, updatedAt: instant)
            if let own = shared.startingChecks[role] { candidate.updatedAt = own.updatedAt; if candidate != own { candidate.updatedAt = instant } }
            shared.startingChecks[role] = candidate
        }
        for gap in learner.expressionGaps ?? [] {
            guard let expression = suppliedExpressionContent?.expressions.first(where: { $0.id == gap.expressionId && $0.roleIds.contains(gap.roleId) }),
                  ["plain", "precise", "diplomatic"].contains(gap.selectedStyle) else { continue }
            let phrase = gap.selectedStyle == "plain" ? expression.plain : gap.selectedStyle == "precise" ? expression.precise : expression.diplomatic
            // Do not transmit any privately edited phrase or the learner's situation.
            guard gap.selectedPhrase == phrase else { continue }
            let key = gap.id.uuidString.lowercased()
            shared.notebook[key] = .init(id: key, roleId: gap.roleId, expressionId: gap.expressionId, style: gap.selectedStyle, phrase: phrase,
                createdAt: SharedLearningState.stamp(gap.createdAt), nextReviewOn: gap.nextReviewOn.lucidDayKey,
                lastPractisedAt: gap.lastPractisedAt.map(SharedLearningState.stamp))
        }
        for session in (learner.rehearsalSessions ?? [:]).values where ["rehearsal", "delayed"].contains(session.mode) {
            guard suppliedExpressionContent?.scenarios.contains(where: { $0.id == session.scenarioId && $0.expressionId == session.expressionId && $0.roleIds.contains(session.roleId) }) == true else { continue }
            let key = session.id.uuidString.lowercased()
            shared.rehearsals[key] = .init(id: key, roleId: session.roleId, scenarioId: session.scenarioId, expressionId: session.expressionId,
                mode: session.mode == "rehearsal" ? "initial" : "delayed", gapId: session.gapId?.uuidString.lowercased(), startedAt: SharedLearningState.stamp(session.startedAt),
                completedAt: session.completedAt.map(SharedLearningState.stamp), modelSeen: session.modelSeen)
        }
        for session in (learner.transferSessions ?? [:]).values {
            guard !session.scenarioIds.isEmpty, session.scenarioIds.count <= 3,
                  session.scenarioIds.allSatisfy({ id in suppliedExpressionContent?.scenarios.contains { $0.id == id && $0.roleIds.contains(session.roleId) } == true }) else { continue }
            shared.challenges[session.id] = .init(id: session.id, roleId: session.roleId, mode: session.mode, milestone: session.milestone,
                startedAt: SharedLearningState.stamp(session.startedAt), scenarioIds: session.scenarioIds,
                completedScenarioIds: session.completedScenarioIds.sorted(), completedAt: session.completedAt.map(SharedLearningState.stamp))
        }
        for (sense, day) in learner.contextExposures ?? [:] where ContextEvidence.calendarDay(day) != nil && catalog.words.contains(where: { word in word.roles.contains { sense == "\(word.id)::\($0)" } }) {
            if shared.exposures[sense]?.dayKey == day { continue }
            if shared.exposures[sense] == nil || day > shared.exposures[sense]!.dayKey {
                let first = ContextEvidence.localCalendarDay(day)?.lucidStartOfDay ?? now
                shared.exposures[sense] = .init(dayKey: day, firstSeenAt: SharedLearningState.stamp(first))
            }
        }
        return learner.sharedLearning == nil && shared.lessonCheckpoints.isEmpty && shared.startingChecks.isEmpty && shared.notebook.isEmpty
            && shared.rehearsals.isEmpty && shared.challenges.isEmpty && shared.exposures.isEmpty ? nil : shared
    }

    /// Hydrate portable metadata into the same collections used by native screens.
    /// Missing private responses never become fresh evidence or a pretend completed sentence.
    func hydrateSharedLearning(_ learner: LearnerData, at now: Date) -> LearnerData {
        guard let shared = learner.sharedLearning, shared.isValid else { return learner }
        var result = learner
        for entry in shared.startingChecks.values {
            guard let path = catalog.learningPaths?.first(where: { $0.roleId == entry.roleId && $0.id == entry.pathId }),
                  let questions = path.startingCheck, questions.map(\.id) == entry.questionIds else { continue }
            var drafts = result.courseCheckDrafts ?? [:]
            drafts[entry.roleId] = .init(pathId: path.id, answers: entry.answers, questionSignature: CourseCheckDraft.signature(for: questions))
            result.courseCheckDrafts = drafts
        }
        for entry in shared.lessonCheckpoints.values where entry.dayKey == now.lucidDayKey {
            guard catalog.roles.contains(where: { $0.id == entry.roleId }), entry.wordIds.allSatisfy({ id in catalog.words.contains { $0.id == id && $0.roles.contains(entry.roleId) && $0.learningMode == "active" } }) else { continue }
            var plans = result.dailyRolePlans ?? [:]
            plans[entry.roleId] = .init(dayKey: entry.dayKey, wordIds: entry.wordIds, completedWordIds: entry.completedWordIds)
            result.dailyRolePlans = plans
            if result.profile?.roleId == entry.roleId {
                result.lessonRoleId = entry.roleId; result.lessonDayKey = entry.dayKey
                result.currentWordIds = entry.wordIds; result.currentLessonDate = now.lucidStartOfDay
            }
            if let cursor = entry.cursorWordId { var cursors = result.practiceCursors ?? [:]; cursors[entry.roleId] = .init(dayKey: entry.dayKey, wordId: cursor); result.practiceCursors = cursors }
            var record = result; record.profile?.roleId = entry.roleId; record.currentWordIds = entry.wordIds; record.lessonDayKey = entry.dayKey
            // Help can be shared without an answer. Recreate the supported card,
            // not a correct answer or independent learning credit.
            for word in entry.wordIds where shared.exposures["\(word)::\(entry.roleId)"]?.dayKey == entry.dayKey {
                guard let challenge = practiceChallenge(for: word, record: record) else { continue }
                var attempts = result.tapPracticeAttempts ?? [:]
                if let stale = attempts[challenge.key], stale.signature != challenge.signature { continue }
                var attempt = attempts[challenge.key] ?? TapPracticeAttempt(signature: challenge.signature)
                attempt.revealed = true; attempts[challenge.key] = attempt; result.tapPracticeAttempts = attempts
            }
            for (word, answer) in entry.answers ?? [:] {
                guard let challenge = practiceChallenge(for: word, record: record), challenge.options.contains(where: { $0.id == answer.choiceId }) else { continue }
                var attempts = result.tapPracticeAttempts ?? [:]
                // A known obsolete local question cannot be repaired by unversioned
                // remote choices. Explicit current-content backup recovery can repair it.
                if let stale = attempts[challenge.key], stale.signature != challenge.signature { continue }
                var attempt = attempts[challenge.key] ?? TapPracticeAttempt(signature: challenge.signature)
                if !attempt.choices.contains(answer.choiceId) { attempt.choices.append(answer.choiceId) }
                let pendingCorrect = answer.choiceId == challenge.correctId && !entry.completedWordIds.contains(word)
                attempt.revealed = attempt.revealed || answer.hinted || pendingCorrect
                if pendingCorrect {
                    let sense = "\(word)::\(entry.roleId)"
                    var exposed = result.contextExposures ?? [:]; exposed[sense] = entry.dayKey; result.contextExposures = exposed
                    var updatedShared = result.sharedLearning ?? shared
                    let incoming = SharedExposure(dayKey: entry.dayKey, firstSeenAt: entry.updatedAt)
                    if let previous = updatedShared.exposures[sense], previous.dayKey == entry.dayKey {
                        updatedShared.exposures[sense] = .init(dayKey: entry.dayKey, firstSeenAt: SharedLearningMerge.earlier(previous.firstSeenAt, incoming.firstSeenAt))
                    } else { updatedShared.exposures[sense] = incoming }
                    result.sharedLearning = updatedShared
                }
                attempts[challenge.key] = attempt; result.tapPracticeAttempts = attempts
            }
        }
        var gaps = Dictionary((result.expressionGaps ?? []).map { ($0.id.uuidString.lowercased(), $0) }, uniquingKeysWith: { first, _ in first })
        for (key, entry) in shared.notebook {
            guard let expression = suppliedExpressionContent?.expressions.first(where: { $0.id == entry.expressionId && $0.roleIds.contains(entry.roleId) }),
                  let id = UUID(uuidString: entry.id), let created = SharedLearningState.instant(entry.createdAt),
                  let due = ContextEvidence.localCalendarDay(entry.nextReviewOn) else { continue }
            let phrase = entry.style == "plain" ? expression.plain : entry.style == "precise" ? expression.precise : expression.diplomatic
            guard phrase == entry.phrase else { continue }
            var gap = gaps[key] ?? .init(id: id, roleId: entry.roleId, expressionId: entry.expressionId, createdAt: created,
                situation: "", selectedStyle: entry.style, selectedPhrase: phrase, nextReviewOn: due)
            guard gap.roleId == entry.roleId, gap.expressionId == entry.expressionId, gap.selectedStyle == entry.style else { continue }
            gap = .init(id: gap.id, roleId: gap.roleId, expressionId: gap.expressionId, createdAt: min(gap.createdAt, created),
                situation: gap.situation, selectedStyle: gap.selectedStyle, selectedPhrase: gap.selectedPhrase,
                nextReviewOn: due, lastPractisedAt: entry.lastPractisedAt.flatMap(SharedLearningState.instant))
            gaps[key] = gap
        }
        result.expressionGaps = gaps.isEmpty ? nil : gaps.values.sorted { $0.createdAt < $1.createdAt }
        var rehearsals = result.rehearsalSessions ?? [:]
        for entry in shared.rehearsals.values {
            guard let id = UUID(uuidString: entry.id), let started = SharedLearningState.instant(entry.startedAt),
                  suppliedExpressionContent?.scenarios.contains(where: { $0.id == entry.scenarioId && $0.expressionId == entry.expressionId && $0.roleIds.contains(entry.roleId) }) == true else { continue }
            let isNewOnDevice = rehearsals[id.uuidString] == nil
            var session = rehearsals[id.uuidString] ?? .init(id: id, roleId: entry.roleId, scenarioId: entry.scenarioId, expressionId: entry.expressionId,
                startedAt: started, mode: entry.mode == "initial" ? "rehearsal" : "delayed", gapId: entry.gapId.flatMap(UUID.init(uuidString:)))
            guard session.roleId == entry.roleId, session.scenarioId == entry.scenarioId else { continue }
            if isNewOnDevice { session.receivedFromSync = true }
            session.startedAt = min(session.startedAt, started)
            session.modelSeen = session.modelSeen || entry.modelSeen
            session.completedAt = [session.completedAt, entry.completedAt.flatMap(SharedLearningState.instant)].compactMap { $0 }.min()
            if session.completedAt != nil { session.checked = true }
            rehearsals[id.uuidString] = session
        }
        result.rehearsalSessions = rehearsals.isEmpty ? nil : rehearsals
        var transfers = result.transferSessions ?? [:]
        for entry in shared.challenges.values {
            guard let started = SharedLearningState.instant(entry.startedAt), entry.scenarioIds.allSatisfy({ id in suppliedExpressionContent?.scenarios.contains { $0.id == id && $0.roleIds.contains(entry.roleId) } == true }) else { continue }
            var session = transfers[entry.id] ?? .init(id: entry.id, roleId: entry.roleId, milestone: entry.milestone, startedAt: started, mode: entry.mode, scenarioIds: entry.scenarioIds)
            guard session.roleId == entry.roleId, session.mode == entry.mode, session.scenarioIds == entry.scenarioIds else { continue }
            session.startedAt = min(session.startedAt, started)
            session.completedScenarioIds = Array(Set(session.completedScenarioIds + entry.completedScenarioIds)).sorted()
            session.completedAt = [session.completedAt, entry.completedAt.flatMap(SharedLearningState.instant)].compactMap { $0 }.min()
            transfers[entry.id] = session
        }
        result.transferSessions = transfers.isEmpty ? nil : transfers
        for (key, exposure) in shared.exposures {
            guard catalog.words.contains(where: { word in word.roles.contains { key == "\(word.id)::\($0)" } }) else { continue }
            var exposures = result.contextExposures ?? [:]; exposures[key] = max(exposures[key] ?? "", exposure.dayKey); result.contextExposures = exposures
        }
        return result
    }
}
