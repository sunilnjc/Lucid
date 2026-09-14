import Foundation

enum ReminderScheduler { static func cancel() {} }
struct RoleEdgeFailure: Error, CustomStringConvertible { let description: String }
func edgeRequire(_ condition: @autoclosure () throws -> Bool, _ message: String) throws {
    if try !condition() { throw RoleEdgeFailure(description: message) }
}

@MainActor final class RoleEdgeClock {
    var now: Date
    init(_ now: Date) { self.now = now }
}
final class RoleEdgeVault {
    var session: AccountSession?
    init(_ session: AccountSession?) { self.session = session }
    var storage: AccountSessionStorage {
        .init(load: { self.session }, save: { self.session = $0 }, clear: { self.session = nil })
    }
}
final class RoleEdgeProtocol: URLProtocol {
    struct Reply { var status = 200; var body: Any = [:] }
    static let lock = NSLock()
    static private var handler: (URLRequest) throws -> Reply = { _ in throw URLError(.notConnectedToInternet) }
    static func configure(_ action: @escaping (URLRequest) throws -> Reply) {
        lock.lock(); handler = action; lock.unlock()
    }
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        Self.lock.lock(); let respond = Self.handler; Self.lock.unlock()
        do {
            try edgeRequire(request.url?.host == "lucid-role-tests.invalid", "Request escaped the isolated mock host")
            let reply = try respond(request)
            let response = HTTPURLResponse(url: request.url!, statusCode: reply.status, httpVersion: "HTTP/1.1", headerFields: ["Content-Type": "application/json"])!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: try JSONSerialization.data(withJSONObject: reply.body, options: [.fragmentsAllowed]))
            client?.urlProtocolDidFinishLoading(self)
        } catch { client?.urlProtocol(self, didFailWithError: error) }
    }
    override func stopLoading() {}
}

@main @MainActor struct RoleSwitchEdgeTests {
    static var directories: [URL] = []
    static var stores: [LearningStore] = []
    static let userID = UUID(uuidString: "99999999-5555-4444-8888-111111111111")!
    static func makeStore(_ catalog: ProfessionalCatalog, _ now: Date, _ initial: LearnerData = LearnerData(), api: AccountService? = nil, authenticated: Bool = false) throws -> (LearningStore, RoleEdgeClock, LearningPersistence) {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("lucid-role-edge-fixture-\(UUID())", isDirectory: true)
        directories.append(directory)
        let persistence = LearningPersistence(directory: directory)
        try persistence.save(authenticated ? LearnerData() : initial, scope: "guest")
        let session = AccountSession(accessToken: "fake-access", refreshToken: "fake-refresh", expiresAt: now.addingTimeInterval(3600).timeIntervalSince1970, user: .init(id: userID, email: "learner@example.com"))
        if authenticated { try persistence.save(initial, scope: userID.uuidString) }
        let vault = RoleEdgeVault(authenticated ? session : nil)
        let clock = RoleEdgeClock(now)
        let store = LearningStore(catalog: catalog, persistence: persistence, now: { clock.now }, accountService: api, sessionStorage: vault.storage)
        stores.append(store)
        return (store, clock, persistence)
    }
    static func json<T: Encodable>(_ value: T) throws -> Any {
        try JSONSerialization.jsonObject(with: JSONEncoder().encode(value))
    }
    static func requestBody(_ request: URLRequest) throws -> [String: Any] {
        let data: Data
        if let bytes = request.httpBody { data = bytes }
        else if let stream = request.httpBodyStream {
            stream.open(); defer { stream.close() }
            var bytes = Data(), buffer = [UInt8](repeating: 0, count: 4096)
            while true {
                let count = stream.read(&buffer, maxLength: buffer.count)
                if count <= 0 { break }
                bytes.append(contentsOf: buffer.prefix(count))
            }
            data = bytes
        } else { throw RoleEdgeFailure(description: "Missing mock upload body") }
        return try JSONSerialization.jsonObject(with: data) as! [String: Any]
    }
    static func practise(_ id: String, _ store: LearningStore) throws {
        let word = store.word(id: id)!
        store.saveDraft("Our team will discuss \(word.term) at the next planning meeting.", wordId: id)
        try edgeRequire(store.markTodayWord(id, quality: .good), "Fixture practice failed for \(word.term)")
    }
    static func quiesce(_ store: LearningStore) async {
        store.accountBusy = true; store.syncTask?.cancel()
        for _ in 0..<100 where store.isSyncing { try? await Task.sleep(nanoseconds: 2_000_000) }
        await Task.yield()
    }
    static func main() async throws {
        let catalog = try JSONDecoder().decode(ProfessionalCatalog.self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
        let today = Calendar.current.date(from: DateComponents(year: 2026, month: 9, day: 14, hour: 12))!
        let finance = catalog.roles.first { $0.id == "finance-accounting" }!
        let technology = catalog.roles.first { $0.id == "technology-engineering" }!
        func profile(_ role: ProfessionalRole) -> LearnerProfile {
            .init(roleId: role.id, seniorityId: catalog.seniorityLevels[0].id, situationIds: [role.situations[0].id], goalIds: [role.defaultGoalIds.first ?? catalog.goals[0].id])
        }
        func validRole(_ id: String, _ store: LearningStore) throws {
            try edgeRequire(store.profile?.roleId == id && !store.todayWords.isEmpty && store.todayWords.allSatisfy { $0.learningMode == "active" && $0.roles.contains(id) }, "Active role and visible words disagree: \(store.todayWords.map(\.term))")
        }
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [RoleEdgeProtocol.self]
        let transport = URLSession(configuration: config)
        let api = AccountService(baseURL: URL(string: "https://lucid-role-tests.invalid")!, publicKey: "fake-public", client: transport)
        let user = try json(AccountUser(id: userID, email: "learner@example.com"))
        let sessionJSON = try json(AccountSession(accessToken: "fake-access", refreshToken: "fake-refresh", expiresAt: today.addingTimeInterval(3600).timeIntervalSince1970, user: .init(id: userID, email: "learner@example.com")))
        defer {
            stores.forEach { $0.accountBusy = true; $0.syncTask?.cancel() }
            transport.invalidateAndCancel()
            for directory in directories { try? FileManager.default.removeItem(at: directory) }
        }
        let tests: [(String, () async throws -> Void)] = [
            ("malformed cached plans cannot surface wrong-role, duplicate, unknown, recognition, or over-limit cards", {
                let activeFinance = catalog.words.filter { $0.learningMode == "active" && $0.roles.contains(finance.id) }
                let wrongRole = catalog.words.first { $0.learningMode == "active" && !$0.roles.contains(finance.id) }!
                let recognition = catalog.words.first { $0.learningMode != "active" }!
                let badPlans = [["missing-word"], [activeFinance[0].id, activeFinance[0].id], [wrongRole.id], [recognition.id], Array(activeFinance.prefix(4).map(\.id))]
                for bad in badPlans {
                    var initial = LearnerData(); initial.profile = profile(finance)
                    initial.lessonRoleId = finance.id; initial.lessonDayKey = today.lucidDayKey
                    initial.currentLessonDate = today.lucidStartOfDay; initial.currentWordIds = bad
                    initial.dailyRolePlans = [finance.id: .init(dayKey: today.lucidDayKey, wordIds: bad), "unknown-role": .init(dayKey: today.lucidDayKey, wordIds: []), technology.id: .init(dayKey: today.lucidAdding(days: -1).lucidDayKey, wordIds: [])]
                    let (store, _, _) = try makeStore(catalog, today, initial)
                    store.prepareToday()
                    try validRole(finance.id, store)
                    try edgeRequire(store.todayWords.count == 3 && Set(store.data.currentWordIds).count == 3, "Malformed cache was not replaced with a usable three-card plan")
                    try edgeRequire(store.data.dailyRolePlans?["unknown-role"] == nil && store.data.dailyRolePlans?[technology.id] == nil, "Invalid or yesterday's plan survived validation")
                }
            }),
            ("an empty malformed cache cannot hide available words", {
                var initial = LearnerData(); initial.profile = profile(finance)
                initial.lessonDayKey = today.lucidDayKey; initial.currentLessonDate = today.lucidStartOfDay
                initial.lessonRoleId = finance.id; initial.currentWordIds = []
                initial.dailyRolePlans = [finance.id: .init(dayKey: today.lucidDayKey, wordIds: [])]
                let (store, _, _) = try makeStore(catalog, today, initial)
                store.prepareToday()
                try validRole(finance.id, store)
                try edgeRequire(store.todayWords.count == 3, "Empty cached plan hid a new learner's available course")
            }),
            ("a shared word practised in one role is already credited in another cached role plan", {
                let shared = catalog.words.first { $0.learningMode == "active" && $0.roles.count > 1 }!
                let first = catalog.roles.first { $0.id == shared.roles[0] }!
                let second = catalog.roles.first { $0.id == shared.roles[1] }!
                var initial = LearnerData(); initial.profile = profile(first); initial.dailyWordGoal = 1
                initial.currentLessonDate = today.lucidStartOfDay; initial.lessonDayKey = today.lucidDayKey
                initial.lessonRoleId = first.id; initial.currentWordIds = [shared.id]
                initial.dailyRolePlans = [first.id: .init(dayKey: today.lucidDayKey, wordIds: [shared.id]), second.id: .init(dayKey: today.lucidDayKey, wordIds: [shared.id])]
                let (store, _, _) = try makeStore(catalog, today, initial)
                store.prepareToday(); try practise(shared.id, store)
                let progress = store.data.progressByWordId[shared.id]; let xp = store.totalXP
                store.finishOnboarding(profile: profile(second), goal: 1)
                try edgeRequire(store.data.currentWordIds == [shared.id] && store.data.completedWordIdsToday.contains(shared.id), "Shared vocabulary lost its existing same-day credit")
                try edgeRequire(store.lessonProgress == 1 && !store.markTodayWord(shared.id, quality: .good), "Shared word was offered duplicate practice credit")
                try edgeRequire(store.totalXP == xp && store.data.progressByWordId[shared.id] == progress, "Shared-word role switch rewrote rewards or review schedule")
            }),
            ("switching to an exhausted role shows reviews without leaking another role's cards", {
                let financeIDs = catalog.words.filter { $0.learningMode == "active" && $0.roles.contains(finance.id) }.map(\.id)
                var initial = LearnerData(); initial.profile = profile(technology); initial.introducedWordIds = financeIDs
                for id in financeIDs { initial.progressByWordId[id] = WordProgress(introducedOn: today.lucidAdding(days: -10), nextReviewOn: today.lucidStartOfDay) }
                let (store, _, _) = try makeStore(catalog, today, initial)
                store.prepareToday(); try validRole(technology.id, store)
                let technologyPlan = store.data.currentWordIds
                store.finishOnboarding(profile: profile(finance), goal: 3)
                try edgeRequire(store.todayWords.isEmpty && !store.isCurrentPlanComplete && !store.completeToday(), "Exhausted Finance leaked unrelated cards or awarded empty completion")
                try edgeRequire(Set(store.dueWords.map(\.id)).isSuperset(of: financeIDs), "Exhausted role hid its due reviews")
                store.finishOnboarding(profile: profile(technology), goal: 3)
                try edgeRequire(store.data.currentWordIds == technologyPlan, "Returning from an exhausted role rerolled the previous plan")
            }),
            ("a restored lesson event alone blocks a second daily bonus without hiding unfinished cards", {
                let (store, _, _) = try makeStore(catalog, today)
                store.finishOnboarding(profile: profile(finance), goal: 1)
                store.data.activities = [LearningActivity(id: UUID(), kind: .lesson, wordId: nil, date: today, dayKey: today.lucidDayKey, quality: 2, productive: true)]
                try edgeRequire(store.isTodayComplete && !store.isCurrentPlanComplete, "Daily bonus incorrectly claimed this unfinished plan was complete")
                try practise(store.data.currentWordIds[0], store)
                try edgeRequire(store.isCurrentPlanComplete && !store.completeToday(), "An event-only restored bonus could be earned a second time")
                try edgeRequire(store.data.sessions.isEmpty && store.activities.filter { $0.kind == .lesson }.count == 1, "Completing a role manufactured an extra lesson reward")
            }),
            ("ordinary sync normalizes the selected role before upload and persists the same displayed plan", {
                let (financeStore, _, _) = try makeStore(catalog, today)
                financeStore.finishOnboarding(profile: profile(finance), goal: 3)
                let (technologyStore, _, _) = try makeStore(catalog, today.addingTimeInterval(30))
                technologyStore.finishOnboarding(profile: profile(technology), goal: 2)
                let technologyIDs = technologyStore.data.currentWordIds
                let record = try json(CloudLearningRecord(revision: 4, state: LearningMerge.cloudRecord(technologyStore.data)))
                let (store, _, persistence) = try makeStore(catalog, today.addingTimeInterval(60), financeStore.data, api: api, authenticated: true)
                var uploadedIDs: [String] = []
                RoleEdgeProtocol.configure { request in
                    switch request.url?.path {
                    case "/auth/v1/user": return .init(body: user)
                    case "/rest/v1/lucid_state": return .init(body: [record])
                    case "/rest/v1/rpc/lucid_save_state":
                        let object = try requestBody(request)
                        let state = object["p_state"] as? [String: Any] ?? object["new_state"] as? [String: Any] ?? [:]
                        uploadedIDs = state["currentWordIds"] as? [String] ?? []
                        return .init(body: 5)
                    default: throw URLError(.notConnectedToInternet)
                    }
                }
                await store.syncNow(); await quiesce(store)
                try validRole(technology.id, store)
                try edgeRequire(store.data.currentWordIds == technologyIDs, "Ordinary sync replaced the selected role's existing daily plan")
                try edgeRequire(uploadedIDs == technologyIDs, "Sync uploaded a profile/card mismatch before normalizing the UI")
                try edgeRequire(try persistence.load(scope: userID.uuidString).data == store.data, "Sync did not persist its normalized role plan")
            }),
            ("a role switch while upload waits keeps the new role, draft, credit, and both daily plans", {
                let (seed, _, _) = try makeStore(catalog, today)
                seed.finishOnboarding(profile: profile(finance), goal: 3)
                let financeIDs = seed.data.currentWordIds
                let (store, clock, _) = try makeStore(catalog, today, seed.data, api: api, authenticated: true)
                var technologyIDs: [String] = []
                var callbackError: Error?
                RoleEdgeProtocol.configure { request in
                    switch request.url?.path {
                    case "/auth/v1/user": return .init(body: user)
                    case "/rest/v1/lucid_state": return .init(body: [])
                    case "/rest/v1/rpc/lucid_save_state":
                        let edited = DispatchSemaphore(value: 0)
                        Task { @MainActor in
                            do {
                                clock.now = today.addingTimeInterval(60)
                                store.finishOnboarding(profile: profile(technology), goal: 2)
                                technologyIDs = store.data.currentWordIds
                                try practise(technologyIDs[0], store)
                            } catch { callbackError = error }
                            edited.signal()
                        }
                        try edgeRequire(edited.wait(timeout: .now() + 5) == .success, "Concurrent role change never executed")
                        return .init(body: 1)
                    default: throw URLError(.notConnectedToInternet)
                    }
                }
                await store.syncNow(); await quiesce(store)
                if let callbackError { throw callbackError }
                try validRole(technology.id, store)
                try edgeRequire(store.data.currentWordIds == technologyIDs && store.data.completedWordIdsToday.contains(technologyIDs[0]), "Late upload response replaced the new role plan or progress")
                try edgeRequire(store.totalXP == 10 && !store.draft(for: technologyIDs[0]).isEmpty, "Late upload response erased the live draft or credit")
                store.finishOnboarding(profile: profile(finance), goal: 3)
                try edgeRequire(store.data.currentWordIds == financeIDs, "Raced sync forgot the original role's daily plan")
            }),
            ("a newer remote role selection intentionally replaces a conflicting cached plan while keeping earned credit", {
                let (local, _, _) = try makeStore(catalog, today)
                local.finishOnboarding(profile: profile(finance), goal: 2)
                let oldFinanceIDs = local.data.currentWordIds
                try practise(oldFinanceIDs[0], local)
                local.finishOnboarding(profile: profile(technology), goal: 2)
                try practise(local.data.currentWordIds[0], local)
                let localCredit = Set(local.data.completedWordIdsToday)
                let (remote, _, _) = try makeStore(catalog, today.addingTimeInterval(120))
                remote.finishOnboarding(profile: profile(finance), goal: 2)
                let replacementIDs = Array(catalog.words.filter { $0.learningMode == "active" && $0.roles.contains(finance.id) && !oldFinanceIDs.contains($0.id) }.suffix(2).map(\.id))
                remote.data.currentWordIds = replacementIDs
                remote.prepareToday()
                try practise(replacementIDs[0], remote)
                let merged = LearningMerge.combine(local: local.data, remote: LearningMerge.cloudRecord(remote.data))
                let (restored, _, _) = try makeStore(catalog, today.addingTimeInterval(180), merged)
                restored.prepareToday()
                try validRole(finance.id, restored)
                try edgeRequire(restored.data.currentWordIds == replacementIDs, "A stale local cache overruled the newer remote role's active plan")
                try edgeRequire(restored.data.dailyRolePlans?[finance.id]?.wordIds == replacementIDs, "The active remote plan was not stored as the consistent Finance plan")
                try edgeRequire(Set(restored.data.completedWordIdsToday).isSuperset(of: localCredit.union([replacementIDs[0]])), "Replacing an archived role plan discarded earlier same-day practice credit")
                try edgeRequire(!restored.markTodayWord(replacementIDs[0], quality: .good), "Remote active-plan replacement allowed duplicate practice credit")
                restored.finishOnboarding(profile: profile(technology), goal: 2)
                restored.finishOnboarding(profile: profile(finance), goal: 2)
                try edgeRequire(restored.data.currentWordIds == replacementIDs, "Ordinary local switching resurrected the superseded Finance cache")
            }),
            ("consented guest-to-account import retains visited-role plans and completed practice", {
                let (seed, _, _) = try makeStore(catalog, today)
                seed.finishOnboarding(profile: profile(finance), goal: 2)
                let financeIDs = seed.data.currentWordIds
                try practise(financeIDs[0], seed)
                seed.finishOnboarding(profile: profile(technology), goal: 3)
                let technologyIDs = seed.data.currentWordIds
                let (store, _, persistence) = try makeStore(catalog, today.addingTimeInterval(60), seed.data, api: api)
                RoleEdgeProtocol.configure { request in
                    switch request.url?.path {
                    case "/auth/v1/verify": return .init(body: sessionJSON)
                    case "/auth/v1/user": return .init(body: user)
                    case "/rest/v1/lucid_state": return .init(body: [])
                    case "/rest/v1/rpc/lucid_save_state": return .init(body: 1)
                    default: throw URLError(.notConnectedToInternet)
                    }
                }
                let verified = await store.verifyLogin(email: "learner@example.com", code: "123456", includeGuest: true)
                await quiesce(store)
                try edgeRequire(verified && store.scope == userID.uuidString.lowercased(), "Guest-to-account import failed")
                try edgeRequire(store.data.currentWordIds == technologyIDs, "Import replaced the current guest role plan")
                store.finishOnboarding(profile: profile(finance), goal: 3)
                try edgeRequire(store.data.currentWordIds == financeIDs && store.data.completedWordIdsToday.contains(financeIDs[0]), "Consented import rerolled an earlier guest role's two-word plan")
                try edgeRequire(store.totalXP == 10 && !store.markTodayWord(financeIDs[0], quality: .good), "Guest import lost credit or allowed a duplicate reward")
                try edgeRequire(try persistence.load(scope: "guest").data == seed.data, "Import mutated the separate guest record")
            })
        ]
        var failures = 0
        for (name, body) in tests {
            do { try await body(); print("PASS: \(name)") }
            catch { failures += 1; print("FAIL: \(name): \(error)") }
        }
        print("\(tests.count - failures)/\(tests.count) role-switch edge groups passed; mock network and temporary storage only")
        if failures > 0 { exit(1) }
    }
}
