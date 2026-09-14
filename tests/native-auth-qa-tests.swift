import Foundation

// Isolated QA regressions: URLProtocol captures every request, session storage is
// memory-only, and all persisted records live in newly created temporary folders.
enum ReminderScheduler { static func cancel() {} }
struct QAError: Error, CustomStringConvertible { let description: String }
func check(_ condition: @autoclosure () throws -> Bool, _ message: String) throws {
    if try !condition() { throw QAError(description: message) }
}
final class QAVault {
    var session: AccountSession?
    var refuseSave = false
    var saveCalls = 0
    init(_ session: AccountSession?) { self.session = session }
    var storage: AccountSessionStorage {
        .init(load: { self.session }, save: {
            self.saveCalls += 1
            if self.refuseSave { throw AccountError.keychain }
            self.session = $0
        }, clear: { self.session = nil })
    }
}
final class QAProtocol: URLProtocol {
    struct Reply { var status = 200; var body: Any = [:]; var failure: Error? }
    static let lock = NSLock()
    private static var handler: (URLRequest) throws -> Reply = { _ in .init(failure: URLError(.notConnectedToInternet)) }
    static func configure(_ value: @escaping (URLRequest) throws -> Reply) {
        lock.lock(); handler = value; lock.unlock()
    }
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        Self.lock.lock(); let respond = Self.handler; Self.lock.unlock()
        do {
            try check(request.url?.host == "lucid-qa.invalid", "Request escaped mocked host")
            let reply = try respond(request)
            if let error = reply.failure { throw error }
            let response = HTTPURLResponse(url: request.url!, statusCode: reply.status, httpVersion: "HTTP/1.1",
                                           headerFields: ["Content-Type": "application/json"])!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: try JSONSerialization.data(withJSONObject: reply.body, options: [.fragmentsAllowed]))
            client?.urlProtocolDidFinishLoading(self)
        } catch { client?.urlProtocol(self, didFailWithError: error) }
    }
    override func stopLoading() {}
}

@main
@MainActor
struct AuthQATests {
    static var passed = 0
    static var failures: [String] = []
    static var directories: [URL] = []
    static var stores: [LearningStore] = []
    static let userID = UUID(uuidString: "77777777-7777-7777-7777-777777777777")!
    static var session: AccountSession {
        .init(accessToken: "test-access", refreshToken: "test-refresh",
              expiresAt: Date().timeIntervalSince1970 + 3600,
              user: .init(id: userID, email: "learner@example.com"))
    }
    static func json<T: Encodable>(_ value: T) throws -> Any {
        try JSONSerialization.jsonObject(with: JSONEncoder().encode(value))
    }
    static func run(_ name: String, _ body: () async throws -> Void) async {
        do { try await body(); passed += 1; print("PASS \(name)") }
        catch { failures.append("\(name): \(error)"); print("FAIL \(name): \(error)") }
    }
    static func rejectResponse(_ operation: () async throws -> Void) async throws {
        do { try await operation(); throw QAError(description: "Unsafe cloud response was accepted") }
        catch AccountError.response {}
    }
    static func fixture(_ catalogue: ProfessionalCatalog, _ api: AccountService, authenticated: Bool = true) throws -> (LearningStore, LearningPersistence, QAVault) {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("lucid-auth-qa-\(UUID().uuidString)")
        directories.append(directory)
        let persistence = LearningPersistence(directory: directory)
        var guest = LearnerData(); guest.displayName = "Separate guest"
        // Existing files avoid consulting a real learner's legacy UserDefaults.
        try persistence.save(guest, scope: "guest")
        let role = catalogue.roles[0]
        var account = LearnerData()
        account.profile = .init(roleId: role.id, seniorityId: catalogue.seniorityLevels[0].id,
                                situationIds: [role.situations[0].id], goalIds: [catalogue.goals[0].id])
        account.displayName = "Protected account"
        account.practiceDrafts = ["word": "Private local draft"]
        try persistence.save(account, scope: userID.uuidString)
        let vault = QAVault(authenticated ? session : nil)
        let store = LearningStore(catalog: catalogue, persistence: persistence, accountService: api, sessionStorage: vault.storage)
        stores.append(store)
        return (store, persistence, vault)
    }
    static func quiesce(_ store: LearningStore) async {
        store.accountBusy = true; store.syncTask?.cancel()
        for _ in 0..<100 where store.isSyncing { try? await Task.sleep(nanoseconds: 2_000_000) }
        await Task.yield()
    }
    static func main() async throws {
        let catalogue = try JSONDecoder().decode(ProfessionalCatalog.self,
            from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [QAProtocol.self]
        let transport = URLSession(configuration: configuration)
        let api = AccountService(baseURL: URL(string: "https://lucid-qa.invalid")!, publicKey: "test-public", client: transport)
        let user = try json(session.user)
        defer {
            stores.forEach { $0.accountBusy = true; $0.syncTask?.cancel() }
            transport.invalidateAndCancel()
            for directory in directories { try? FileManager.default.removeItem(at: directory) }
        }
        await run("current cloud schema stays readable") {
            let record = try json(CloudLearningRecord(revision: 4, state: LearnerData()))
            QAProtocol.configure { _ in .init(body: [record]) }
            let cloud = try await api.fetch(session)
            try check(cloud?.revision == 4 && cloud?.state.schemaVersion == 2, "Supported record rejected")
        }
        await run("newer cloud schema is rejected before downgrade") {
            var state = LearnerData(); state.schemaVersion = 3
            let record = try json(CloudLearningRecord(revision: 4, state: state))
            QAProtocol.configure { _ in .init(body: [record]) }
            try await rejectResponse { _ = try await api.fetch(session) }
        }
        await run("negative cloud revision is rejected") {
            let record = try json(CloudLearningRecord(revision: -1, state: LearnerData()))
            QAProtocol.configure { _ in .init(body: [record]) }
            try await rejectResponse { _ = try await api.fetch(session) }
        }
        await run("unexpected duplicate cloud records are rejected") {
            let record = try json(CloudLearningRecord(revision: 1, state: LearnerData()))
            QAProtocol.configure { _ in .init(body: [record, record]) }
            try await rejectResponse { _ = try await api.fetch(session) }
        }
        await run("future cloud state never reaches upload or replaces local data") {
            let (store, persistence, _) = try fixture(catalogue, api)
            var future = store.data; future.schemaVersion = 3
            let record = try json(CloudLearningRecord(revision: 8, state: future))
            var uploads = 0
            QAProtocol.configure { request in
                switch request.url?.path {
                case "/auth/v1/user": return .init(body: user)
                case "/rest/v1/lucid_state": return .init(body: [record])
                default: uploads += 1; return .init(body: 9)
                }
            }
            await store.syncNow()
            try check(uploads == 0, "Old app uploaded over a future schema")
            try check(store.data.schemaVersion == 2, "Future state replaced current local data")
            try check(try persistence.load(scope: userID.uuidString).data.practiceDrafts?["word"] == "Private local draft", "Local draft was lost")
            await quiesce(store)
        }
        await run("rejected session pauses sync until email verification") {
            let (store, _, _) = try fixture(catalogue, api)
            var requests = 0
            QAProtocol.configure { _ in requests += 1; return .init(status: 401) }
            await store.syncNow()
            await store.syncNow()
            try check(requests == 1, "Expired session kept making doomed requests instead of offering reconnect")
            try check(store.session != nil && store.profile != nil, "Expired session discarded offline account data")
            await quiesce(store)
        }
        await run("successful reauthentication resumes cloud sync") {
            let (store, _, _) = try fixture(catalogue, api)
            QAProtocol.configure { _ in .init(status: 401) }
            await store.syncNow()
            let verifiedSession = try json(session)
            var userReads = 0
            QAProtocol.configure { request in
                switch request.url?.path {
                case "/auth/v1/verify": return .init(body: verifiedSession)
                case "/auth/v1/user": userReads += 1; return .init(body: user)
                case "/rest/v1/lucid_state": return .init(body: [])
                default: return .init(body: 1)
                }
            }
            let verified = await store.verifyLogin(email: "learner@example.com", code: "123456", includeGuest: false)
            try check(verified, "Fresh OTP could not reconnect")
            await store.syncNow()
            try check(userReads > 0, "Fresh OTP did not resume sync")
            await quiesce(store)
        }
        await run("explicit deletion refusal preserves account and clears uncertainty receipt") {
            let (store, persistence, vault) = try fixture(catalogue, api)
            QAProtocol.configure { request in
                try check(request.url?.path == "/functions/v1/delete-account", "Unexpected delete request")
                return .init(status: 403, body: ["message": "Verify your email again before deleting your account"])
            }
            let deleted = await store.deleteAccount()
            try check(!deleted, "Rejected deletion reported success")
            try check(store.session?.user.id == userID && vault.session != nil, "Explicit refusal signed the learner out")
            try check(try persistence.accountDeletionReceipt(for: userID) == nil, "Explicit refusal left a misleading pending deletion")
            try check(store.accountNotice?.contains("Request a new email code") == true, "Missing actionable verification guidance")
            await quiesce(store)
        }
        await run("lost deletion response still blocks automatic account recovery") {
            let (store, persistence, _) = try fixture(catalogue, api)
            QAProtocol.configure { _ in .init(failure: URLError(.timedOut)) }
            let deleted = await store.deleteAccount()
            try check(!deleted && store.session == nil, "Ambiguous deletion was treated as a safe refusal")
            try check(try persistence.accountDeletionReceipt(for: userID)?.confirmed == false, "Lost-response receipt was not kept")
            try check(try persistence.load(scope: userID.uuidString).data.displayName == "Protected account", "Ambiguous deletion erased local record")
            await quiesce(store)
        }
        await run("confirmed deletion still cleans only its account") {
            let (store, persistence, vault) = try fixture(catalogue, api)
            QAProtocol.configure { _ in .init(status: 200) }
            let deleted = await store.deleteAccount()
            try check(deleted && store.session == nil && vault.session == nil, "Confirmed deletion remained signed in")
            try check(try persistence.accountDeletionReceipt(for: userID)?.confirmed == true, "Deletion receipt was not confirmed")
            try check(try persistence.load(scope: "guest").data.displayName == "Separate guest", "Account deletion touched separate guest")
            await quiesce(store)
        }
        await run("same-account verification preserves edits made while cloud fetch waits") {
            let (store, persistence, _) = try fixture(catalogue, api)
            store.prepareToday()
            let wordID = catalogue.words[0].id
            let attemptKey = "\(Date().lucidDayKey):\(wordID)"
            let activity = LearningActivity(id: UUID(), kind: .practice, wordId: wordID,
                                            date: Date(), dayKey: Date().lucidDayKey, quality: 2, productive: false)
            let verifiedSession = try json(session)
            QAProtocol.configure { request in
                switch request.url?.path {
                case "/auth/v1/verify": return .init(body: verifiedSession)
                case "/rest/v1/lucid_state":
                    let edited = DispatchSemaphore(value: 0)
                    Task { @MainActor in
                        store.data.practiceDrafts = [wordID: "Typed while cloud fetch was pending"]
                        store.data.activities = (store.data.activities ?? []) + [activity]
                        store.data.reviewAttempts = [attemptKey: .init(originalAttempt: "Hint was revealed", independent: false)]
                        edited.signal()
                    }
                    try check(edited.wait(timeout: .now() + 5) == .success, "Concurrent edit did not run")
                    return .init(body: [])
                default: return .init(failure: URLError(.notConnectedToInternet))
                }
            }
            let verified = await store.verifyLogin(email: "learner@example.com", code: "123456", includeGuest: false)
            await quiesce(store)
            try check(verified, "Same-account verification failed")
            try check(store.data.practiceDrafts?[wordID] == "Typed while cloud fetch was pending", "Fetch snapshot erased a newer draft")
            try check(store.data.activities?.contains(where: { $0.id == activity.id }) == true, "Fetch snapshot erased a newer activity")
            try check(store.data.reviewAttempts?[attemptKey]?.independent == false, "Fetch snapshot erased the revealed-hint evidence")
            let durable = try persistence.load(scope: userID.uuidString).data
            try check(durable.practiceDrafts?[wordID] == store.data.practiceDrafts?[wordID], "Preserved live work was not persisted")
        }
        await run("same-account verification preserves memory-only work after a save failure") {
            let (store, persistence, _) = try fixture(catalogue, api)
            store.prepareToday()
            let oldRecord = store.data
            let wordID = catalogue.words[0].id
            let file = persistence.file(for: userID.uuidString)
            // Force an atomic-write failure in this fixture only, then restore storage
            // availability without saving the newer in-memory work.
            try FileManager.default.removeItem(at: file)
            try FileManager.default.createDirectory(at: file, withIntermediateDirectories: false)
            store.data.practiceDrafts = [wordID: "Unsaved work must survive reconnect"]
            try check(store.hasUnsavedChanges, "Fixture did not force a local save failure")
            try FileManager.default.removeItem(at: file)
            try persistence.save(oldRecord, scope: userID.uuidString)
            let verifiedSession = try json(session)
            QAProtocol.configure { request in
                switch request.url?.path {
                case "/auth/v1/verify": return .init(body: verifiedSession)
                case "/rest/v1/lucid_state": return .init(body: [])
                default: return .init(failure: URLError(.notConnectedToInternet))
                }
            }
            let verified = await store.verifyLogin(email: "learner@example.com", code: "123456", includeGuest: false)
            await quiesce(store)
            try check(verified, "Reconnection did not recover after storage became available")
            try check(store.data.practiceDrafts?[wordID] == "Unsaved work must survive reconnect", "Disk snapshot replaced memory-only work")
            try check(!store.hasUnsavedChanges, "Successful durable reconnect left a stale unsaved warning")
            try check(try persistence.load(scope: userID.uuidString).data.practiceDrafts?[wordID] == store.data.practiceDrafts?[wordID], "Recovered work was not durably saved")
        }
        await run("post-verification Keychain failure preserves the learner and requests a fresh code") {
            for authenticated in [false, true] {
                let (store, persistence, vault) = try fixture(catalogue, api, authenticated: authenticated)
                let previousScope = store.scope
                let previousData = store.data
                let previousSession = store.session
                let guestFile = persistence.file(for: "guest")
                let guestBytes = try Data(contentsOf: guestFile)
                vault.refuseSave = true
                let verifiedSession = try json(session)
                var verifications = 0, cloudReads = 0, uploads = 0, unexpected = 0
                QAProtocol.configure { request in
                    switch request.url?.path {
                    case "/auth/v1/verify": verifications += 1; return .init(body: verifiedSession)
                    case "/rest/v1/lucid_state": cloudReads += 1; return .init(body: [])
                    case "/rest/v1/rpc/lucid_save_state": uploads += 1; return .init(body: 1)
                    default: unexpected += 1; return .init(failure: URLError(.notConnectedToInternet))
                    }
                }
                let verified = await store.verifyLogin(email: "learner@example.com", code: "123456", includeGuest: false)
                await quiesce(store)
                try check(!verified && vault.saveCalls == 1, "Keychain failure did not stop verified-login installation")
                try check(verifications == 1 && cloudReads == 1 && uploads == 0 && unexpected == 0, "Failed secure login uploaded or made unexpected requests")
                try check(store.scope == previousScope && store.session == previousSession && vault.session == previousSession, "Failed secure save switched the active account or replaced its session")
                try check(store.data == previousData, "Failed secure save replaced the current learner")
                try check(try Data(contentsOf: guestFile) == guestBytes, "Failed secure login changed the separate guest record")
                let notice = store.accountNotice ?? ""
                try check(notice.localizedCaseInsensitiveContains("email was verified"), "Recovery failed to explain that email verification already succeeded")
                try check(notice.contains("Request a new code before trying again."), "Recovery invited reuse of a consumed OTP")
            }
            // A wrong code or offline /verify never reaches secure storage and must
            // not be described as a completed verification or consumed-code failure.
            for offline in [false, true] {
                let (store, persistence, vault) = try fixture(catalogue, api, authenticated: false)
                let previousData = store.data
                let guestBytes = try Data(contentsOf: persistence.file(for: "guest"))
                vault.refuseSave = true
                var verifications = 0, laterRequests = 0
                QAProtocol.configure { request in
                    guard request.url?.path == "/auth/v1/verify" else {
                        laterRequests += 1
                        return .init(failure: URLError(.notConnectedToInternet))
                    }
                    verifications += 1
                    return offline ? .init(failure: URLError(.notConnectedToInternet))
                        : .init(status: 403, body: ["code": "otp_expired"])
                }
                let verified = await store.verifyLogin(email: "learner@example.com", code: "123456", includeGuest: false)
                await quiesce(store)
                try check(!verified && verifications == 1 && laterRequests == 0 && vault.saveCalls == 0, "Pre-verification failure reached cloud restore, upload or Keychain save")
                try check(store.scope == "guest" && store.session == nil && vault.session == nil && store.data == previousData, "Pre-verification failure replaced the guest")
                try check(try Data(contentsOf: persistence.file(for: "guest")) == guestBytes, "Pre-verification failure wrote the guest record")
                let notice = store.accountNotice ?? ""
                try check(!notice.localizedCaseInsensitiveContains("email was verified") && !notice.contains("Request a new code before trying again."), "A rejected/offline request falsely claimed successful verification")
            }
        }
        await run("post-verification disk failure preserves the learner before Keychain save") {
            for authenticated in [false, true] {
                let (store, persistence, vault) = try fixture(catalogue, api, authenticated: authenticated)
                let previousScope = store.scope
                let previousData = store.data
                let previousSession = store.session
                let guestFile = persistence.file(for: "guest")
                let guestBytes = try Data(contentsOf: guestFile)
                let accountFile = persistence.file(for: userID.uuidString)
                let accountBytes = try Data(contentsOf: accountFile)
                var blockedFile = false
                defer {
                    if blockedFile {
                        try? FileManager.default.removeItem(at: accountFile)
                        try? accountBytes.write(to: accountFile, options: .atomic)
                    }
                }
                let verifiedSession = try json(session)
                var verifications = 0, cloudReads = 0, uploads = 0, unexpected = 0
                QAProtocol.configure { request in
                    switch request.url?.path {
                    case "/auth/v1/verify": verifications += 1; return .init(body: verifiedSession)
                    case "/rest/v1/lucid_state":
                        cloudReads += 1
                        // Only obstruct this fixture's file after its existing account
                        // was loaded and the mocked verification already succeeded.
                        try FileManager.default.removeItem(at: accountFile)
                        blockedFile = true
                        try FileManager.default.createDirectory(at: accountFile, withIntermediateDirectories: false)
                        return .init(body: [])
                    case "/rest/v1/rpc/lucid_save_state": uploads += 1; return .init(body: 1)
                    default: unexpected += 1; return .init(failure: URLError(.notConnectedToInternet))
                    }
                }
                let verified = await store.verifyLogin(email: "learner@example.com", code: "123456", includeGuest: false)
                await quiesce(store)
                try check(!verified && blockedFile && vault.saveCalls == 0, "Failed account-file save still installed a Keychain session")
                try check(verifications == 1 && cloudReads == 1 && uploads == 0 && unexpected == 0, "Failed local login made unexpected network requests")
                try check(store.scope == previousScope && store.session == previousSession && vault.session == previousSession, "Disk failure switched the active account or session")
                try check(store.data == previousData, "Disk failure discarded the current learner's in-memory work")
                try check(try Data(contentsOf: guestFile) == guestBytes, "Disk failure changed the separate guest record")
                try check(store.accountNotice?.contains("Request a new code before trying again.") == true, "Disk failure omitted fresh-code guidance after consuming the OTP")
                try FileManager.default.removeItem(at: accountFile)
                try accountBytes.write(to: accountFile, options: .atomic)
                blockedFile = false
                try check(try Data(contentsOf: accountFile) == accountBytes, "Fixture did not restore its original account file")
            }
        }
        await run("account switching never imports live guest drafts without consent") {
            let (store, _, _) = try fixture(catalogue, api)
            store.session = nil; store.scope = "guest"
            store.data.practiceDrafts = [catalogue.words[0].id: "Unrelated guest draft"]
            let verifiedSession = try json(session)
            QAProtocol.configure { request in
                switch request.url?.path {
                case "/auth/v1/verify": return .init(body: verifiedSession)
                case "/rest/v1/lucid_state": return .init(body: [])
                default: return .init(failure: URLError(.notConnectedToInternet))
                }
            }
            let verified = await store.verifyLogin(email: "learner@example.com", code: "123456", includeGuest: false)
            await quiesce(store)
            try check(verified, "Account switch failed")
            try check(store.data.practiceDrafts?[catalogue.words[0].id] != "Unrelated guest draft", "Same-account preservation leaked guest data")
        }
        await run("successful sync clears recovered disk and cloud errors") {
            let (store, persistence, _) = try fixture(catalogue, api)
            store.hasUnsavedChanges = true
            store.storageNotice = "Earlier local save failed"
            store.accountNotice = "Earlier cloud request failed"
            QAProtocol.configure { request in
                switch request.url?.path {
                case "/auth/v1/user": return .init(body: user)
                case "/rest/v1/lucid_state": return .init(body: [])
                case "/rest/v1/rpc/lucid_save_state": return .init(body: 1)
                default: return .init(failure: URLError(.notConnectedToInternet))
                }
            }
            await store.syncNow()
            try check(!store.hasUnsavedChanges && store.storageNotice == nil, "A confirmed local save left a stale disk warning")
            try check(store.accountNotice == nil && store.syncStatus == "Progress synced", "A successful sync still shows its old cloud error")
            try check(try persistence.load(scope: userID.uuidString).data == store.data, "Successful sync did not save its final state")
            await quiesce(store)
        }
        await run("a failed final sync save retains the memory draft and unsaved warning") {
            let (store, persistence, _) = try fixture(catalogue, api)
            let file = persistence.file(for: userID.uuidString)
            let wordID = catalogue.words[0].id
            let previousBytes = try Data(contentsOf: file)
            defer {
                try? FileManager.default.removeItem(at: file)
                try? previousBytes.write(to: file)
            }
            QAProtocol.configure { request in
                switch request.url?.path {
                case "/auth/v1/user": return .init(body: user)
                case "/rest/v1/lucid_state": return .init(body: [])
                case "/rest/v1/rpc/lucid_save_state":
                    try FileManager.default.removeItem(at: file)
                    try FileManager.default.createDirectory(at: file, withIntermediateDirectories: false)
                    let edited = DispatchSemaphore(value: 0)
                    Task { @MainActor in
                        store.data.practiceDrafts = [wordID: "Newer memory-only draft while upload waits"]
                        edited.signal()
                    }
                    try check(edited.wait(timeout: .now() + 5) == .success, "Concurrent disk-failure edit did not run")
                    return .init(body: 1)
                default: return .init(failure: URLError(.notConnectedToInternet))
                }
            }
            await store.syncNow()
            await quiesce(store)
            try check(store.hasUnsavedChanges && store.storageNotice != nil, "Failed final persistence falsely cleared its warning")
            try check(store.syncStatus != "Progress synced", "Failed final persistence claimed a successful sync")
            try check(store.data.practiceDrafts?[wordID] == "Newer memory-only draft while upload waits", "Failed final persistence lost its live draft")
        }
        await run("sign-out does not carry an account's unsaved flag into guest mode") {
            let (store, persistence, vault) = try fixture(catalogue, api)
            store.hasUnsavedChanges = true
            store.storageNotice = "Earlier account save failed"
            QAProtocol.configure { request in
                try check(request.url?.path == "/auth/v1/logout", "Unexpected sign-out request")
                return .init(body: [:])
            }
            await store.signOut()
            try check(store.session == nil && vault.session == nil && store.scope == "guest", "Sign-out did not switch to guest")
            try check(!store.hasUnsavedChanges && store.storageNotice == nil, "A saved account's unsaved flag leaked into guest mode")
            try check(store.data == persistence.load(scope: "guest").data, "Sign-out changed the separate guest record")
            await quiesce(store)
        }
        await run("sign-out durably preserves a memory-only edit made while logout waits") {
            let (store, persistence, vault) = try fixture(catalogue, api)
            let file = persistence.file(for: userID.uuidString)
            let previousBytes = try Data(contentsOf: file)
            let wordID = catalogue.words[0].id
            QAProtocol.configure { request in
                try check(request.url?.path == "/auth/v1/logout", "Unexpected sign-out request")
                try FileManager.default.removeItem(at: file)
                try FileManager.default.createDirectory(at: file, withIntermediateDirectories: false)
                let edited = DispatchSemaphore(value: 0)
                Task { @MainActor in
                    store.data.practiceDrafts = [wordID: "Keep the draft typed during sign-out"]
                    edited.signal()
                }
                try check(edited.wait(timeout: .now() + 5) == .success, "Concurrent sign-out edit did not run")
                try FileManager.default.removeItem(at: file)
                try previousBytes.write(to: file)
                return .init(body: [:])
            }
            await store.signOut()
            try check(store.session == nil && vault.session == nil && store.scope == "guest", "Recovered sign-out did not finish")
            try check(try persistence.load(scope: userID.uuidString).data.practiceDrafts?[wordID] == "Keep the draft typed during sign-out", "Logout switched scope before saving the newer draft")
            try check(store.data.displayName == "Separate guest" && !store.hasUnsavedChanges, "Account work leaked into guest mode")
            await quiesce(store)
        }
        await run("sign-out refuses the scope switch when its final local save fails") {
            let (store, persistence, vault) = try fixture(catalogue, api)
            let file = persistence.file(for: userID.uuidString)
            let previousBytes = try Data(contentsOf: file)
            let wordID = catalogue.words[0].id
            defer {
                try? FileManager.default.removeItem(at: file)
                try? previousBytes.write(to: file)
            }
            QAProtocol.configure { request in
                try check(request.url?.path == "/auth/v1/logout", "Unexpected sign-out request")
                try FileManager.default.removeItem(at: file)
                try FileManager.default.createDirectory(at: file, withIntermediateDirectories: false)
                let edited = DispatchSemaphore(value: 0)
                Task { @MainActor in
                    store.data.practiceDrafts = [wordID: "Do not discard this unsaved sign-out draft"]
                    edited.signal()
                }
                try check(edited.wait(timeout: .now() + 5) == .success, "Concurrent sign-out edit did not run")
                return .init(body: [:])
            }
            await store.signOut()
            try check(store.session?.user.id == userID && vault.session != nil && store.scope == userID.uuidString.lowercased(), "Failed final save still discarded the account scope")
            try check(store.data.practiceDrafts?[wordID] == "Do not discard this unsaved sign-out draft" && store.hasUnsavedChanges, "Failed final save discarded newer memory work")
            try check(store.accountNotice != nil, "Failed final save had no recovery notice")
            await quiesce(store)
        }
        print("\(passed) account QA groups passed; \(failures.count) failures. No real network, Keychain, or learner data used.")
        if !failures.isEmpty { throw QAError(description: failures.joined(separator: "\n")) }
    }
}
