import Foundation

enum ReminderScheduler { static func cancel() {} }
struct TestFailure: Error, CustomStringConvertible { let description: String }
func expect(_ condition: @autoclosure () throws -> Bool, _ message: String) throws {
    if try !condition() { throw TestFailure(description: message) }
}

final class SessionVault {
    var session: AccountSession?
    var refuseClear = false
    init(_ session: AccountSession?) { self.session = session }
    var storage: AccountSessionStorage {
        .init(load: { self.session }, save: { self.session = $0 }, clear: {
            if self.refuseClear { throw AccountError.keychain }
            self.session = nil
        })
    }
}

final class OfflineAuthProtocol: URLProtocol {
    struct Reply { var status = 200; var body: Any = [:]; var error: Error? }
    static let lock = NSLock()
    private static var response: (URLRequest) throws -> Reply = { _ in .init(error: URLError(.notConnectedToInternet)) }
    static func configure(_ handler: @escaping (URLRequest) throws -> Reply) { lock.lock(); response = handler; lock.unlock() }
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        Self.lock.lock(); let handler = Self.response; Self.lock.unlock()
        do {
            try expect(request.url?.host == "lucid-recovery.invalid", "Test attempted an unexpected destination")
            let reply = try handler(request)
            if let error = reply.error { throw error }
            let response = HTTPURLResponse(url: request.url!, statusCode: reply.status, httpVersion: "HTTP/1.1", headerFields: ["Content-Type": "application/json"])!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: try JSONSerialization.data(withJSONObject: reply.body, options: [.fragmentsAllowed]))
            client?.urlProtocolDidFinishLoading(self)
        } catch { client?.urlProtocol(self, didFailWithError: error) }
    }
    override func stopLoading() {}
}

@main
@MainActor
struct AuthRecoveryTests {
    static let accountID = UUID(uuidString: "11111111-1111-1111-1111-111111111111")!
    static let otherID = UUID(uuidString: "22222222-2222-2222-2222-222222222222")!
    static var directories: [URL] = []
    static var stores: [LearningStore] = []
    static var currentSession: AccountSession {
        AccountSession(accessToken: "test-access", refreshToken: "test-refresh", expiresAt: Date().timeIntervalSince1970 + 3600,
                       user: AccountUser(id: accountID, email: "learner@example.com"))
    }
    static func json<T: Encodable>(_ value: T) throws -> Any { try JSONSerialization.jsonObject(with: JSONEncoder().encode(value)) }
    static func makePersistence() throws -> LearningPersistence {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("lucid-recovery-test-\(UUID().uuidString)")
        directories.append(dir)
        let persistence = LearningPersistence(directory: dir)
        // Always provide a guest file so tests never consult UserDefaults.standard legacy data.
        var guest = LearnerData(); guest.displayName = "Separate guest"
        try persistence.save(guest, scope: "guest")
        var other = LearnerData(); other.displayName = "Another account"
        try persistence.save(other, scope: otherID.uuidString)
        return persistence
    }
    static func makeStore(_ catalogue: ProfessionalCatalog, _ persistence: LearningPersistence, _ vault: SessionVault, _ api: AccountService) -> LearningStore {
        let store = LearningStore(catalog: catalogue, persistence: persistence, accountService: api, sessionStorage: vault.storage)
        stores.append(store)
        return store
    }
    static func quiesce(_ store: LearningStore) async {
        store.accountBusy = true
        store.syncTask?.cancel()
        for _ in 0..<100 {
            if !store.isSyncing { break }
            try? await Task.sleep(nanoseconds: 2_000_000)
        }
        await Task.yield()
    }

    static func main() async throws {
        let catalogue = try JSONDecoder().decode(ProfessionalCatalog.self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
        let role = catalogue.roles[0]
        let profile = LearnerProfile(roleId: role.id, seniorityId: catalogue.seniorityLevels[0].id,
                                     situationIds: [role.situations[0].id], goalIds: [catalogue.goals[0].id])
        var existing = LearnerData(); existing.profile = profile; existing.displayName = "Returning learner"
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [OfflineAuthProtocol.self]
        let transport = URLSession(configuration: configuration)
        let api = AccountService(baseURL: URL(string: "https://lucid-recovery.invalid")!, publicKey: "test-public-key", client: transport)
        let session = currentSession
        let sessionJSON = try json(session), userJSON = try json(session.user)
        defer {
            stores.forEach { $0.accountBusy = true; $0.syncTask?.cancel() }
            transport.invalidateAndCancel()
            for dir in directories { try? FileManager.default.removeItem(at: dir) }
        }

        do {
            let persistence = try makePersistence()
            try persistence.save(existing, scope: accountID.uuidString)
            try persistence.markAccountDeletion(userID: accountID, confirmed: false)
            let vault = SessionVault(session); vault.refuseClear = true
            let store = makeStore(catalogue, persistence, vault, api)
            try expect(store.session == nil && store.scope == "guest", "Pending deletion resurrected an old Keychain session")
            try expect(try persistence.load(scope: accountID.uuidString).data.profile == profile, "Unconfirmed deletion erased local evidence")
            try expect(try persistence.load(scope: otherID.uuidString).data.displayName == "Another account", "Receipt touched another UUID")
            print("PASS pending deletion blocks old session while preserving exact account data")
        }
        do {
            let persistence = try makePersistence()
            try persistence.save(existing, scope: accountID.uuidString)
            try persistence.markAccountDeletion(userID: accountID, confirmed: true)
            let vault = SessionVault(session); vault.refuseClear = true
            let store = makeStore(catalogue, persistence, vault, api)
            try expect(store.session == nil, "Confirmed deletion resurrected old Keychain session")
            try expect(!FileManager.default.fileExists(atPath: persistence.file(for: accountID.uuidString).path), "Confirmed deletion did not retry exact-account cleanup")
            try expect(try persistence.load(scope: "guest").data.displayName == "Separate guest", "Deletion touched guest record")
            print("PASS confirmed deletion retries scoped cleanup even when Keychain deletion fails")
        }
        do {
            let persistence = try makePersistence()
            try persistence.save(existing, scope: accountID.uuidString)
            let vault = SessionVault(session); vault.refuseClear = true
            let store = makeStore(catalogue, persistence, vault, api)
            OfflineAuthProtocol.configure { request in
                try expect(request.url?.path == "/functions/v1/delete-account", "Unexpected deletion request")
                try expect(try persistence.accountDeletionReceipt(for: accountID)?.confirmed == false, "Receipt was not durable before destructive request")
                return .init()
            }
            let deleted = await store.deleteAccount()
            try expect(deleted, "Mocked deletion did not complete")
            try expect(store.session == nil, "Remote deletion left a live session")
            try expect(try persistence.accountDeletionReceipt(for: accountID)?.confirmed == true, "Deletion confirmation not retained")
            let restarted = makeStore(catalogue, persistence, vault, api)
            try expect(restarted.session == nil, "Failed Keychain cleanup restored deleted account on restart")
            print("PASS confirmed remote deletion cannot create a ghost account after restart")
        }
        do {
            let persistence = try makePersistence()
            try persistence.save(existing, scope: accountID.uuidString)
            let vault = SessionVault(session)
            let store = makeStore(catalogue, persistence, vault, api)
            OfflineAuthProtocol.configure { _ in .init(error: URLError(.timedOut)) }
            let deleted = await store.deleteAccount()
            try expect(!deleted, "Timed-out deletion falsely reported success")
            try expect(store.session == nil, "Uncertain deletion left automatic account access")
            try expect(try persistence.accountDeletionReceipt(for: accountID)?.confirmed == false, "Uncertain deletion was not recorded")
            try expect(try persistence.load(scope: accountID.uuidString).data.profile == profile, "Uncertain deletion erased its recoverable local record")
            print("PASS lost deletion response retains files and requires a new verified session")
        }
        do {
            let persistence = try makePersistence()
            try persistence.save(existing, scope: accountID.uuidString)
            try persistence.markAccountDeletion(userID: accountID, confirmed: false)
            let vault = SessionVault(nil)
            let store = makeStore(catalogue, persistence, vault, api)
            OfflineAuthProtocol.configure { request in
                if request.url?.path == "/auth/v1/verify" { return .init(body: sessionJSON) }
                if request.url?.path == "/rest/v1/lucid_state" { return .init(body: []) }
                return .init(error: URLError(.notConnectedToInternet))
            }
            let verified = await store.verifyLogin(email: "learner@example.com", code: "123456", includeGuest: false)
            try expect(verified, "Fresh verification could not recover a failed deletion request")
            await quiesce(store)
            try expect(try persistence.accountDeletionReceipt(for: accountID) == nil, "Fresh verification did not remove unconfirmed receipt")
            try expect(store.profile == profile, "Recovery lost its existing local profile")
            print("PASS a new OTP safely recovers an unconfirmed deletion")
        }
        do {
            let persistence = try makePersistence()
            let store = makeStore(catalogue, persistence, SessionVault(session), api)
            try expect(store.cloudRestorePending && store.profile == nil, "Empty returning account was not gated")
            OfflineAuthProtocol.configure { _ in .init(error: URLError(.notConnectedToInternet)) }
            await store.syncNow()
            store.finishOnboarding(profile: profile, name: "Do not overwrite cloud")
            try expect(store.cloudRestorePending && store.profile == nil, "Offline account replaced its unknown cloud profile")
            await quiesce(store)
            print("PASS offline returning-account onboarding cannot overwrite an unknown plan")
        }
        do {
            let persistence = try makePersistence()
            try persistence.save(existing, scope: accountID.uuidString)
            let store = makeStore(catalogue, persistence, SessionVault(session), api)
            OfflineAuthProtocol.configure { _ in .init(error: URLError(.notConnectedToInternet)) }
            await store.syncNow()
            store.prepareToday()
            try expect(!store.cloudRestorePending && store.profile == profile && !store.todayWords.isEmpty, "Cached account could not learn offline")
            await quiesce(store)
            print("PASS cached account profile and daily lesson remain usable offline")
        }
        do {
            let persistence = try makePersistence()
            let vault = SessionVault(nil)
            let store = makeStore(catalogue, persistence, vault, api)
            OfflineAuthProtocol.configure { request in
                request.url?.path == "/auth/v1/verify" ? .init(body: sessionJSON) : .init(error: URLError(.notConnectedToInternet))
            }
            let verified = await store.verifyLogin(email: "learner@example.com", code: "123456", includeGuest: false)
            try expect(verified, "Consumed valid OTP was lost when restore failed")
            await quiesce(store)
            try expect(vault.session != nil && store.cloudRestorePending && store.profile == nil, "Failed restore did not persist a gated login")
            let restarted = makeStore(catalogue, persistence, vault, api)
            try expect(restarted.cloudRestorePending, "Relaunch bypassed restore gate")
            print("PASS post-OTP restore failure keeps login and restores the gate on relaunch")
        }
        do {
            let persistence = try makePersistence()
            let store = makeStore(catalogue, persistence, SessionVault(session), api)
            let remote = try json(CloudLearningRecord(revision: 5, state: existing))
            OfflineAuthProtocol.configure { request in
                switch request.url?.path {
                case "/auth/v1/user": return .init(body: userJSON)
                case "/rest/v1/lucid_state": return .init(body: [remote])
                default: return .init(status: 500)
                }
            }
            await store.syncNow()
            await quiesce(store)
            try expect(!store.cloudRestorePending && store.profile == profile, "Successful download stayed gated because upload failed")
            try expect(try persistence.load(scope: accountID.uuidString).data.profile == profile, "Restored cloud plan was not locally durable")
            print("PASS download applies the cloud plan before a failing upload and unlocks learning")
        }
        do {
            let persistence = try makePersistence()
            let store = makeStore(catalogue, persistence, SessionVault(session), api)
            OfflineAuthProtocol.configure { request in
                switch request.url?.path {
                case "/auth/v1/user": return .init(body: userJSON)
                case "/rest/v1/lucid_state": return .init(body: [])
                default: return .init(body: 1)
                }
            }
            await store.syncNow()
            try expect(!store.cloudRestorePending, "Confirmed new account remained gated")
            store.finishOnboarding(profile: profile, name: "New learner")
            try expect(store.profile == profile, "Confirmed new account could not onboard")
            await quiesce(store)
            print("PASS confirmed empty cloud record permits new-user onboarding")
        }
        do {
            let persistence = try makePersistence()
            let store = makeStore(catalogue, persistence, SessionVault(session), api)
            OfflineAuthProtocol.configure { _ in .init(status: 204) }
            await store.signOut()
            try expect(store.session == nil && !store.cloudRestorePending && store.scope == "guest", "Guest mode inherited an account restore gate")
            print("PASS sign-out clears only the account's restore gate")
        }
        print("11 lifecycle groups passed; isolated files and injected memory session storage, no user Keychain/defaults or real network used")
    }
}
