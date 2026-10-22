import Foundation

// Production stores/models, ephemeral fixture files and an injected mock HTTP protocol.
// This suite never reads Keychain, private configuration, notifications or learner data.
enum ReminderScheduler { static func cancel() {} }
struct SharedTestError: Error, CustomStringConvertible { let description: String }
func sharedRequire(_ condition: @autoclosure () throws -> Bool, _ message: String) throws {
    if try !condition() { throw SharedTestError(description: message) }
}
final class SharedFixtureVault {
    var session: AccountSession?
    init(_ session: AccountSession? = nil) { self.session = session }
    var storage: AccountSessionStorage { .init(load: { self.session }, save: { self.session = $0 }, clear: { self.session = nil }) }
}
final class SharedFixtureProtocol: URLProtocol {
    struct Reply { var status = 200; var body: Any = [:]; var failure: Error? }
    static let lock = NSLock()
    static var handler: (URLRequest) throws -> Reply = { _ in .init(failure: URLError(.notConnectedToInternet)) }
    static func configure(_ next: @escaping (URLRequest) throws -> Reply) { lock.lock(); handler = next; lock.unlock() }
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        Self.lock.lock(); let respond = Self.handler; Self.lock.unlock()
        do {
            try sharedRequire(request.url?.host == "shared-fixture.invalid", "Fixture escaped its synthetic host")
            let reply = try respond(request)
            if let failure = reply.failure { throw failure }
            let response = HTTPURLResponse(url: request.url!, statusCode: reply.status, httpVersion: "HTTP/1.1", headerFields: ["Content-Type": "application/json"])!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: try JSONSerialization.data(withJSONObject: reply.body))
            client?.urlProtocolDidFinishLoading(self)
        } catch { client?.urlProtocol(self, didFailWithError: error) }
    }
    override func stopLoading() {}
}

@main @MainActor struct NativeSharedSyncTests {
    static var directories: [URL] = []
    static var stores: [LearningStore] = []
    static var count = 0
    static func json<T: Encodable>(_ value: T) throws -> Any { try JSONSerialization.jsonObject(with: JSONEncoder().encode(value)) }
    static func requestBody(_ request: URLRequest) throws -> [String: Any] {
        let bytes: Data
        if let body = request.httpBody { bytes = body }
        else if let stream = request.httpBodyStream {
            stream.open(); defer { stream.close() }
            var body = Data(), buffer = [UInt8](repeating: 0, count: 4096)
            while true { let amount = stream.read(&buffer, maxLength: buffer.count); if amount <= 0 { break }; body.append(contentsOf: buffer.prefix(amount)) }
            bytes = body
        } else { throw SharedTestError(description: "Missing body") }
        return try JSONSerialization.jsonObject(with: bytes) as! [String: Any]
    }
    static func run(_ name: String, _ body: () async throws -> Void) async throws { try await body(); count += 1; print("PASS \(name)") }
    static func main() async throws {
        let catalogURL = URL(fileURLWithPath: CommandLine.arguments[1])
        let catalog = try JSONDecoder().decode(ProfessionalCatalog.self, from: Data(contentsOf: catalogURL))
        let content = try JSONDecoder().decode(ExpressionContent.self, from: Data(contentsOf: catalogURL.deletingLastPathComponent().appendingPathComponent("expression-content.json")))
        let role = catalog.roles.first { $0.id == "finance-accounting" }!
        let otherRole = catalog.roles.first { $0.id == "technology-engineering" }!
        let path = catalog.learningPaths!.first { $0.roleId == role.id }!
        let expression = content.expressions.first { $0.id == "explain-the-reason" }!
        let scenario = content.scenarios.first { $0.expressionId == expression.id && $0.roleIds.contains(role.id) }!
        let now = Calendar.current.date(from: DateComponents(year: 2026, month: 10, day: 13, hour: 12))!
        let userID = UUID(uuidString: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa")!
        let account = AccountSession(accessToken: "synthetic-access", refreshToken: "synthetic-refresh", expiresAt: Date().timeIntervalSince1970 + 3600, user: .init(id: userID, email: "fixture@example.invalid"))
        func profile(_ role: ProfessionalRole) -> LearnerProfile { .init(roleId: role.id, seniorityId: catalog.seniorityLevels[0].id, situationIds: [role.situations[0].id], goalIds: [role.defaultGoalIds[0]]) }
        func record() -> LearnerData { var result = LearnerData(); result.profile = profile(role); result.profileUpdatedAt = now; result.dailyWordGoal = 3; return result }
        func store(_ initial: LearnerData = LearnerData(), api: AccountService? = nil, signedIn: Bool = false) throws -> (LearningStore, LearningPersistence, SharedFixtureVault) {
            let directory = FileManager.default.temporaryDirectory.appendingPathComponent("lucid-shared-fixture-\(UUID())")
            directories.append(directory)
            let persistence = LearningPersistence(directory: directory)
            try persistence.save(signedIn ? LearnerData() : initial, scope: "guest")
            if signedIn { try persistence.save(initial, scope: userID.uuidString) }
            let vault = SharedFixtureVault(signedIn ? account : nil)
            let result = LearningStore(catalog: catalog, expressionContent: content, persistence: persistence, now: { now }, accountService: api, sessionStorage: vault.storage)
            stores.append(result)
            return (result, persistence, vault)
        }
        func sharedNotebook() -> SharedLearningState {
            var result = SharedLearningState(); let id = UUID().uuidString.lowercased()
            result.notebook[id] = .init(id: id, roleId: role.id, expressionId: expression.id, style: "diplomatic", phrase: expression.diplomatic, createdAt: SharedLearningState.stamp(now), nextReviewOn: now.lucidAdding(days: 1).lucidDayKey)
            return result
        }
        defer { for store in stores { store.syncTask?.cancel() }; for directory in directories { try? FileManager.default.removeItem(at: directory) } }

        try await run("old native v2 records decode and cloud projection preserves optional shared account records") {
            var learner = record(); learner.sharedLearning = sharedNotebook()
            let cloud = LearningMerge.cloudRecord(learner)
            try sharedRequire(cloud.sharedLearning == learner.sharedLearning, "Shared metadata was stripped with device-private fields")
            var object = try json(learner) as! [String: Any]; object.removeValue(forKey: "sharedLearning")
            let old = try JSONDecoder().decode(LearnerData.self, from: JSONSerialization.data(withJSONObject: object))
            try sharedRequire(old.sharedLearning == nil && old.profile == learner.profile, "Additive shared schema broke old records")
            let combined = LearningMerge.combine(local: learner, remote: old)
            try sharedRequire(combined.sharedLearning == learner.sharedLearning, "Old client omission erased shared notebook")
        }
        try await run("earlier mastery milestones survive conservative sync locally and in backups without current retention") {
            var old = record()
            let word = catalog.words.first { $0.roles.contains(role.id) }!
            old.progressByWordId[word.id] = WordProgress(introducedOn: now, nextReviewOn: now, mastered: true)
            var peer = record(); peer.updatedAt = now.addingTimeInterval(60)
            peer.progressByWordId[word.id] = WordProgress(introducedOn: now, nextReviewOn: now, mastered: false)
            peer.activities = [LearningActivity(id: UUID(), kind: .review, wordId: word.id, date: now, dayKey: now.lucidDayKey, quality: 1, productive: false)]
            let merged = LearningMerge.combine(local: old, remote: peer)
            try sharedRequire(merged.historicalMasteredWordIds == [word.id] && merged.progressByWordId[word.id]?.mastered == false, "Conservative merge erased historical milestone or retained unsupported mastery")
            let (native, _, _) = try store(merged)
            try sharedRequire(native.historicalMasteredCount == 1 && native.retainedContextCount == 0, "Historic marker became current role retention")
            let envelope = try JSONDecoder().decode(LearningPersistence.Envelope.self, from: LucidBackupDocument(data: merged).content)
            let restored = LearningMerge.restoringBackup(local: record(), incoming: envelope.learner, restoreProfile: true)
            try sharedRequire(restored.historicalMasteredWordIds == [word.id] && LearningMerge.cloudRecord(restored).historicalMasteredWordIds == nil, "Historical marker failed backup or entered cloud")
        }
        try await run("saving a native selected phrase projects authored text but excludes private situation and response") {
            let (native, _, _) = try store(record()); native.prepareToday()
            try sharedRequire(native.saveExpressionGap(situation: "SYNTHETIC PRIVATE INTENTION", expressionId: expression.id, style: "plain"), "Native notebook could not save")
            native.saveStudioDraft("SYNTHETIC PRIVATE RESPONSE", key: "gap")
            let cloud = LearningMerge.cloudRecord(native.data)
            let bytes = String(decoding: try JSONEncoder().encode(cloud), as: UTF8.self)
            try sharedRequire(cloud.sharedLearning?.notebook.values.first?.phrase == expression.plain, "Selected author phrase not shared")
            try sharedRequire(!bytes.contains("SYNTHETIC PRIVATE") && cloud.expressionGaps == nil && cloud.studioDrafts == nil, "Private text entered account payload")
            var altered = native.data; altered.expressionGaps = [.init(id: UUID(), roleId: role.id, expressionId: expression.id, createdAt: now, situation: "Private", selectedStyle: "plain", selectedPhrase: "SYNTHETIC PRIVATE REWRITE", nextReviewOn: now)]
            try sharedRequire(native.projectSharedLearning(altered, at: now)?.notebook.values.contains { $0.phrase == "SYNTHETIC PRIVATE REWRITE" } == false, "Free text masqueraded as authored selection")
        }
        try await run("web-shaped selected phrase hydrates native notebook, due date and honest empty private situation") {
            var incoming = record(); incoming.sharedLearning = sharedNotebook()
            let (native, _, _) = try store(incoming)
            try sharedRequire(native.expressionGaps.count == 1 && native.expressionGaps[0].selectedPhrase == expression.diplomatic && native.expressionGaps[0].situation.isEmpty, "Remote notebook was only retained as opaque metadata")
            try sharedRequire(native.expressionGaps[0].nextReviewOn.lucidDayKey == now.lucidAdding(days: 1).lucidDayKey, "Remote next review changed logical day")
            let combined = native.hydrateSharedLearning(LearningMerge.combine(local: native.data, remote: incoming), at: now)
            try sharedRequire(combined.expressionGaps?.count == 1, "Repeated fetch duplicated notebook IDs")
        }
        try await run("shared partial starting check resumes using current native authored question signature without placement or credit") {
            var incoming = record(); var shared = SharedLearningState()
            shared.startingChecks[role.id] = .init(roleId: role.id, pathId: path.id, questionIds: path.startingCheck!.map(\.id), answers: [0, -1], updatedAt: SharedLearningState.stamp(now))
            incoming.sharedLearning = shared
            let (native, _, _) = try store(incoming)
            try sharedRequire(native.startingCheckAnswers == [0, -1] && native.startingCheckScore == nil && native.data.pathPlacements == nil && native.totalXP == 0, "Partial check was discarded or granted placement/mastery")
            var changed = incoming; changed.sharedLearning!.startingChecks[role.id] = .init(roleId: role.id, pathId: path.id, questionIds: Array(path.startingCheck!.map(\.id).reversed()), answers: [2], updatedAt: SharedLearningState.stamp(now))
            let (stale, _, _) = try store(changed)
            try sharedRequire(stale.startingCheckAnswers.isEmpty, "Changed authored questions reused positional answers")
        }
        try await run("shared lesson checkpoint hydrates actual current plan and cursor; unknown choice IDs cannot earn credit") {
            var incoming = record(); var shared = SharedLearningState(); let ids = Array(path.wordIds.prefix(3)); let key = "\(now.lucidDayKey):\(role.id)"
            shared.lessonCheckpoints[key] = .init(roleId: role.id, dayKey: now.lucidDayKey, wordIds: ids, completedWordIds: [ids[0]], cursorWordId: ids[1], answers: [ids[1]: .init(choiceId: "forged-choice", hinted: false)], updatedAt: SharedLearningState.stamp(now))
            incoming.sharedLearning = shared
            let (native, _, _) = try store(incoming); native.prepareToday()
            try sharedRequire(native.data.currentWordIds == ids && native.practiceResumeWordId == ids[1] && native.isCurrentRoleWordComplete(ids[0]), "Native practice ignored synced checkpoint")
            let challenge = native.practiceChallenge(for: ids[1])!
            try sharedRequire(native.tapAttempt(for: challenge) == nil && native.totalXP == 0, "Unknown answer acquired credit")
        }
        try await run("a Help-only shared checkpoint restores the supported card without manufacturing an answer") {
            var incoming = record(); var shared = SharedLearningState(); let ids = Array(path.wordIds.prefix(3))
            let key = "\(now.lucidDayKey):\(role.id)"
            shared.lessonCheckpoints[key] = .init(roleId: role.id, dayKey: now.lucidDayKey, wordIds: ids, completedWordIds: [], cursorWordId: ids[0], updatedAt: SharedLearningState.stamp(now))
            shared.exposures["\(ids[0])::\(role.id)"] = .init(dayKey: now.lucidDayKey, firstSeenAt: SharedLearningState.stamp(now))
            incoming.sharedLearning = shared
            let (native, _, _) = try store(incoming); let challenge = native.practiceChallenge(for: ids[0])!
            try sharedRequire(native.tapAttempt(for: challenge)?.revealed == true && native.tapAttempt(for: challenge)?.choices.isEmpty == true && native.totalXP == 0 && !native.isCurrentRoleWordComplete(ids[0]), "A Help checkpoint was dropped or became answer credit")
        }
        try await run("equal-timestamp starting choices converge and later notebook practice advances its associated due date") {
            var a = SharedLearningState(), b = SharedLearningState(); let updated = SharedLearningState.stamp(now)
            a.startingChecks[role.id] = .init(roleId: role.id, pathId: path.id, questionIds: path.startingCheck!.map(\.id), answers: [1, 0], updatedAt: updated)
            b.startingChecks[role.id] = .init(roleId: role.id, pathId: path.id, questionIds: path.startingCheck!.map(\.id), answers: [0, 1], updatedAt: updated)
            try sharedRequire(SharedLearningMerge.combine(a, b) == SharedLearningMerge.combine(b, a), "Equal-time starting answers never converged")
            let wholeSecond = String(SharedLearningState.stamp(now).replacingOccurrences(of: ".000Z", with: "Z"))
            let fractionalLater = SharedLearningState.stamp(now.addingTimeInterval(0.001))
            try sharedRequire(SharedLearningMerge.earlier(wholeSecond, fractionalLater) == wholeSecond, "Lexical ISO ordering reversed exposure chronology")
            a = sharedNotebook(); b = a; let key = a.notebook.keys.first!
            a.notebook[key]!.nextReviewOn = now.lucidAdding(days: 1).lucidDayKey
            b.notebook[key]!.lastPractisedAt = updated; b.notebook[key]!.nextReviewOn = now.lucidAdding(days: 7).lucidDayKey
            try sharedRequire(SharedLearningMerge.combine(a, b)?.notebook[key]?.nextReviewOn == b.notebook[key]!.nextReviewOn, "An old due date trapped a practised gap forever")
            a.notebook[key]!.lastPractisedAt = updated
            try sharedRequire(SharedLearningMerge.combine(a, b)?.notebook[key]?.nextReviewOn == a.notebook[key]!.nextReviewOn, "Equal-practice conflict lengthened the weaker review schedule")
        }
        try await run("a correct but unfinished web answer resumes as supported practice requiring explicit Continue") {
            let (source, _, _) = try store(record()); source.prepareToday(); let ids = source.data.currentWordIds
            let item = source.practiceChallenge(for: ids[0])!; let key = "\(now.lucidDayKey):\(role.id)"
            var incoming = record(); var shared = SharedLearningState()
            shared.lessonCheckpoints[key] = .init(roleId: role.id, dayKey: now.lucidDayKey, wordIds: ids, completedWordIds: [], cursorWordId: ids[0], answers: [ids[0]: .init(choiceId: item.correctId, hinted: false)], updatedAt: SharedLearningState.stamp(now))
            incoming.sharedLearning = shared
            let (native, _, _) = try store(incoming); let live = native.practiceChallenge(for: ids[0])!
            try sharedRequire(native.tapAttempt(for: live)?.revealed == true && native.totalXP == 0 && !native.isCurrentRoleWordComplete(ids[0]), "A pending answer was lost, stuck, or auto-awarded")
            try sharedRequire(native.continuePractice(live) && native.totalXP == 10 && native.isCurrentRoleWordComplete(ids[0]), "Explicit Continue could not finish a shared supported step")
        }
        try await run("native guided completion round-trips to another actual store without repeat award") {
            let (first, _, _) = try store(record()); first.prepareToday(); let word = first.data.currentWordIds[0]; let challenge = first.practiceChallenge(for: word)!
            try sharedRequire(first.answerPractice(challenge, choiceId: challenge.correctId), "Native guided answer failed")
            let (second, _, _) = try store(LearningMerge.cloudRecord(first.data)); second.prepareToday()
            try sharedRequire(second.isCurrentRoleWordComplete(word) && second.recognizedContextCount == 1 && second.totalXP == 10, "Guided progress/evidence failed across stores")
            try sharedRequire(!second.answerPractice(second.practiceChallenge(for: word)!, choiceId: challenge.correctId) && second.totalXP == 10, "Sync permitted duplicate guided credit")
        }
        try await run("completed rehearsal sync hydrates history without responses or invented production evidence") {
            let (first, _, _) = try store(record()); let id = first.startRehearsal(scenarioId: scenario.id)!
            first.saveRehearsalResponse("We explain the rationale for this approach to our team.", id: id); first.checkRehearsal(id); first.setRehearsalAssessment(id, meaning: true, naturalness: true)
            try sharedRequire(first.finishRehearsal(id, quality: .good), "Original native rehearsal failed")
            let cloud = LearningMerge.cloudRecord(first.data); let (second, _, _) = try store(cloud)
            try sharedRequire(second.rehearsal(id)?.completedAt != nil && second.rehearsal(id)?.response.isEmpty == true && second.rehearsal(id)?.receivedFromSync == true, "Completion history did not hydrate safely")
            try sharedRequire(second.producedContextCount == 1 && second.recalledContextCount == 0 && second.totalXP == 0, "Production sync became recall/XP")
            let merged = first.hydrateSharedLearning(LearningMerge.combine(local: first.data, remote: cloud), at: now)
            try sharedRequire(merged.rehearsalSessions?[id.uuidString]?.response == first.rehearsal(id)?.response, "Roundtrip removed original private response")
        }
        try await run("interrupted rehearsal checkpoint resumes same UUID and remote model exposure prevents fresh credit") {
            let (first, _, _) = try store(record()); let id = first.startRehearsal(scenarioId: scenario.id)!
            first.checkRehearsal(id, revealWithoutAttempt: true)
            let (second, _, _) = try store(LearningMerge.cloudRecord(first.data))
            try sharedRequire(second.startRehearsal(scenarioId: scenario.id) == id && second.rehearsal(id)?.modelSeen == true, "Resume reset UUID or model exposure")
            second.saveRehearsalResponse("We explain the rationale for this approach to our team.", id: id); second.checkRehearsal(id); second.setRehearsalAssessment(id, meaning: true, naturalness: true)
            try sharedRequire(!second.finishRehearsal(id, quality: .good), "Remote hint was erased by an interrupted cross-client session")
        }
        try await run("concurrent checkpoint completions union while different plan snapshots keep one stable plan") {
            let ids = Array(path.wordIds.prefix(3)), key = "\(now.lucidDayKey):\(role.id)"
            var a = SharedLearningState(), b = SharedLearningState()
            a.lessonCheckpoints[key] = .init(roleId: role.id, dayKey: now.lucidDayKey, wordIds: ids, completedWordIds: [ids[0]], updatedAt: SharedLearningState.stamp(now))
            b.lessonCheckpoints[key] = .init(roleId: role.id, dayKey: now.lucidDayKey, wordIds: ids, completedWordIds: [ids[1]], updatedAt: SharedLearningState.stamp(now.addingTimeInterval(1)))
            let merged = SharedLearningMerge.combine(a, b)!
            try sharedRequire(Set(merged.lessonCheckpoints[key]!.completedWordIds) == Set(ids.prefix(2)), "Offline completion lost a word")
            b.lessonCheckpoints[key]!.wordIds = Array(path.wordIds.dropFirst(3).prefix(3)); b.lessonCheckpoints[key]!.completedWordIds = []
            try sharedRequire(SharedLearningMerge.combine(a, b)?.lessonCheckpoints[key]?.wordIds == ids && SharedLearningMerge.combine(b, a)?.lessonCheckpoints[key]?.wordIds == ids, "Conflict order changed frozen daily snapshot")
        }
        try await run("concurrent challenge subsets complete once without adding mastery, and shared history hydrates native transfer") {
            let scenarios = Array(content.scenarios.filter { $0.roleIds.contains(role.id) }.prefix(2)).map(\.id)
            let key = "\(role.id):transfer:5", started = SharedLearningState.stamp(now)
            var a = SharedLearningState(), b = SharedLearningState()
            a.challenges[key] = .init(id: key, roleId: role.id, mode: "transfer", milestone: 5, startedAt: started, scenarioIds: scenarios, completedScenarioIds: [scenarios[0]])
            b.challenges[key] = .init(id: key, roleId: role.id, mode: "transfer", milestone: 5, startedAt: started, scenarioIds: scenarios, completedScenarioIds: [scenarios[1]])
            var incoming = record(); incoming.sharedLearning = SharedLearningMerge.combine(a, b)
            let (native, _, _) = try store(incoming)
            try sharedRequire(native.data.transferSessions?[key]?.completedAt != nil && Set(native.data.transferSessions![key]!.completedScenarioIds) == Set(scenarios), "Concurrent complete challenge became stuck pending")
            try sharedRequire(native.totalXP == 0 && native.contextEvidence.isEmpty, "Completion metadata fabricated credit")
        }
        try await run("earlier remote exposure caps recall and effort while preserving immutable activities") {
            var a = record(), b = record(); let word = expression.wordId; let sense = "\(word)::\(role.id)"
            let event = ContextEvidence(id: UUID().uuidString, wordId: word, roleId: role.id, senseId: sense, date: now.lucidDayKey, recordedAt: now.addingTimeInterval(20), kind: .unaidedRecall, quality: 3, independent: true, capturedAt: now.addingTimeInterval(10))
            a.contextEvidence = [event]; a.activities = [.init(id: UUID(), kind: .review, wordId: word, date: event.recordedAt, dayKey: event.date, quality: 3, productive: true)]
            b.sharedLearning = .init(); b.sharedLearning!.exposures[sense] = .init(dayKey: now.lucidDayKey, firstSeenAt: SharedLearningState.stamp(now))
            for merged in [LearningMerge.combine(local: a, remote: b), LearningMerge.combine(local: b, remote: a)] {
                try sharedRequire(merged.contextEvidence?.first?.independent == false && merged.contextEvidence?.first?.quality == 1 && merged.activities?.first?.productive == true, "Exposure failed to cap recall or mutated an immutable activity")
                let (native, _, _) = try store(merged)
                try sharedRequire(native.totalXP == 5, "An earlier cross-device model inflated review effort")
            }
            var misdated = event
            misdated = .init(id: event.id, wordId: event.wordId, roleId: event.roleId, senseId: event.senseId, date: now.lucidAdding(days: -40).lucidDayKey, recordedAt: event.recordedAt, kind: event.kind, quality: event.quality, independent: event.independent, capturedAt: event.capturedAt)
            try sharedRequire(!misdated.isValid, "A fabricated logical review date could inflate retention")
            var legacy = a; legacy.contextEvidence![0].capturedAt = nil
            try sharedRequire(ContextEvidence.conservative(event, legacy.contextEvidence![0]).capturedAt == nil, "An existing legacy UUID acquired retroactive capture proof")
            try sharedRequire(LearningMerge.combine(local: legacy, remote: b).contextEvidence?.first?.independent == false, "Missing capturedAt acquired new independent proof")
            b.sharedLearning!.exposures[sense] = .init(dayKey: now.lucidDayKey, firstSeenAt: SharedLearningState.stamp(now.addingTimeInterval(11)))
            try sharedRequire(LearningMerge.combine(local: a, remote: b).contextEvidence?.first?.independent == true, "Own later Reveal invalidated the original")
        }
        try await run("notebook and shared checkpoints remain separated by role with invalid authored phrases ignored") {
            var incoming = record(); incoming.sharedLearning = sharedNotebook()
            let (native, _, _) = try store(incoming); native.data.profile = profile(otherRole)
            try sharedRequire(native.expressionGaps.isEmpty && native.studioDraft("gap").isEmpty, "Role switch leaked a notebook or draft")
            let key = incoming.sharedLearning!.notebook.keys.first!; let entry = incoming.sharedLearning!.notebook[key]!
            incoming.sharedLearning!.notebook[key] = .init(id: entry.id, roleId: entry.roleId, expressionId: entry.expressionId, style: entry.style, phrase: "untrusted free text", createdAt: entry.createdAt, nextReviewOn: entry.nextReviewOn)
            let (invalid, _, _) = try store(incoming)
            try sharedRequire(invalid.expressionGaps.isEmpty, "Unknown phrasing entered the native authored notebook")
        }
        try await run("native persistence and manual backup preserve shared metadata while future shared versions fail closed") {
            var incoming = record(); incoming.sharedLearning = sharedNotebook(); let (native, persistence, _) = try store(incoming)
            let backup = try LucidBackupDocument(data: native.data)
            let envelope = try JSONDecoder().decode(LearningPersistence.Envelope.self, from: backup.content)
            let loaded = try persistence.load(scope: "guest").data
            try sharedRequire(envelope.version == 2 && envelope.learner.sharedLearning == native.data.sharedLearning && loaded.sharedLearning == native.data.sharedLearning, "Shared fields broke compatible backup roundtrip")
            var future = incoming; future.sharedLearning!.version = 2; try persistence.save(future, scope: "guest")
            do { _ = try persistence.load(scope: "guest"); throw SharedTestError(description: "Future shared version silently downgraded") } catch LearningPersistence.PersistenceError.newerVersion {}
            do { _ = try persistence.archiveForRecovery(scope: "guest"); throw SharedTestError(description: "Future shared version became eligible for recovery downgrade") } catch LearningPersistence.PersistenceError.newerVersion {}
        }
        let config = URLSessionConfiguration.ephemeral; config.protocolClasses = [SharedFixtureProtocol.self]
        let api = AccountService(baseURL: URL(string: "https://shared-fixture.invalid")!, publicKey: "synthetic-public", client: URLSession(configuration: config))
        try await run("authenticated offline notebook edits survive reconnect and stale CAS retry with one record") {
            let (native, _, _) = try store(record(), api: api, signedIn: true)
            SharedFixtureProtocol.configure { _ in .init(failure: URLError(.notConnectedToInternet)) }
            try sharedRequire(native.saveExpressionGap(situation: "Private synthetic account note", expressionId: expression.id, style: "precise"), "Offline edit failed")
            await native.syncNow(); native.syncTask?.cancel()
            try sharedRequire(native.data.sharedLearning?.notebook.count == 1 && native.lastSyncedAt == nil, "Offline failure dropped local selected phrase")
            var remote = record(); remote.sharedLearning = sharedNotebook(); var posts = 0; var reads = 0
            SharedFixtureProtocol.configure { request in
                if request.url?.path == "/auth/v1/user" { return .init(body: try json(account.user)) }
                if request.url?.path == "/rest/v1/lucid_state" { reads += 1; return .init(body: [try json(CloudLearningRecord(revision: reads, state: remote))]) }
                if request.url?.path == "/rest/v1/rpc/lucid_save_state" {
                    posts += 1
                    let body = try requestBody(request)
                    let saved = try JSONDecoder().decode(LearnerData.self, from: JSONSerialization.data(withJSONObject: body["new_state"]!))
                    try sharedRequire(saved.sharedLearning?.notebook.count == 2 && saved.expressionGaps == nil, "CAS payload lost one client's phrase or sent private notes")
                    if posts == 1 { return .init(status: 409) }
                    remote = saved; return .init()
                }
                throw SharedTestError(description: "Unexpected route")
            }
            await native.syncNow(); native.syncTask?.cancel()
            try sharedRequire(posts == 2 && reads == 3 && native.expressionGaps.count == 2 && native.lastSyncedAt != nil && native.accountNotice == nil, "Conflict retry failed: posts=\(posts), reads=\(reads), notebook=\(native.expressionGaps.count), status=\(native.syncStatus), notice=\(native.accountNotice ?? "nil")")
        }
        try await run("an idle authenticated pull observes the shared backend without writing a new revision") {
            let (native, _, _) = try store(record(), api: api, signedIn: true)
            native.prepareToday(); native.syncTask?.cancel()
            let remote = LearningMerge.cloudRecord(native.data); var posts = 0
            SharedFixtureProtocol.configure { request in
                if request.url?.path == "/auth/v1/user" { return .init(body: try json(account.user)) }
                if request.url?.path == "/rest/v1/lucid_state" { return .init(body: [try json(CloudLearningRecord(revision: 7, state: remote))]) }
                posts += 1; return .init()
            }
            await native.syncNow(); native.syncTask?.cancel()
            try sharedRequire(posts == 0 && native.lastSyncedAt != nil, "Idle polling rewrote unchanged progress or failed to observe it")
        }
        try await run("sign-out reloads separate guest and rejects stale account actions without leaking shared notebook") {
            var learner = record(); learner.sharedLearning = sharedNotebook()
            let (native, persistence, vault) = try store(learner, api: api, signedIn: true)
            var guest = record(); guest.displayName = "Separate synthetic guest"; try persistence.save(guest, scope: "guest")
            native.prepareToday(); let stale = native.practiceChallenge(for: native.data.currentWordIds[0])!
            SharedFixtureProtocol.configure { _ in .init() }
            await native.signOut()
            try sharedRequire(native.session == nil && vault.session == nil && native.scope == "guest" && native.expressionGaps.isEmpty && native.data.displayName == guest.displayName, "Sign-out leaked account notebook into guest")
            try sharedRequire(!native.answerPractice(stale, choiceId: stale.correctId), "Stale authenticated action mutated guest")
        }
        try await run("authenticated fetch rejects future shared version and future timestamps rather than stripping or overwriting") {
            var future = record(); future.sharedLearning = sharedNotebook(); future.sharedLearning!.version = 2
            SharedFixtureProtocol.configure { _ in .init(body: [try json(CloudLearningRecord(revision: 1, state: future))]) }
            do { _ = try await api.fetch(account); throw SharedTestError(description: "Future shared version accepted") } catch AccountError.response {}
            future.sharedLearning!.version = 1; let key = future.sharedLearning!.notebook.keys.first!; let entry = future.sharedLearning!.notebook[key]!
            future.sharedLearning!.notebook[key] = .init(id: entry.id, roleId: entry.roleId, expressionId: entry.expressionId, style: entry.style, phrase: entry.phrase, createdAt: SharedLearningState.stamp(Date().addingTimeInterval(3600)), nextReviewOn: entry.nextReviewOn)
            do { _ = try await api.fetch(account); throw SharedTestError(description: "Future timestamp accepted") } catch AccountError.response {}
        }
        print("\(count) shared-sync groups passed. Mock HTTP transport; production store/models; no real account or learner data.")
    }
}
