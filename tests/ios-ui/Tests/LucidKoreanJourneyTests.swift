import XCTest

/// Auth-disabled guest acceptance in a newly created disposable QA simulator.
/// The shipping bundle, owner phone and existing simulator records are excluded.
final class LucidKoreanJourneyTests: XCTestCase {
    @MainActor private func show(_ app: XCUIApplication, _ element: XCUIElement, up: Bool = true) {
        for _ in 0..<14 {
            if element.isHittable { return }
            // Short, position-aware drags avoid overshooting a small menu control.
            let scrollUp = element.exists ? element.frame.midY > app.frame.midY : up
            let start = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: scrollUp ? 0.63 : 0.32))
            let end = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: scrollUp ? 0.32 : 0.63))
            start.press(forDuration: 0.02, thenDragTo: end)
        }
        XCTAssertTrue(element.isHittable, "Could not reach \(element)\n\(app.debugDescription)")
    }
    @MainActor private func capture(_ app: XCUIApplication, _ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name; attachment.lifetime = .keepAlways; add(attachment)
    }
    @MainActor private func back(_ app: XCUIApplication) {
        let button = app.navigationBars.buttons.firstMatch
        XCTAssertTrue(button.waitForExistence(timeout: 5), app.debugDescription); button.tap()
    }
    @MainActor private func language(_ app: XCUIApplication, _ label: String) {
        let picker = app.segmentedControls["learning.language"]
        // Settings uses a virtualized Form: scroll before asking an offscreen cell to exist.
        show(app, picker, up: false)
        XCTAssertTrue(picker.exists, app.debugDescription)
        let choice = picker.buttons[label]
        XCTAssertTrue(choice.isHittable, app.debugDescription); choice.tap()
        XCTAssertTrue(choice.isSelected, "Language choice did not update: \(label)\n\(app.debugDescription)")
    }
    @MainActor private func settings(_ app: XCUIApplication, label: String) {
        let entry = app.tabBars.buttons[label]
        XCTAssertTrue(entry.waitForExistence(timeout: 5), app.debugDescription); entry.tap()
    }
    @MainActor private func openToday(_ app: XCUIApplication) {
        let candidates = ["오늘 학습 열기", "Open today’s practice"]
        for label in candidates {
            let entry = app.buttons[label]
            if entry.waitForExistence(timeout: 2) { show(app, entry); entry.tap(); break }
        }
        XCTAssertTrue(app.buttons["today.daily-words"].waitForExistence(timeout: 8), app.debugDescription)
    }
    @MainActor private func englishPhrase(_ label: String, numbered: Bool = false) -> String {
        let source = numbered ? String(label.dropFirst(3)) : label
        let first = source.components(separatedBy: ",").first ?? source
        return first.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    @MainActor func testKoreanLearningSwitchAndPersistence() throws {
        guard ProcessInfo.processInfo.environment["LUCID_UIQA_RUN_KOREAN"] == "1" else { throw XCTSkip("Use LucidKoreanJourneyQA with a fresh disposable Korean QA simulator.") }
        continueAfterFailure = false
        let app = XCUIApplication(); app.launch()
        XCTAssertTrue(app.buttons["Personalise my Lucid"].waitForExistence(timeout: 15), "A fresh QA bundle is required")
        language(app, "한국어")
        XCTAssertTrue(app.buttons["나에게 맞게 Lucid 설정"].waitForExistence(timeout: 5), app.debugDescription)
        XCTAssertFalse(app.staticTexts["learning.resource-unavailable"].exists)
        capture(app, "native-korean-welcome")
        let start = app.buttons["나에게 맞게 Lucid 설정"]; show(app, start); start.tap()
        let pace = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "코스 학습량")).firstMatch
        show(app, pace); pace.tap()
        let one = app.buttons["단어 1개 · 2분"]
        XCTAssertTrue(one.waitForExistence(timeout: 5), app.debugDescription); one.tap()
        let situation = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "월말 결산")).firstMatch
        show(app, situation); situation.tap()
        let goal = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "복잡한 내용 명확히 설명하기")).firstMatch
        show(app, goal); goal.tap()
        let create = app.buttons["onboarding.continue"]
        XCTAssertTrue(create.isEnabled); create.tap()
        let wordsEntry = app.buttons["today.daily-words"]
        XCTAssertTrue(wordsEntry.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(wordsEntry.label.contains("오늘의 단어"))
        XCTAssertTrue(app.buttons["today.daily-idiom"].label.contains("오늘의 관용 표현"))
        XCTAssertTrue(app.buttons["today.review"].label.contains("복습"))
        capture(app, "native-korean-today-overview")
        for id in ["today.daily-words", "today.daily-idiom", "today.review", "today.courses"] {
            let entry = app.buttons[id]
            XCTAssertTrue(entry.isHittable, "First-screen destination needs scrolling: \(id)")
            XCTAssertGreaterThanOrEqual(entry.frame.height + 0.01, 44)
        }
        wordsEntry.tap()
        let rows = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "daily.word."))
        XCTAssertTrue(app.staticTexts["daily.words-progress"].waitForExistence(timeout: 6))
        XCTAssertEqual(rows.count, 5)
        let firstIDs = (0..<rows.count).map { rows.element(boundBy: $0).identifier }
        let extras = app.buttons["daily.extra-three"]; show(app, extras); extras.tap()
        XCTAssertEqual(rows.count, 8)
        let allIDs = (0..<rows.count).map { rows.element(boundBy: $0).identifier }
        XCTAssertEqual(Array(allIDs.prefix(5)), firstIDs); XCTAssertEqual(Set(allIDs).count, 8)
        let first = app.buttons[firstIDs[0]]; show(app, first, up: false)
        let wordTerm = englishPhrase(first.label, numbered: true)
        XCTAssertTrue(wordTerm.range(of: "[A-Za-z]", options: .regularExpression) != nil)
        first.tap()
        XCTAssertTrue(app.staticTexts[wordTerm].waitForExistence(timeout: 5), "The English word must remain visible: \(wordTerm)\n\(app.debugDescription)")
        XCTAssertFalse(app.staticTexts["한국어 뜻"].exists, "Korean definition appeared before reveal")
        let draft = "A fictional private recall saved before any guidance."
        let editor = app.textViews["daily.word-recall"]
        show(app, editor); editor.tap(); editor.typeText(draft)
        if app.buttons["키보드 닫기"].exists { app.buttons["키보드 닫기"].tap() }
        settings(app, label: "설정")
        language(app, "English")
        let role = app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", "Finance & Accounting")).firstMatch; show(app, role)
        let savedPace = app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", "1 word")).firstMatch; show(app, savedPace)
        XCTAssertTrue(savedPace.exists, "Language switch changed the chosen course pace")
        app.tabBars.buttons["Today"].tap()
        XCTAssertTrue(editor.waitForExistence(timeout: 6), app.debugDescription)
        XCTAssertEqual(editor.value as? String, draft)
        XCTAssertFalse(app.staticTexts["한국어 뜻"].exists)
        XCTAssertTrue(app.buttons["daily.word-reveal"].exists)
        settings(app, label: "Settings"); language(app, "한국어")
        app.tabBars.buttons["오늘"].tap()
        XCTAssertEqual(editor.value as? String, draft)
        app.terminate(); app.launch(); openToday(app)
        app.buttons["today.daily-words"].tap()
        XCTAssertEqual(rows.count, 8)
        XCTAssertEqual((0..<rows.count).map { rows.element(boundBy: $0).identifier }, allIDs)
        let reopened = app.buttons[firstIDs[0]]; show(app, reopened); reopened.tap()
        XCTAssertTrue(editor.waitForExistence(timeout: 5)); XCTAssertEqual(editor.value as? String, draft)
        XCTAssertFalse(app.staticTexts["한국어 뜻"].exists)
        let reveal = app.buttons["daily.word-reveal"]; show(app, reveal); reveal.tap()
        let meaning = app.staticTexts["한국어 뜻"]; show(app, meaning)
        XCTAssertTrue(meaning.exists); XCTAssertTrue(app.staticTexts["한국어 사용 안내"].exists)
        capture(app, "native-korean-word-guidance")
        let englishExample = app.staticTexts["업무 예문"]
        show(app, englishExample)
        XCTAssertTrue(englishExample.exists)
        capture(app, "native-korean-word-example")
        back(app); back(app)
        let idiomEntry = app.buttons["today.daily-idiom"]; show(app, idiomEntry, up: false); idiomEntry.tap()
        let idiomOpen = app.buttons["daily.idiom-open"]
        XCTAssertTrue(idiomOpen.waitForExistence(timeout: 5))
        let idiomPhrase = englishPhrase(idiomOpen.label)
        XCTAssertTrue(idiomPhrase.range(of: "[A-Za-z]", options: .regularExpression) != nil)
        idiomOpen.tap()
        XCTAssertTrue(app.staticTexts[idiomPhrase].waitForExistence(timeout: 5), app.debugDescription)
        XCTAssertFalse(app.descendants(matching: .any).matching(identifier: "learning.korean-idiom").firstMatch.exists)
        let idiomReveal = app.buttons["daily.idiom-reveal"]; show(app, idiomReveal); idiomReveal.tap()
        let koreanIdiom = app.descendants(matching: .any).matching(identifier: "learning.korean-idiom").firstMatch
        show(app, koreanIdiom)
        XCTAssertTrue(koreanIdiom.exists); capture(app, "native-korean-idiom-guidance")
        back(app); back(app)
        app.terminate()
        app.launchArguments = ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"]
        app.launch(); openToday(app)
        capture(app, "native-korean-large-text-today")
        for id in ["today.daily-words", "today.daily-idiom", "today.review", "today.courses"] {
            let entry = app.buttons[id]; show(app, entry)
            XCTAssertGreaterThanOrEqual(entry.frame.height + 0.01, 44)
            XCTAssertGreaterThanOrEqual(entry.frame.minX, 0)
            XCTAssertLessThanOrEqual(entry.frame.maxX, app.frame.width)
        }
        show(app, app.buttons["today.daily-words"], up: false); app.buttons["today.daily-words"].tap()
        XCTAssertEqual(rows.count, 8)
        let largeWord = app.buttons[firstIDs[0]]; show(app, largeWord)
        XCTAssertGreaterThanOrEqual(largeWord.frame.minX, 0)
        XCTAssertLessThanOrEqual(largeWord.frame.maxX, app.frame.width)
        capture(app, "native-korean-large-text-words")
    }
    /// Continues only the nameless synthetic guest checkpoint created by the first
    /// journey. This avoids repeating onboarding while validating the remaining paths.
    @MainActor func testKoreanResumeGuidanceAndLargeText() throws {
        guard ProcessInfo.processInfo.environment["LUCID_UIQA_RUN_KOREAN"] == "1" else { throw XCTSkip("Use the isolated Korean QA scheme after the synthetic checkpoint.") }
        continueAfterFailure = false
        let app = XCUIApplication(); app.launch(); openToday(app)
        settings(app, label: "Settings")
        let role = app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", "Finance & Accounting")).firstMatch
        show(app, role)
        let pace = app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", "1 word")).firstMatch
        show(app, pace); XCTAssertTrue(pace.exists)
        language(app, "한국어")
        app.tabBars.buttons["오늘"].tap()
        let wordsEntry = app.buttons["today.daily-words"]
        XCTAssertTrue(wordsEntry.waitForExistence(timeout: 5), app.debugDescription)
        XCTAssertTrue(wordsEntry.label.contains("오늘의 단어"))
        XCTAssertTrue(app.buttons["today.daily-idiom"].label.contains("오늘의 관용 표현"))
        XCTAssertTrue(app.buttons["today.review"].label.contains("복습"))
        capture(app, "native-korean-today-overview")
        for id in ["today.daily-words", "today.daily-idiom", "today.review", "today.courses"] {
            let entry = app.buttons[id]
            XCTAssertTrue(entry.isHittable, "Normal text first-screen destination needs scrolling: \(id)")
            XCTAssertGreaterThanOrEqual(entry.frame.height + 0.01, 44)
        }
        wordsEntry.tap()
        let rows = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "daily.word."))
        XCTAssertTrue(app.staticTexts["daily.words-progress"].waitForExistence(timeout: 5))
        XCTAssertEqual(rows.count, 8)
        let allIDs = (0..<rows.count).map { rows.element(boundBy: $0).identifier }
        let firstIDs = Array(allIDs.prefix(5)); XCTAssertEqual(Set(allIDs).count, 8)
        let first = app.buttons[firstIDs[0]]; show(app, first)
        let term = englishPhrase(first.label, numbered: true); first.tap()
        XCTAssertTrue(app.staticTexts[term].waitForExistence(timeout: 5))
        let editor = app.textViews["daily.word-recall"]
        XCTAssertTrue(editor.waitForExistence(timeout: 5))
        let draft = "A fictional private recall saved before any guidance."
        XCTAssertEqual(editor.value as? String, draft, "The private draft changed across language switches and relaunch")
        XCTAssertFalse(app.staticTexts["한국어 뜻"].exists)
        app.terminate(); app.launch(); openToday(app)
        app.buttons["today.daily-words"].tap()
        XCTAssertEqual(rows.count, 8)
        XCTAssertEqual((0..<rows.count).map { rows.element(boundBy: $0).identifier }, allIDs)
        let same = app.buttons[firstIDs[0]]; show(app, same); same.tap()
        XCTAssertTrue(editor.waitForExistence(timeout: 5)); XCTAssertEqual(editor.value as? String, draft)
        XCTAssertFalse(app.staticTexts["한국어 뜻"].exists)
        let reveal = app.buttons["daily.word-reveal"]; show(app, reveal); reveal.tap()
        let meaning = app.staticTexts["한국어 뜻"]; show(app, meaning)
        XCTAssertTrue(meaning.exists); XCTAssertTrue(app.staticTexts["한국어 사용 안내"].exists)
        capture(app, "native-korean-word-guidance")
        let englishExample = app.staticTexts["업무 예문"]
        show(app, englishExample)
        XCTAssertTrue(englishExample.exists)
        capture(app, "native-korean-word-example")
        back(app); back(app)
        let idiomEntry = app.buttons["today.daily-idiom"]; show(app, idiomEntry, up: false); idiomEntry.tap()
        let idiomOpen = app.buttons["daily.idiom-open"]
        XCTAssertTrue(idiomOpen.waitForExistence(timeout: 5))
        let idiomPhrase = englishPhrase(idiomOpen.label)
        XCTAssertTrue(idiomPhrase.range(of: "[A-Za-z]", options: .regularExpression) != nil)
        idiomOpen.tap()
        XCTAssertTrue(app.staticTexts[idiomPhrase].waitForExistence(timeout: 5), app.debugDescription)
        XCTAssertFalse(app.descendants(matching: .any).matching(identifier: "learning.korean-idiom").firstMatch.exists)
        let idiomReveal = app.buttons["daily.idiom-reveal"]; show(app, idiomReveal); idiomReveal.tap()
        let koreanIdiom = app.descendants(matching: .any).matching(identifier: "learning.korean-idiom").firstMatch
        show(app, koreanIdiom)
        XCTAssertTrue(koreanIdiom.exists); capture(app, "native-korean-idiom-guidance")
        back(app); back(app)
        app.terminate()
        app.launchArguments = ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"]
        app.launch(); openToday(app)
        capture(app, "native-korean-large-text-today")
        for id in ["today.daily-words", "today.daily-idiom", "today.review", "today.courses"] {
            let entry = app.buttons[id]; show(app, entry)
            XCTAssertGreaterThanOrEqual(entry.frame.height + 0.01, 44)
            XCTAssertGreaterThanOrEqual(entry.frame.minX, 0)
            XCTAssertLessThanOrEqual(entry.frame.maxX, app.frame.width)
        }
        show(app, app.buttons["today.daily-words"], up: false); app.buttons["today.daily-words"].tap()
        XCTAssertEqual(rows.count, 8)
        let largeWord = app.buttons[firstIDs[0]]; show(app, largeWord)
        XCTAssertGreaterThanOrEqual(largeWord.frame.minX, 0)
        XCTAssertLessThanOrEqual(largeWord.frame.maxX, app.frame.width)
        capture(app, "native-korean-large-text-words")
    }
    /// Final read-only guidance/layout acceptance on the previously verified,
    /// revealed synthetic checkpoint. Earlier partial runs retain their own results.
    @MainActor func testKoreanGuidanceAndLargeTextCheckpoint() throws {
        guard ProcessInfo.processInfo.environment["LUCID_UIQA_RUN_KOREAN"] == "1" else { throw XCTSkip("Use the isolated Korean QA scheme with its synthetic revealed checkpoint.") }
        continueAfterFailure = false
        let app = XCUIApplication(); app.launch(); openToday(app)
        let entry = app.buttons["today.daily-words"]
        XCTAssertTrue(entry.label.contains("오늘의 단어")); entry.tap()
        let rows = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "daily.word."))
        XCTAssertTrue(app.staticTexts["daily.words-progress"].waitForExistence(timeout: 5))
        XCTAssertEqual(rows.count, 8)
        let firstID = rows.element(boundBy: 0).identifier
        let first = app.buttons[firstID]; show(app, first)
        let term = englishPhrase(first.label, numbered: true); first.tap()
        XCTAssertTrue(app.staticTexts[term].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["daily.word-reveal"].exists)
        let meaning = app.staticTexts["한국어 뜻"]; show(app, meaning)
        XCTAssertTrue(app.staticTexts["한국어 사용 안내"].exists)
        capture(app, "native-korean-final-word-guidance")
        let original = app.staticTexts["A fictional private recall saved before any guidance."]
        show(app, original); XCTAssertTrue(original.exists)
        back(app); back(app)
        let idiomEntry = app.buttons["today.daily-idiom"]; show(app, idiomEntry, up: false); idiomEntry.tap()
        let idiomOpen = app.buttons["daily.idiom-open"]
        XCTAssertTrue(idiomOpen.waitForExistence(timeout: 5))
        let phrase = englishPhrase(idiomOpen.label); idiomOpen.tap()
        XCTAssertTrue(app.staticTexts[phrase].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["daily.idiom-reveal"].exists)
        let korean = app.descendants(matching: .any).matching(identifier: "learning.korean-idiom").firstMatch
        show(app, korean); XCTAssertTrue(korean.exists)
        capture(app, "native-korean-idiom-guidance")
        back(app); back(app)
        app.terminate()
        app.launchArguments = ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"]
        app.launch(); openToday(app)
        capture(app, "native-korean-large-text-today")
        for id in ["today.daily-words", "today.daily-idiom", "today.review", "today.courses"] {
            let button = app.buttons[id]; show(app, button)
            XCTAssertGreaterThanOrEqual(button.frame.height + 0.01, 44)
            XCTAssertGreaterThanOrEqual(button.frame.minX, 0)
            XCTAssertLessThanOrEqual(button.frame.maxX, app.frame.width)
        }
        show(app, app.buttons["today.daily-words"], up: false); app.buttons["today.daily-words"].tap()
        XCTAssertEqual(rows.count, 8)
        let largeWord = app.buttons[firstID]; show(app, largeWord)
        XCTAssertGreaterThanOrEqual(largeWord.frame.minX, 0)
        XCTAssertLessThanOrEqual(largeWord.frame.maxX, app.frame.width)
        capture(app, "native-korean-large-text-words")
    }

}
