import Foundation

// This executable intercepts every URLSession request. It never opens a real URL,
// sends email, reads/writes Keychain, or creates a LearningStore.
enum ReminderScheduler { static func cancel() {} }

struct AuthTestFailure: Error, CustomStringConvertible { let description: String }
func check(_ condition: @autoclosure () throws -> Bool, _ message: String) throws {
    if try !condition() { throw AuthTestFailure(description: message) }
}

final class MockAuthProtocol: URLProtocol {
    struct Stub {
        let inspect: (URLRequest) throws -> Void
        let status: Int
        let bytes: Data
        let failure: Error?
    }
    private static let lock = NSLock()
    private static var pending: [Stub] = []
    static func set(_ stub: Stub) { lock.lock(); pending = [stub]; lock.unlock() }
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        Self.lock.lock()
        let next = Self.pending.isEmpty ? nil : Self.pending.removeFirst()
        Self.lock.unlock()
        guard let next else {
            client?.urlProtocol(self, didFailWithError: AuthTestFailure(description: "Unexpected request intercepted"))
            return
        }
        do {
            try next.inspect(request)
            if let failure = next.failure { throw failure }
            let response = HTTPURLResponse(url: request.url!, statusCode: next.status, httpVersion: "HTTP/1.1", headerFields: ["Content-Type": "application/json"])!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: next.bytes)
            client?.urlProtocolDidFinishLoading(self)
        } catch { client?.urlProtocol(self, didFailWithError: error) }
    }
    override func stopLoading() {}
}

@main
struct AuthProtocolTests {
    static let userID = UUID(uuidString: "11111111-1111-1111-1111-111111111111")!
    static let expiry = Date().timeIntervalSince1970 + 3600
    static var sessionJSON: [String: Any] {
        ["access_token": "test-access-only", "refresh_token": "test-refresh-only", "expires_at": expiry,
         "user": ["id": userID.uuidString, "email": "learner@example.com"]]
    }
    static func body(_ request: URLRequest) throws -> [String: Any] {
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
        } else { throw AuthTestFailure(description: "Missing request body") }
        return try JSONSerialization.jsonObject(with: data) as! [String: Any]
    }
    static func stub(_ path: String, status: Int = 200, json: Any = [:], failure: Error? = nil,
                     inspect: @escaping (URLRequest) throws -> Void = { _ in }) throws {
        MockAuthProtocol.set(.init(inspect: { request in
            try check(request.url?.host == "lucid-auth.invalid", "Request escaped test host")
            try check(request.url?.path == path, "Wrong endpoint: \(request.url?.path ?? "nil")")
            try check(request.value(forHTTPHeaderField: "apikey") == "sb_publishable_test_only", "Missing public key")
            try inspect(request)
        }, status: status, bytes: try JSONSerialization.data(withJSONObject: json, options: [.fragmentsAllowed]), failure: failure))
    }
    static func expect(_ expected: AccountError, operation: () async throws -> Void) async throws {
        do {
            try await operation()
            throw AuthTestFailure(description: "Expected AccountError was not thrown")
        } catch let actual as AccountError {
            try check(String(describing: actual) == String(describing: expected), "Unexpected account error: \(actual)")
        }
    }
    static func main() async throws {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [MockAuthProtocol.self]
        let urlSession = URLSession(configuration: config)
        defer { urlSession.invalidateAndCancel() }
        let api = AccountService(baseURL: URL(string: "https://lucid-auth.invalid")!, publicKey: "sb_publishable_test_only", client: urlSession)

        try stub("/auth/v1/otp") { request in
            let value = try body(request)
            try check(request.httpMethod == "POST", "OTP must be POST")
            try check(value["email"] as? String == "learner@example.com", "Email normalization failed")
            try check(value["create_user"] as? Bool == true, "New email users must be supported")
        }
        try await api.sendCode(email: " Learner@Example.com ")
        print("PASS email request normalization")

        try stub("/auth/v1/verify", json: sessionJSON) { request in
            let value = try body(request)
            try check(value["type"] as? String == "email" && value["token"] as? String == "123456", "Invalid verification payload")
        }
        let session = try await api.verify(email: "learner@example.com", code: "123456")
        try check(session.user.id == userID && session.expiresAt == expiry, "Absolute expiry/session did not decode")
        let roundtrip = try JSONDecoder().decode(AccountSession.self, from: JSONEncoder().encode(session))
        try check(roundtrip == session, "Saved session expiry changed after decoding")
        print("PASS expires_at decode and durable roundtrip")

        var relative = sessionJSON
        relative.removeValue(forKey: "expires_at"); relative["expires_in"] = 3600
        try stub("/auth/v1/verify", json: relative)
        let before = Date().timeIntervalSince1970
        let fallback = try await api.verify(email: "learner@example.com", code: "123456")
        try check(fallback.expiresAt >= before + 3600 && fallback.expiresAt <= Date().timeIntervalSince1970 + 3600, "expires_in fallback was not computed once")
        print("PASS expires_in compatibility fallback")

        relative["expires_in"] = 0
        try stub("/auth/v1/verify", json: relative)
        try await expect(.response) { _ = try await api.verify(email: "learner@example.com", code: "123456") }
        print("PASS invalid session response fails closed")

        for key in ["code", "error_code"] {
            try stub("/auth/v1/verify", status: 403, json: [key: "otp_expired"])
            try await expect(.invalidCode) { _ = try await api.verify(email: "learner@example.com", code: "000000") }
        }
        print("PASS expired/wrong OTP HTTP 403 guidance")

        try await expect(.invalidCode) { _ = try await api.verify(email: "learner@example.com", code: "١٢٣٤٥٦") }
        print("PASS non-ASCII OTP rejected without network")

        try stub("/auth/v1/token", status: 400, json: ["code": "refresh_token_not_found"]) { request in
            try check(request.url?.query == "grant_type=refresh_token", "Wrong refresh grant")
            try check(try body(request)["refresh_token"] as? String == session.refreshToken, "Wrong refresh token")
        }
        try await expect(.sessionExpired) { _ = try await api.refresh(session) }
        print("PASS invalid refresh token guidance")

        try stub("/auth/v1/otp", status: 429, json: ["code": "over_email_send_rate_limit"])
        try await expect(.rateLimited) { try await api.sendCode(email: "learner@example.com") }
        print("PASS server rate limit remains retryable")

        try stub("/auth/v1/otp", failure: URLError(.notConnectedToInternet))
        do {
            try await api.sendCode(email: "learner@example.com")
            throw AuthTestFailure(description: "Expected offline error")
        } catch let error as URLError { try check(error.code == .notConnectedToInternet, "Offline error was lost") }
        print("PASS offline failure preserved")

        try stub("/auth/v1/user", json: ["id": "22222222-2222-2222-2222-222222222222"]) { request in
            try check(request.value(forHTTPHeaderField: "Authorization") == "Bearer test-access-only", "Missing bearer token")
            try check(request.cachePolicy == .reloadIgnoringLocalCacheData, "Account read could use stale cached state")
        }
        try await expect(.sessionExpired) { try await api.validate(session) }
        print("PASS mismatched live account rejected")

        try stub("/rest/v1/lucid_state", json: [["revision": 1, "state": ["incomplete": true]]])
        try await expect(.response) { _ = try await api.fetch(session) }
        print("PASS unreadable cloud data rejected before overwrite")

        var learner = LearnerData()
        learner.practiceDrafts = ["word": "private sentence"]
        learner.reviewAttempts = ["day:word": ReviewAttempt(originalAttempt: "private answer", independent: false)]
        try stub("/rest/v1/rpc/lucid_save_state", json: 1) { request in
            let payload = try body(request)
            let record = payload["new_state"] as! [String: Any]
            try check(record["practiceDrafts"] == nil && record["reviewAttempts"] == nil, "Private practice leaked to cloud")
            try check(record["schemaVersion"] as? Int == 2, "Cloud schema version missing")
        }
        try await api.save(learner, revision: 0, session: session)
        print("PASS cloud requests omit drafts and persisted review attempts")
        print("12 auth protocol groups passed; every request mocked, no account or Keychain mutations")
    }
}
