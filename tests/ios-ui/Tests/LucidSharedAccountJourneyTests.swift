import XCTest

/// Real app UI + production AccountService against the disposable local
/// signed-Auth/PostgREST fixture and its real PostgreSQL database.
/// This is deliberately skipped in the ordinary offline guest scheme.
final class LucidSharedAccountJourneyTests: XCTestCase {
    private let origin = "http://127.0.0.1:4777"
    private let publicKey = "sb_publishable_lucid_ephemeral_test"
    private let bobEmail = "lucid-bob@example.invalid"
    private let aliceEmail = "lucid-alice@example.invalid"
    private let bobID = "22222222-2222-4222-8222-222222222222"
    private let noteID = "00000000-0000-4000-8000-000000000501"
    private let peerNoteID = UUID().uuidString.lowercased()
    private let historyID = "00000000-0000-4000-8000-000000000503"
    private let precise = "The rationale for this approach is to reduce the risk of rework."
    private let diplomatic = "Could I explain the reasoning behind this approach before we decide?"
    private let privateDraft = "Synthetic confidential launch reason stays on this simulator"

    private func request(_ path: String, method: String = "GET", body: [String: Any]? = nil, token: String? = nil) async throws -> Any {
        var request = URLRequest(url: URL(string: origin + path)!)
        request.httpMethod = method; request.timeoutInterval = 15
        request.setValue(publicKey, forHTTPHeaderField: "apikey")
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let body { request.httpBody = try JSONSerialization.data(withJSONObject: body); request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as! HTTPURLResponse).statusCode
        guard status == 200 else { throw NSError(domain: "SyntheticSharedUI", code: status, userInfo: [NSLocalizedDescriptionKey: "Local fixture rejected \(path), HTTP \(status)"]) }
        return try JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed])
    }
    private func token(email: String) async throws -> String {
        let value = try await request("/auth/v1/verify", method: "POST", body: ["email": email, "token": "123456", "type": "email"]) as! [String: Any]
        return value["access_token"] as! String
    }
    private func record(token: String) async throws -> [String: Any]? {
        let rows = try await request("/rest/v1/lucid_state?user_id=eq.\(bobID)&select=revision,state", token: token) as! [[String: Any]]
        return rows.first
    }
    private func stamp(_ date: Date) -> String { let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return f.string(from: date) }
    private func day(_ date: Date) -> String { String(stamp(date).prefix(10)) }
    private func minimalState() -> [String: Any] {
        ["schemaVersion": 2, "introducedWordIds": [String](), "progressByWordId": [String: Any](), "sessions": [Any](), "favouriteWordIds": [String](), "completedWordIdsToday": [String](), "currentWordIds": [String](), "settings": ["notificationsEnabled": false, "reminderHour": 9, "reminderMinute": 0, "speechRate": 0.46], "reviewPromptMilestone": 0]
    }
    @MainActor private func show(_ app: XCUIApplication, _ element: XCUIElement, up: Bool = true, limit: Int = 28) throws {
        for _ in 0..<limit {
            if element.isHittable { return }
            if up { app.swipeUp() } else { app.swipeDown() }
        }
        throw NSError(domain: "SyntheticSharedUI", code: 2, userInfo: [NSLocalizedDescriptionKey: "Could not reach \(element)\n\(app.debugDescription)"])
    }
    @MainActor private func signIn(_ app: XCUIApplication, email: String) throws {
        let login = app.buttons["Sign in or create an account"]
        guard login.waitForExistence(timeout: 10) else { throw NSError(domain: "SyntheticSharedUI", code: 4, userInfo: [NSLocalizedDescriptionKey: "Sign-in entry absent: \(app.debugDescription)"]) }; try show(app, login); login.tap()
        let field = app.textFields["account.email"]
        XCTAssertTrue(field.waitForExistence(timeout: 8), app.debugDescription); try show(app, field); field.tap(); field.typeText(email)
        let dismiss = app.buttons["Dismiss keyboard"]; if dismiss.exists { dismiss.tap() }
        let send = app.buttons["Send verification code"]; try show(app, send); send.tap()
        let code = app.textFields["account.code"]
        guard code.waitForExistence(timeout: 12) else { throw NSError(domain: "SyntheticSharedUI", code: 1, userInfo: [NSLocalizedDescriptionKey: "Code field absent after request: \(app.debugDescription)"]) }
        try show(app, code); code.tap(); code.typeText("123456")
        if dismiss.exists { dismiss.tap() }
        let verify = app.buttons["Verify and sign in"]; try show(app, verify); verify.tap()
        if !app.tabBars.buttons["Today"].waitForExistence(timeout: 20) {
            let identity = app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", "Signed in as \(email)")).firstMatch
            guard identity.exists else { throw NSError(domain: "SyntheticSharedUI", code: 5, userInfo: [NSLocalizedDescriptionKey: "Verified identity was not rendered: \(app.debugDescription)"]) }
        }
    }
    @MainActor func testSharedAccountNotebookProgressAndIsolation() async throws {
        guard ProcessInfo.processInfo.environment["LUCID_UIQA_RUN_SHARED"] == "1" else { throw XCTSkip("Use the LucidSharedJourneyQA scheme with the disposable loopback provider.") }
        continueAfterFailure = false
        let bobToken = try await token(email: bobEmail)
        let existing = try await record(token: bobToken)
        var state = existing?["state"] as? [String: Any] ?? minimalState()
        let alreadyCompleted = Set(state["completedWordIdsToday"] as? [String] ?? [])
        let currentWords = state["currentWordIds"] as? [String] ?? []
        let practiceWord = currentWords.first { !alreadyCompleted.contains($0) } ?? "finance-reconcile"
        state["profile"] = ["roleId": "finance-accounting", "seniorityId": "early-career", "situationIds": ["finance:month-end-close"], "goalIds": ["clarify"]]
        let now = Date().addingTimeInterval(-3)
        var shared = state["sharedLearning"] as? [String: Any] ?? ["version": 1, "lessonCheckpoints": [String: Any](), "startingChecks": [String: Any](), "notebook": [String: Any](), "rehearsals": [String: Any](), "challenges": [String: Any](), "exposures": [String: Any]()]
        var notes = shared["notebook"] as? [String: Any] ?? [:]
        notes[noteID] = ["id": noteID, "roleId": "finance-accounting", "expressionId": "explain-the-reason", "style": "precise", "phrase": precise, "createdAt": stamp(now), "nextReviewOn": day(now.addingTimeInterval(86400))]
        shared["notebook"] = notes
        var rehearsals = shared["rehearsals"] as? [String: Any] ?? [:]
        rehearsals[historyID] = ["id": historyID, "roleId": "finance-accounting", "scenarioId": "explain-the-reason-interview", "expressionId": "explain-the-reason", "mode": "initial", "startedAt": stamp(now.addingTimeInterval(-60)), "completedAt": stamp(now), "modelSeen": true]
        shared["rehearsals"] = rehearsals; state["sharedLearning"] = shared
        _ = try await request("/rest/v1/rpc/lucid_save_state", method: "POST", body: ["expected_revision": existing?["revision"] ?? 0, "new_state": state], token: bobToken)

        let app = XCUIApplication()
        app.launchEnvironment["LUCID_UIQA_SHARED_BACKEND"] = origin
        app.launchEnvironment["LUCID_UIQA_PUBLIC_KEY"] = publicKey
        app.launch(); try signIn(app, email: bobEmail)
        // Daily tap cards intentionally hide the focus term and bookmarking
        // until guidance is revealed; Help is the explicit supported path.
        let help = app.buttons["practice.hint"]; try show(app, help); help.tap()
        let bookmark = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Bookmark ")).firstMatch
        guard bookmark.waitForExistence(timeout: 8) else { throw NSError(domain: "SyntheticSharedUI", code: 3, userInfo: [NSLocalizedDescriptionKey: "Bookmark absent after Help: \(app.debugDescription)"]) }
        try show(app, bookmark); bookmark.tap()
        let next = app.buttons["practice.continue"]; try show(app, next); next.tap()
        let pause = app.buttons["practice.pause"]; try show(app, pause, up: false); pause.tap()
        app.buttons["Open today’s practice"].tap()
        let studio = app.buttons["today.expression-studio"]; try show(app, studio, up: false); studio.tap()
        let draft = app.textViews["studio.gap"]; XCTAssertTrue(draft.waitForExistence(timeout: 10)); try show(app, draft); draft.tap(); draft.typeText(privateDraft)
        if app.buttons["Dismiss keyboard"].exists { app.buttons["Dismiss keyboard"].tap() }
        let notebook = app.buttons["studio.notebook"]; try show(app, notebook); notebook.tap()
        let phrase = app.staticTexts["studio.notebook.\(noteID)"]; XCTAssertTrue(phrase.waitForExistence(timeout: 5)); try show(app, phrase)
        XCTAssertEqual(phrase.label, precise)
        XCTAssertTrue(app.staticTexts["Personal situation stays on its original device."].exists)
        let history = app.buttons["studio.history.\(historyID)"]; try show(app, history, up: false); history.tap()
        XCTAssertTrue(app.staticTexts["Practice checkpoint synced."].waitForExistence(timeout: 8), app.debugDescription)
        XCTAssertTrue(app.staticTexts["Completed on another device. Its private response stays there."].exists)
        app.navigationBars.buttons.firstMatch.tap()

        var saved: [String: Any]?
        for _ in 0..<25 {
            let candidate = try await record(token: bobToken)
            let value = candidate?["state"] as? [String: Any] ?? [:]
            if (value["favouriteWordIds"] as? [String] ?? []).contains(practiceWord) && (value["completedWordIdsToday"] as? [String] ?? []).contains(practiceWord) { saved = candidate; break }
            try await Task.sleep(nanoseconds: 1_000_000_000)
        }
        let confirmed = try XCTUnwrap(saved, "Actual UI bookmark/guided completion did not reach the common backend")
        var remote = confirmed["state"] as! [String: Any]
        let json = String(data: try JSONSerialization.data(withJSONObject: remote), encoding: .utf8)!
        XCTAssertFalse(json.contains(privateDraft), "Private situation entered the shared cloud payload")
        let completed = remote["sharedLearning"] as? [String: Any] ?? [:]
        let checkpoints = completed["lessonCheckpoints"] as? [String: [String: Any]] ?? [:]
        XCTAssertTrue(checkpoints.values.contains { ($0["completedWordIds"] as? [String] ?? []).contains(practiceWord) })
        XCTAssertEqual((remote["contextEvidence"] as? [[String: Any]] ?? []).filter { ($0["kind"] as? String) == "unaidedRecall" && ($0["independent"] as? Bool) == true }.count, 0, "Help manufactured recall credit")

        var peerShared = remote["sharedLearning"] as! [String: Any]
        var peerNotes = peerShared["notebook"] as! [String: Any]
        let peerNow = Date().addingTimeInterval(-1)
        peerNotes[peerNoteID] = ["id": peerNoteID, "roleId": "finance-accounting", "expressionId": "explain-the-reason", "style": "diplomatic", "phrase": diplomatic, "createdAt": stamp(peerNow), "nextReviewOn": day(peerNow.addingTimeInterval(86400))]
        peerShared["notebook"] = peerNotes; remote["sharedLearning"] = peerShared
        _ = try await request("/rest/v1/rpc/lucid_save_state", method: "POST", body: ["expected_revision": confirmed["revision"]!, "new_state": remote], token: bobToken)
        let peerPhrase = app.staticTexts["studio.notebook.\(peerNoteID)"]
        XCTAssertTrue(peerPhrase.waitForExistence(timeout: 45), "Active native polling did not hydrate the peer notebook\n\(app.debugDescription)")
        try show(app, peerPhrase); XCTAssertEqual(peerPhrase.label, diplomatic)
        let screenshot = XCTAttachment(screenshot: app.screenshot()); screenshot.name = "Verified synthetic account shared notebook"; screenshot.lifetime = .keepAlways; add(screenshot)

        app.tabBars.buttons["Settings"].tap()
        let bobIdentity = app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", bobEmail)).firstMatch
        guard bobIdentity.waitForExistence(timeout: 5) else { throw NSError(domain: "SyntheticSharedUI", code: 6, userInfo: [NSLocalizedDescriptionKey: "Bob identity missing from Settings: \(app.debugDescription)"]) }
        let signout = app.buttons["Sign out"]; try show(app, signout); signout.tap()
        let title = app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", "Sign out of Lucid?")).firstMatch
        guard title.waitForExistence(timeout: 5) else { throw NSError(domain: "SyntheticSharedUI", code: 7, userInfo: [NSLocalizedDescriptionKey: "Sign-out confirmation absent: \(app.debugDescription)"]) }
        let confirm = app.sheets.buttons["Sign out"].firstMatch
        if confirm.exists { confirm.tap() } else { app.buttons.matching(NSPredicate(format: "label == %@", "Sign out")).firstMatch.tap() }
        guard app.buttons["Personalise my Lucid"].waitForExistence(timeout: 10) else { throw NSError(domain: "SyntheticSharedUI", code: 8, userInfo: [NSLocalizedDescriptionKey: "Guest scope not restored: \(app.debugDescription)"]) }
        XCTAssertFalse(app.staticTexts[precise].exists, "Account notebook leaked into guest mode")
        try signIn(app, email: aliceEmail)
        if app.tabBars.buttons["Settings"].exists { app.tabBars.buttons["Settings"].tap() }
        let aliceIdentity = app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", aliceEmail)).firstMatch
        XCTAssertTrue(aliceIdentity.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertFalse(app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", bobEmail)).firstMatch.exists, "Previous account identity survived the scope switch")
        XCTAssertFalse(app.staticTexts[privateDraft].exists, "Previous account private draft survived the scope switch")
    }
}
