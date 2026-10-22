import Foundation

// Real URLSession requests to an isolated loopback Auth/PostgREST protocol server.
// Session storage and LearningStore persistence are injected into isolated temporary files.
// No person's Keychain/UserDefaults are read and no email is sent.
enum ReminderScheduler { static func cancel() {} }
struct SharedBackendFixtureFailure: Error, CustomStringConvertible { let description: String }
struct SharedClientInput: Decodable {
    let email: String
    var code: String? = nil
    var revision: Int? = nil
    var local: LearnerData? = nil
    var guest: LearnerData? = nil
    var includeGuest: Bool? = nil
}
@main
struct NativeSharedBackendClient {
    static func main() async {
        do { try await run() } catch {
            FileHandle.standardError.write(Data(("Synthetic native client failed: \(error)\n").utf8))
            exit(1)
        }
    }
    static func run() async throws {
        guard CommandLine.arguments.count == 5,
              let url = URL(string: CommandLine.arguments[1]),
              ["localhost", "127.0.0.1", "::1"].contains(url.host ?? ""),
              url.scheme == "http" else { throw SharedBackendFixtureFailure(description: "Loopback fixture arguments required") }
        let command = CommandLine.arguments[2]
        let input = try JSONDecoder().decode(SharedClientInput.self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[3])))
        let sessionConfiguration = URLSessionConfiguration.ephemeral
        sessionConfiguration.httpCookieStorage = nil
        let urlSession = URLSession(configuration: sessionConfiguration)
        defer { urlSession.invalidateAndCancel() }
        let api = AccountService(baseURL: url, publicKey: "sb_publishable_lucid_ephemeral_test", client: urlSession)
        let session = try await api.verify(email: input.email, code: input.code ?? "123456")
        try await api.validate(session)
        let result: [String: Any]
        switch command {
        case "fetch":
            let fetched = try await api.fetch(session)
            result = ["userID": session.user.id.uuidString.lowercased(), "record": try fetched.map { try JSONSerialization.jsonObject(with: JSONEncoder().encode($0)) } ?? NSNull()]
        case "save":
            guard let local = input.local, let revision = input.revision else { throw SharedBackendFixtureFailure(description: "A local state and revision are required") }
            do {
                try await api.save(local, revision: revision, session: session)
                let fetched = try await api.fetch(session)
                result = ["saved": true, "userID": session.user.id.uuidString.lowercased(), "record": try fetched.map { try JSONSerialization.jsonObject(with: JSONEncoder().encode($0)) } ?? NSNull()]
            } catch AccountError.conflict { result = ["saved": false, "conflict": true] }
        case "merge-save":
            guard let local = input.local else { throw SharedBackendFixtureFailure(description: "A local state is required") }
            let remote = try await api.fetch(session)
            let merged = remote.map { LearningMerge.combine(local: local, remote: $0.state) } ?? local
            try await api.save(merged, revision: remote?.revision ?? 0, session: session)
            let fetched = try await api.fetch(session)
            result = ["saved": true, "userID": session.user.id.uuidString.lowercased(), "record": try fetched.map { try JSONSerialization.jsonObject(with: JSONEncoder().encode($0)) } ?? NSNull()]
                case "store-sync":
            // Exercise the production account lifecycle and automatic merge/project path
            // in an isolated temporary directory with injected session storage.
            let directory = URL(fileURLWithPath: CommandLine.arguments[4]).deletingLastPathComponent().appendingPathComponent("native-store-\(UUID().uuidString)", isDirectory: true)
            let persistence = LearningPersistence(directory: directory)
            defer { try? FileManager.default.removeItem(at: directory) }
            try persistence.save(input.guest ?? LearnerData(), scope: "guest")
            if let local = input.local { try persistence.save(local, scope: session.user.id.uuidString.lowercased()) }
            let catalogURL = URL(fileURLWithPath: FileManager.default.currentDirectoryPath).appendingPathComponent("ios/Lucid/Lucid/Resources/professional-content.json")
            let expressionsURL = URL(fileURLWithPath: FileManager.default.currentDirectoryPath).appendingPathComponent("ios/Lucid/Lucid/Resources/expression-content.json")
            let catalog = try JSONDecoder().decode(ProfessionalCatalog.self, from: Data(contentsOf: catalogURL))
            let expressions = try JSONDecoder().decode(ExpressionContent.self, from: Data(contentsOf: expressionsURL))
            let now = SharedLearningState.instant("2026-10-13T09:15:00.000Z")!
            let store = await LearningStore(catalog: catalog, expressionContent: expressions, persistence: persistence, now: { now }, accountService: api,
                                            sessionStorage: .init(load: { nil }, save: { _ in }, clear: {}))
            let verified = await store.verifyLogin(email: input.email, code: input.code ?? "123456", includeGuest: input.includeGuest ?? false)
            guard verified else { throw SharedBackendFixtureFailure(description: "Native account lifecycle verification failed") }
            await store.syncTask?.cancel()
            await store.syncNow()
            // verifyLogin intentionally starts automatic sync. syncNow can return
            // while that request is already running; wait for its confirmed result.
            let deadline = Date().addingTimeInterval(15)
            while Date() < deadline {
                let hasSynced = await store.lastSyncedAt != nil
                let isSyncing = await store.isSyncing
                if hasSynced && !isSyncing { break }
                try await Task.sleep(nanoseconds: 25_000_000)
            }
            guard await store.lastSyncedAt != nil else { throw SharedBackendFixtureFailure(description: "Native automatic sync did not finish: \(await store.syncStatus)") }
            await store.syncTask?.cancel()
            let scope = await store.scope, data = await store.data
            let xp = await store.totalXP, retained = await store.retainedContextCount
            let guest = try persistence.load(scope: "guest").data
            let fetched = try await api.fetch(session)
            result = ["saved": true, "scope": scope,
                      "totalXP": xp, "retainedContextCount": retained,
                      "guestIntroducedWordIds": guest.introducedWordIds,
                      "guestDraftCount": guest.practiceDrafts?.count ?? 0,
                      "hydratedStartingChecks": data.courseCheckDrafts?.count ?? 0,
                      "hydratedNotebook": data.expressionGaps?.count ?? 0,
                      "hydratedRehearsals": data.rehearsalSessions?.count ?? 0,
                      "hydratedChallenges": data.transferSessions?.count ?? 0,
                      "record": try fetched.map { try JSONSerialization.jsonObject(with: JSONEncoder().encode($0)) } ?? NSNull()]
        case "signout":
            try await api.signOut(session)
            do {
                try await api.validate(session)
                throw SharedBackendFixtureFailure(description: "A revoked native session remained valid")
            } catch AccountError.sessionExpired { result = ["revoked": true] }
        default: throw SharedBackendFixtureFailure(description: "Unsupported fixture command")
        }
        let encoded = try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys])
        try encoded.write(to: URL(fileURLWithPath: CommandLine.arguments[4]), options: .atomic)
    }
}
