import Foundation
import Security

struct AccountUser: Codable, Equatable {
    let id: UUID
    let email: String?
}
struct AccountSession: Codable, Equatable {
    let accessToken: String
    let refreshToken: String
    let expiresAt: TimeInterval
    let user: AccountUser
    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token", refreshToken = "refresh_token", expiresAt = "expires_at", expiresIn = "expires_in", user
    }
    init(accessToken: String, refreshToken: String, expiresAt: TimeInterval, user: AccountUser) {
        self.accessToken = accessToken
        self.refreshToken = refreshToken
        self.expiresAt = expiresAt
        self.user = user
    }
    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        accessToken = try values.decode(String.self, forKey: .accessToken)
        refreshToken = try values.decode(String.self, forKey: .refreshToken)
        user = try values.decode(AccountUser.self, forKey: .user)
        if let absolute = try values.decodeIfPresent(TimeInterval.self, forKey: .expiresAt) {
            expiresAt = absolute
        } else {
            let duration = try values.decode(TimeInterval.self, forKey: .expiresIn)
            guard duration.isFinite, duration > 0 else { throw AccountError.response }
            expiresAt = Date().timeIntervalSince1970 + duration
        }
        guard !accessToken.isEmpty, !refreshToken.isEmpty, expiresAt.isFinite, expiresAt > 0 else {
            throw AccountError.response
        }
    }
    func encode(to encoder: Encoder) throws {
        var values = encoder.container(keyedBy: CodingKeys.self)
        try values.encode(accessToken, forKey: .accessToken)
        try values.encode(refreshToken, forKey: .refreshToken)
        // Persist an absolute expiry so relaunching never extends a saved session.
        try values.encode(expiresAt, forKey: .expiresAt)
        try values.encode(user, forKey: .user)
    }
}
struct CloudLearningRecord: Codable {
    let revision: Int
    let state: LearnerData
}
enum AccountError: LocalizedError {
    case unavailable, invalidEmail, invalidCode, sessionExpired, deletionVerificationExpired, conflict, rateLimited, server, keychain, response
    var errorDescription: String? {
        switch self {
        case .unavailable: "Cloud accounts are not available in this build yet. You can keep learning on this device."
        case .invalidEmail: "Enter a valid email address."
        case .invalidCode: "That code is incorrect or has expired. Check the latest email or request a new code."
        case .sessionExpired: "Please verify your email again to reconnect your account. Your progress is safe on this device."
        case .deletionVerificationExpired: "Your deletion verification expired. Request a new email code, verify it, and confirm deletion again. Your account has not been deleted."
        case .conflict: "Progress changed on another device. Please try syncing again."
        case .rateLimited: "Too many requests. Please wait a few minutes before trying again."
        case .server: "Lucid could not connect to your account. Your progress is saved on this device."
        case .keychain: "iOS could not securely save this login. Unlock your device and try again."
        case .response: "This version of Lucid could not read your cloud progress. Update the app or contact support."
        }
    }
}

enum AccountKeychain {
    private static let service = "com.sunilnjc.lucid.auth"
    private static let account = "email-session"
    private static var query: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account]
    }
    static func load() throws -> AccountSession? {
        var request = query
        request[kSecReturnData as String] = true
        request[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(request as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = result as? Data else { throw AccountError.keychain }
        return try JSONDecoder().decode(AccountSession.self, from: data)
    }
    static func save(_ session: AccountSession) throws {
        let encoded = try JSONEncoder().encode(session)
        let update: [String: Any] = [kSecValueData as String: encoded, kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
        var status = SecItemUpdate(query as CFDictionary, update as CFDictionary)
        if status == errSecItemNotFound {
            status = SecItemAdd(query.merging(update) { _, value in value } as CFDictionary, nil)
        }
        guard status == errSecSuccess else { throw AccountError.keychain }
    }
    static func clear() throws {
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw AccountError.keychain }
    }
}

/// Injectable session storage keeps account lifecycle tests away from a person's Keychain.
struct AccountSessionStorage {
    let load: () throws -> AccountSession?
    let save: (AccountSession) throws -> Void
    let clear: () throws -> Void
    static var keychain: Self {
        .init(load: { try AccountKeychain.load() }, save: { try AccountKeychain.save($0) }, clear: { try AccountKeychain.clear() })
    }
}

/// Uses Supabase's public Auth and PostgREST APIs. No administrative credential belongs in the app.
final class AccountService {
    let baseURL: URL
    private let publicKey: String
    private let client: URLSession
    let emailDeliveryReady: Bool

    init(baseURL: URL, publicKey: String, client: URLSession = .shared, emailDeliveryReady: Bool = true) {
        self.baseURL = baseURL; self.publicKey = publicKey; self.client = client
        self.emailDeliveryReady = emailDeliveryReady
    }
    static func configured() -> AccountService? {
        guard (Bundle.main.object(forInfoDictionaryKey: "LucidCloudAuthEnabled") as? String) == "YES" else { return nil }
        guard let url = Bundle.main.object(forInfoDictionaryKey: "LucidSupabaseURL") as? String,
              let key = Bundle.main.object(forInfoDictionaryKey: "LucidSupabasePublishableKey") as? String,
              !key.isEmpty, !key.contains("$("),
              let parsed = URL(string: url), parsed.scheme == "https", parsed.host != nil else { return nil }
        return AccountService(baseURL: parsed, publicKey: key, emailDeliveryReady: (Bundle.main.object(forInfoDictionaryKey: "LucidEmailDeliveryReady") as? String) == "YES")
    }
    static func normalizedEmail(_ email: String) throws -> String {
        let value = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard value.count <= 254,
              value.range(of: #"^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9.-]*[A-Z0-9])?\.[A-Z]{2,}$"#, options: [.regularExpression, .caseInsensitive]) != nil else { throw AccountError.invalidEmail }
        return value
    }
    func sendCode(email: String) async throws {
        guard emailDeliveryReady else { throw AccountError.unavailable }
        _ = try await request("auth/v1/otp", body: ["email": try Self.normalizedEmail(email), "create_user": true])
    }
    func verify(email: String, code: String) async throws -> AccountSession {
        guard (6...10).contains(code.count), code.utf8.allSatisfy({ (48...57).contains($0) }) else { throw AccountError.invalidCode }
        let data = try await request("auth/v1/verify", body: ["email": try Self.normalizedEmail(email), "token": code, "type": "email"])
        return try decodeSession(data)
    }
    func refresh(_ session: AccountSession) async throws -> AccountSession {
        let data = try await request("auth/v1/token", query: "grant_type=refresh_token", body: ["refresh_token": session.refreshToken])
        return try decodeSession(data)
    }
    func validate(_ session: AccountSession) async throws {
        let data = try await request("auth/v1/user", method: "GET", token: session.accessToken)
        let user = try JSONDecoder().decode(AccountUser.self, from: data)
        guard user.id == session.user.id else { throw AccountError.sessionExpired }
    }
    func signOut(_ session: AccountSession) async throws {
        _ = try await request("auth/v1/logout", query: "scope=local", token: session.accessToken)
    }
    func fetch(_ session: AccountSession) async throws -> CloudLearningRecord? {
        let data = try await request("rest/v1/lucid_state", method: "GET",
                                    query: "user_id=eq.\(session.user.id.uuidString.lowercased())&select=revision,state", token: session.accessToken)
        do {
            let records = try JSONDecoder().decode([CloudLearningRecord].self, from: data)
            guard records.count <= 1,
                  records.allSatisfy({ $0.revision >= 0 && $0.state.schemaVersion == 2 }) else {
                // An older app must never down-convert and upload a newer cloud schema.
                throw AccountError.response
            }
            return records.first
        } catch { throw AccountError.response }
    }
    func save(_ state: LearnerData, revision: Int, session: AccountSession) async throws {
        let json = try JSONSerialization.jsonObject(with: JSONEncoder().encode(LearningMerge.cloudRecord(state)))
        _ = try await request("rest/v1/rpc/lucid_save_state", body: ["expected_revision": revision, "new_state": json], token: session.accessToken)
    }
    func deleteAccount(_ session: AccountSession) async throws {
        _ = try await request("functions/v1/delete-account", body: [:], token: session.accessToken)
    }
    private func decodeSession(_ data: Data) throws -> AccountSession {
        do { return try JSONDecoder().decode(AccountSession.self, from: data) }
        catch { throw AccountError.response }
    }
    private func request(_ path: String, method: String = "POST", query: String? = nil, body: [String: Any]? = nil, token: String? = nil) async throws -> Data {
        var parts = URLComponents(url: baseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
        parts.percentEncodedQuery = query
        guard let url = parts.url else { throw AccountError.unavailable }
        var request = URLRequest(url: url, timeoutInterval: 25)
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.httpMethod = method
        request.setValue("no-store", forHTTPHeaderField: "Cache-Control")
        request.setValue(publicKey, forHTTPHeaderField: "apikey")
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let body { request.httpBody = try JSONSerialization.data(withJSONObject: body) }
        let (data, response) = try await client.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw AccountError.server }
        let failure = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        let code = failure?["code"] as? String ?? failure?["error_code"] as? String
        // Supabase returns expired/incorrect email OTPs as HTTP 403, not only 400.
        if path == "auth/v1/verify", code == "otp_expired" { throw AccountError.invalidCode }
        if path == "functions/v1/delete-account", http.statusCode == 403 {
            throw AccountError.deletionVerificationExpired
        }
        switch http.statusCode {
        case 200..<300: return data
        case 409: throw AccountError.conflict
        case 429: throw AccountError.rateLimited
        case 401, 403: throw AccountError.sessionExpired
        case 400 where path.contains("verify"): throw AccountError.invalidCode
        case 422 where path.contains("verify"): throw AccountError.invalidCode
        case 400 where path.contains("token"): throw AccountError.sessionExpired
        default: throw AccountError.server
        }
    }
}

@MainActor
extension LearningStore {
    func queueSync() {
        guard session != nil, !storageBlocked, !accountBusy, !needsAccountVerification else { return }
        if isSyncing { syncAgain = true; return }
        syncStatus = "Saved on device · waiting to sync"
        syncTask?.cancel()
        syncTask = Task { [weak self] in
            do { try await Task.sleep(nanoseconds: 1_500_000_000) } catch { return }
            await self?.syncNow()
        }
    }

    func sendLoginCode(email: String) async -> Bool {
        guard !accountBusy else { return false }
        guard let accountService else { accountNotice = AccountError.unavailable.localizedDescription; return false }
        accountBusy = true
        accountNotice = nil
        defer { accountBusy = false }
        do { try await accountService.sendCode(email: email); return true }
        catch { accountNotice = friendlyAccountError(error); return false }
    }

    func verifyLogin(email: String, code: String, includeGuest: Bool) async -> Bool {
        guard !accountBusy, !storageBlocked, let accountService else { return false }
        accountBusy = true
        accountNotice = nil
        // A refresh already in flight must not overwrite this fresh OTP session.
        accountGeneration = UUID()
        let generation = accountGeneration
        syncTask?.cancel()
        defer { accountBusy = false }
        var emailWasVerified = false
        do {
            let verified = try await accountService.verify(email: email, code: code)
            emailWasVerified = true
            guard generation == accountGeneration else { return false }
            // Reauthentication cannot accidentally transfer a signed-in person's data to another account.
            if let session, session.user.id != verified.user.id { throw AccountError.invalidEmail }
            try persistence.recoverUnconfirmedAccountDeletion(userID: verified.user.id)
            let newScope = verified.user.id.uuidString.lowercased()
            let reconnectingCurrentAccount = session?.user.id == verified.user.id && scope == newScope
            // Same-account reauthentication must include memory-only work that could not
            // be saved yet (for example when the device was temporarily out of space).
            var next = try reconnectingCurrentAccount ? data : persistence.load(scope: newScope).data
            var restoreNotice: String?
            do {
                if let cloud = try await accountService.fetch(verified) {
                    next = LearningMerge.combine(local: next, remote: cloud.state)
                }
            } catch AccountError.sessionExpired {
                throw AccountError.sessionExpired
            } catch {
                // The OTP is consumed after verification. Keep its valid session even if
                // cloud restore is temporarily unavailable; sync will fetch before writing.
                restoreNotice = friendlyAccountError(error)
            }
            guard generation == accountGeneration else { return false }
            if reconnectingCurrentAccount {
                // Fetch is an await boundary: edits, day rollover, or another scene can
                // change this account while it is in flight. Keep the live device-private
                // drafts/attempts and merge progress into that latest state, not its snapshot.
                next = LearningMerge.combine(local: data, remote: next)
            }
            let importingGuest = scope == "guest" && includeGuest
            if importingGuest { next = LearningMerge.combine(local: next, remote: LearningMerge.cloudRecord(data)) }
            // Keep device preferences, but never carry another account's drafts into this scope.
            next.settings = data.settings
            if importingGuest {
                // Explicit guest import includes local-only visited plans. An existing
                // account plan wins for the same role/day; no cache crosses otherwise.
                var plans = next.dailyRolePlans ?? [:]
                for (roleId, plan) in data.dailyRolePlans ?? [:] {
                    if plans[roleId] == nil || plan.dayKey > plans[roleId]!.dayKey { plans[roleId] = plan }
                }
                next.dailyRolePlans = plans
                next.practiceDrafts = (data.practiceDrafts ?? [:]).merging(next.practiceDrafts ?? [:]) { guest, account in
                    account.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? guest : account
                }
                next.reviewAttempts = (data.reviewAttempts ?? [:]).merging(next.reviewAttempts ?? [:]) { guest, account in
                    // Importing cannot turn a revealed hint into independent recall.
                    !guest.independent ? guest : account
                }
            }
            next = normalizedDailyPlan(next, at: clock())
            try persistence.save(next, scope: newScope)
            try sessionStorage.save(verified)
            accountGeneration = UUID()
            syncTask?.cancel()
            scope = newScope
            session = verified
            needsAccountVerification = false
            isApplyingRemote = true
            data = next
            isApplyingRemote = false
            dataRevision += 1
            hasUnsavedChanges = false
            storageNotice = nil
            cloudRestorePending = restoreNotice != nil
            currentDate = clock()
            prepareToday()
            accountNotice = restoreNotice
            syncStatus = restoreNotice == nil ? "Signed in · ready to sync" : "Signed in · cloud restore pending"
            Task { [weak self] in await self?.syncNow() }
            return true
        } catch {
            if emailWasVerified {
                // Verification consumes the OTP even if local persistence or Keychain
                // storage fails afterwards. Never invite a replay of that used code.
                let message: String
                if case AccountError.keychain = error {
                    message = "Your email was verified, but iOS could not securely save this login. Unlock your device."
                } else {
                    message = friendlyAccountError(error)
                }
                accountNotice = message + " Request a new code before trying again. Your local learning has not been reset."
            } else {
                accountNotice = friendlyAccountError(error)
            }
            return false
        }
    }

    func syncNow() async {
        guard !accountBusy, !storageBlocked, !needsAccountVerification, let accountService, var current = session else { return }
        if isSyncing { syncAgain = true; return }
        isSyncing = true
        let generation = accountGeneration
        defer {
            isSyncing = false
            if syncAgain { syncAgain = false; queueSync() }
        }
        syncStatus = "Syncing your progress…"
        do {
            if current.expiresAt < clock().timeIntervalSince1970 + 90 {
                let refreshed = try await accountService.refresh(current)
                guard generation == accountGeneration else { return }
                guard refreshed.user.id == current.user.id else { throw AccountError.sessionExpired }
                try sessionStorage.save(refreshed)
                session = refreshed
                current = refreshed
            }
            // Validate live account status; deleted users' unexpired JWTs must not re-create records.
            try await accountService.validate(current)
            for attempt in 0..<3 {
                let remote = try await accountService.fetch(current)
                guard generation == accountGeneration, !Task.isCancelled else { return }
                var merged = remote.map { LearningMerge.combine(local: data, remote: $0.state) } ?? data
                merged = normalizedDailyPlan(merged, at: clock())
                if cloudRestorePending {
                    // A successful read establishes whether this is a returning or a new
                    // account. Apply it before allowing onboarding, even if upload later fails.
                    try persistence.save(merged, scope: scope)
                    if hasUnsavedChanges { storageNotice = nil }
                    hasUnsavedChanges = false
                    isApplyingRemote = true
                    data = merged
                    isApplyingRemote = false
                    dataRevision += 1
                    cloudRestorePending = false
                    prepareToday()
                    merged = data
                }
                let revisionBeforeUpload = dataRevision
                do {
                    try await accountService.save(merged, revision: remote?.revision ?? 0, session: current)
                    guard generation == accountGeneration else { return }
                    let combined = dataRevision == revisionBeforeUpload ? merged : LearningMerge.combine(local: data, remote: merged)
                    let final = normalizedDailyPlan(combined, at: clock())
                    try persistence.save(final, scope: scope)
                    if hasUnsavedChanges { storageNotice = nil }
                    hasUnsavedChanges = false
                    accountNotice = nil
                    isApplyingRemote = true
                    data = final
                    isApplyingRemote = false
                    currentDate = clock()
                    if dataRevision != revisionBeforeUpload || final != merged { syncAgain = true }
                    lastSyncedAt = clock()
                    syncStatus = "Progress synced"
                    return
                } catch AccountError.conflict where attempt < 2 { continue }
            }
            throw AccountError.conflict
        } catch {
            guard generation == accountGeneration else { return }
            if case AccountError.sessionExpired = error { needsAccountVerification = true }
            syncStatus = needsAccountVerification ? "Saved on device · verify email to reconnect" : "Saved on device · sync needs attention"
            accountNotice = friendlyAccountError(error)
        }
    }

    func signOut() async {
        guard !accountBusy else { return }
        accountBusy = true
        defer { accountBusy = false }
        // Stop pending uploads first and prevent late responses from mutating the next account.
        accountGeneration = UUID()
        syncTask?.cancel()
        do {
            try persistence.save(data, scope: scope)
            let guest = try persistence.load(scope: "guest")
            if let session, let accountService { try? await accountService.signOut(session) }
            // Logout is an await boundary. Keep any work typed while it was in
            // flight; if the final local save fails, remain on this account.
            try persistence.save(data, scope: scope)
            try sessionStorage.clear()
            session = nil
            needsAccountVerification = false
            cloudRestorePending = false
            scope = "guest"
            isApplyingRemote = true
            data = guest.data
            isApplyingRemote = false
            lastSyncedAt = nil
            syncStatus = "Saved on this device"
            hasUnsavedChanges = false
            storageNotice = guest.notice
            accountNotice = nil
            selectedTab = 0
            ReminderScheduler.cancel()
            prepareToday()
        } catch { accountNotice = friendlyAccountError(error) }
    }

    /// Called only after a fresh email verification and an explicit destructive confirmation.
    func deleteAccount() async -> Bool {
        guard !accountBusy, let session, let accountService else { return false }
        accountBusy = true
        accountGeneration = UUID()
        syncTask?.cancel()
        defer { accountBusy = false }
        do {
            let userID = session.user.id
            // If this atomic write fails, do not make the remote destructive request.
            try persistence.markAccountDeletion(userID: userID, confirmed: false)
            do {
                try await accountService.deleteAccount(session)
            } catch AccountError.deletionVerificationExpired {
                // A 403 is an explicit refusal, not an ambiguous lost response. Keep the
                // account accessible and let the person request fresh verification.
                try persistence.recoverUnconfirmedAccountDeletion(userID: userID)
                accountNotice = AccountError.deletionVerificationExpired.localizedDescription
                return false
            } catch {
                // Timeout may mean deletion succeeded but its response was lost. Retain the
                // local record, invalidate automatic session restore, and require a new OTP.
                _ = leaveAccountAfterDeletionAttempt()
                accountNotice = "Lucid could not confirm account deletion. Sign in again to check; your local record has been retained safely."
                return false
            }
            var cleanupFailed = false
            do { try persistence.markAccountDeletion(userID: userID, confirmed: true) } catch { cleanupFailed = true }
            do { try persistence.remove(scope: userID.uuidString.lowercased()) } catch { cleanupFailed = true }
            if leaveAccountAfterDeletionAttempt() { cleanupFailed = true }
            if cleanupFailed { storageNotice = "Your cloud account was deleted. Local cleanup needs another attempt; this account cannot sign itself back in." }
            syncStatus = "Account deleted · learning as a guest"
            return true
        } catch { isApplyingRemote = false; accountNotice = friendlyAccountError(error); return false }
    }

    private func leaveAccountAfterDeletionAttempt() -> Bool {
        var cleanupFailed = false
        do { try sessionStorage.clear() } catch { cleanupFailed = true }
        session = nil
        needsAccountVerification = false
        scope = "guest"
        cloudRestorePending = false
        storageBlocked = false
        storageNeedsUpdate = false
        hasUnsavedChanges = false
        isApplyingRemote = true
        do {
            let guest = try persistence.load(scope: scope)
            data = guest.data
            storageNotice = guest.notice
        } catch {
            data = LearnerData()
            storageBlocked = true
            if case LearningPersistence.PersistenceError.newerVersion = error { storageNeedsUpdate = true }
            storageNotice = error.localizedDescription
        }
        isApplyingRemote = false
        lastSyncedAt = nil
        selectedTab = 0
        syncStatus = "Saved on this device"
        ReminderScheduler.cancel()
        return cleanupFailed
    }

    private func friendlyAccountError(_ error: Error) -> String {
        if let error = error as? AccountError { return error.localizedDescription }
        if let error = error as? URLError {
            switch error.code {
            case .notConnectedToInternet, .networkConnectionLost, .timedOut:
                return "You're offline or the connection timed out. Your progress is saved on this device; try again when connected."
            default: break
            }
        }
        return AccountError.server.localizedDescription
    }
}
