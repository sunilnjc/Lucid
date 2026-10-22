import XCTest

/// Guest-only UI acceptance. The harness installs this in a fresh disposable
/// simulator under com.sunilnjc.lucid.uiqa, never the owner's shipping app.
final class LucidDailyDiscoveryJourneyTests: XCTestCase {
    @MainActor private func show(_ app: XCUIApplication, _ element: XCUIElement, up: Bool = true) {
        for _ in 0..<12 {
            if element.isHittable { return }
            if up { app.swipeUp() } else { app.swipeDown() }
        }
        XCTAssertTrue(element.isHittable, "Could not reach \(element)\n\(app.debugDescription)")
    }
    @MainActor private func capture(_ app: XCUIApplication, _ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name; attachment.lifetime = .keepAlways; add(attachment)
    }
    @MainActor private func goBack(_ app: XCUIApplication) {
        let back = app.navigationBars.buttons.firstMatch
        XCTAssertTrue(back.waitForExistence(timeout: 5), app.debugDescription); back.tap()
    }
    @MainActor private func openToday(_ app: XCUIApplication) {
        if app.buttons["Open today’s practice"].waitForExistence(timeout: 3) {
            let entry = app.buttons["Open today’s practice"]; show(app, entry); entry.tap()
        } else if app.buttons["See today’s progress"].exists {
            let entry = app.buttons["See today’s progress"]; show(app, entry); entry.tap()
        }
        XCTAssertTrue(app.buttons["today.daily-words"].waitForExistence(timeout: 8), app.debugDescription)
    }
    @MainActor private func enterRecall(_ app: XCUIApplication, identifier: String, text: String) {
        let field = app.textViews[identifier]
        XCTAssertTrue(field.waitForExistence(timeout: 5), app.debugDescription)
        show(app, field); field.tap(); field.typeText(text)
        let done = app.buttons["Dismiss keyboard"]
        if done.exists { done.tap() }
    }

    @MainActor func testDailyDiscoveryAndReturn() throws {
        guard ProcessInfo.processInfo.environment["LUCID_UIQA_RUN_DAILY"] == "1" else { throw XCTSkip("Use the focused LucidDailyJourneyQA scheme with the disposable daily QA simulator.") }
        continueAfterFailure = false
        let app = XCUIApplication(); app.launch()
        let start = app.buttons["Personalise my Lucid"]
        XCTAssertTrue(start.waitForExistence(timeout: 15), "This test needs a fresh disposable QA app")
        start.tap()
        let situation = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Month-end close")).firstMatch
        show(app, situation); situation.tap()
        let goal = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Clarify a complex point")).firstMatch
        show(app, goal); goal.tap()
        app.buttons["onboarding.continue"].tap()
        let wordsEntry = app.buttons["today.daily-words"]
        XCTAssertTrue(wordsEntry.waitForExistence(timeout: 8), app.debugDescription)
        capture(app, "native-daily-today-overview")
        for id in ["today.daily-words", "today.daily-idiom", "today.review", "today.courses"] {
            let entry = app.buttons[id]
            XCTAssertTrue(entry.isHittable, "First-screen entry needs scrolling: \(id)\n\(app.debugDescription)")
            XCTAssertGreaterThanOrEqual(entry.frame.height + 0.01, 44, "Small tap target: \(id)")
        }
        wordsEntry.tap()
        let wordRows = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "daily.word."))
        XCTAssertTrue(app.staticTexts["daily.words-progress"].waitForExistence(timeout: 5), app.debugDescription)
        XCTAssertEqual(wordRows.count, 5)
        let originalIDs = (0..<wordRows.count).map { wordRows.element(boundBy: $0).identifier }
        XCTAssertEqual(Set(originalIDs).count, 5)
        capture(app, "native-daily-five-words")
        let extras = app.buttons["daily.extra-three"]
        show(app, extras); extras.tap()
        XCTAssertEqual(wordRows.count, 8)
        let allIDs = (0..<wordRows.count).map { wordRows.element(boundBy: $0).identifier }
        XCTAssertEqual(Set(allIDs).count, 8)
        XCTAssertEqual(Array(allIDs.prefix(5)), originalIDs, "Unlocking extras replaced the original five")
        let firstWord = app.buttons[originalIDs[0]]
        show(app, firstWord, up: false); firstWord.tap()
        enterRecall(app, identifier: "daily.word-recall", text: "A fictional workplace meaning recalled before guidance.")
        let reveal = app.buttons["daily.word-reveal"]
        show(app, reveal); reveal.tap()
        let addReview = app.buttons["daily.word-add-review"]
        show(app, addReview); addReview.tap()
        XCTAssertTrue(app.buttons["daily.word-add-review"].label.contains("Already in spaced review"), app.debugDescription)
        for _ in 0..<3 { app.swipeDown() }
        capture(app, "native-daily-word-guidance")
        goBack(app)
        XCTAssertEqual(app.staticTexts["daily.words-progress"].label, "1/8 explored")
        goBack(app)
        show(app, app.buttons["today.daily-idiom"], up: false); app.buttons["today.daily-idiom"].tap()
        let idiomOpen = app.buttons["daily.idiom-open"]
        XCTAssertTrue(idiomOpen.waitForExistence(timeout: 5)); idiomOpen.tap()
        enterRecall(app, identifier: "daily.idiom-recall", text: "A fictional plain-English explanation before guidance.")
        let idiomReveal = app.buttons["daily.idiom-reveal"]
        show(app, idiomReveal); idiomReveal.tap()
        let addIdiom = app.buttons["daily.idiom-add-review"]
        show(app, addIdiom); addIdiom.tap()
        XCTAssertTrue(addIdiom.label.contains("Already in idiom review"), app.debugDescription)
        for _ in 0..<3 { app.swipeDown() }
        capture(app, "native-daily-idiom-guidance")
        goBack(app); goBack(app)
        let reviewEntry = app.buttons["today.review"]
        show(app, reviewEntry, up: false); reviewEntry.tap()
        XCTAssertTrue(app.navigationBars["Review"].waitForExistence(timeout: 5), app.debugDescription)
        XCTAssertFalse(app.buttons["review.daily-idioms"].exists, "New idiom was due immediately")
        capture(app, "native-daily-review-next-day")
        app.tabBars.buttons["Today"].tap()
        app.terminate(); app.launch(); openToday(app)
        show(app, app.buttons["today.daily-words"], up: false); app.buttons["today.daily-words"].tap()
        XCTAssertEqual(wordRows.count, 8)
        XCTAssertEqual((0..<wordRows.count).map { wordRows.element(boundBy: $0).identifier }, allIDs)
        XCTAssertEqual(app.staticTexts["daily.words-progress"].label, "1/8 explored")
        show(app, app.buttons[originalIDs[0]], up: false); app.buttons[originalIDs[0]].tap()
        XCTAssertFalse(app.buttons["daily.word-reveal"].exists)
        show(app, addReview)
        XCTAssertTrue(addReview.label.contains("Already in spaced review"))
        XCTAssertTrue(app.staticTexts["A fictional workplace meaning recalled before guidance."].exists)
    }

    @MainActor func testLargeTextDailyNavigation() throws {
        guard ProcessInfo.processInfo.environment["LUCID_UIQA_RUN_DAILY"] == "1" else { throw XCTSkip("Use the focused LucidDailyJourneyQA scheme with the disposable daily QA simulator.") }
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launch(); openToday(app)
        show(app, app.buttons["today.daily-words"], up: false); app.buttons["today.daily-words"].tap()
        let normalRows = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "daily.word."))
        XCTAssertTrue(app.staticTexts["daily.words-progress"].waitForExistence(timeout: 5))
        XCTAssertEqual(normalRows.count, 8)
        capture(app, "native-daily-eight-words")
        let lastWord = normalRows.element(boundBy: 7)
        show(app, lastWord)
        capture(app, "native-daily-optional-three")
        app.terminate()
        app.launchArguments = ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"]
        app.launch(); openToday(app)
        capture(app, "native-daily-large-text-today")
        for id in ["today.daily-words", "today.daily-idiom", "today.review", "today.courses"] {
            let entry = app.buttons[id]
            show(app, entry)
            XCTAssertGreaterThanOrEqual(entry.frame.height + 0.01, 44)
            XCTAssertGreaterThanOrEqual(entry.frame.minX, 0, app.debugDescription)
            XCTAssertLessThanOrEqual(entry.frame.maxX, app.frame.width, app.debugDescription)
        }
        show(app, app.buttons["today.daily-words"], up: false)
        app.buttons["today.daily-words"].tap()
        XCTAssertTrue(app.staticTexts["daily.words-progress"].waitForExistence(timeout: 5))
        capture(app, "native-daily-large-text-words")
        let firstLargeWord = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "daily.word.")).firstMatch
        show(app, firstLargeWord)
        XCTAssertGreaterThanOrEqual(firstLargeWord.frame.minX, 0, app.debugDescription)
        XCTAssertLessThanOrEqual(firstLargeWord.frame.maxX, app.frame.width, app.debugDescription)
        capture(app, "native-daily-large-text-word-row")
    }

    /// The host harness changes only the disposable QA app's synthetic idiom
    /// schedule to a past day after the first journey. No production clock/data changes.
    @MainActor func testDueIdiomReviewEntry() throws {
        guard ProcessInfo.processInfo.environment["LUCID_UIQA_RUN_DAILY_DUE"] == "1" else { throw XCTSkip("Use the LucidDailyDueJourneyQA scheme after the explicit synthetic past-due fixture.") }
        continueAfterFailure = false
        let app = XCUIApplication(); app.launch(); openToday(app)
        let reviewEntry = app.buttons["today.review"]
        show(app, reviewEntry, up: false); reviewEntry.tap()
        let idioms = app.buttons["review.daily-idioms"]
        XCTAssertTrue(idioms.waitForExistence(timeout: 5), app.debugDescription)
        show(app, idioms); capture(app, "native-daily-review-with-idiom")
        idioms.tap()
        let row = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "review.idiom.")).firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 5)); row.tap()
        enterRecall(app, identifier: "daily.idiom-recall", text: "A fresh fictional explanation for this scheduled self-check.")
        let reveal = app.buttons["daily.idiom-reveal"]
        show(app, reveal); reveal.tap()
        let remembered = app.buttons["daily.idiom-remembered"]
        show(app, remembered); XCTAssertTrue(remembered.isEnabled)
        capture(app, "native-daily-idiom-self-check")
        remembered.tap()
        XCTAssertTrue(app.staticTexts["Self-check saved · No mastery or XP awarded"].waitForExistence(timeout: 5))
        goBack(app)
        XCTAssertTrue(app.staticTexts["No idiom reviews due."].waitForExistence(timeout: 5))
    }
}
