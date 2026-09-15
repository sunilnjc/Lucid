import XCTest

final class LucidJourneyTests: XCTestCase {
    @MainActor func testGuestTapPracticeAndResume() throws {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.buttons["Personalise my Lucid"].waitForExistence(timeout: 15))
        app.buttons["Personalise my Lucid"].tap()
        func show(_ element: XCUIElement, up: Bool = true) {
            for _ in 0..<8 where !element.isHittable {
                if up { app.swipeUp() } else { app.swipeDown() }
            }
            XCTAssertTrue(element.isHittable, "Could not reach \(element)")
        }
        let situation = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Month-end close")).firstMatch
        show(situation); situation.tap()
        let goal = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Clarify a complex point")).firstMatch
        show(goal); goal.tap()
        let onboard = app.buttons["onboarding.continue"]
        XCTAssertTrue(onboard.isEnabled); onboard.tap()
        let firstCorrect = app.buttons["practice.choice.finance-reconcile"]
        show(firstCorrect)
        XCTAssertEqual(app.textViews.count, 0, "Writing is mandatory on the daily challenge")
        let wrong = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@ AND identifier != %@", "practice.choice.", "practice.choice.finance-reconcile")).firstMatch
        show(wrong); wrong.tap()
        let feedback = app.descendants(matching: .any)["practice.feedback"]
        XCTAssertTrue(feedback.waitForExistence(timeout: 5), app.debugDescription)
        let pause = app.buttons["practice.pause"]
        show(pause, up: false); pause.tap()
        XCTAssertTrue(app.buttons["Open today’s practice"].waitForExistence(timeout: 5))
        app.terminate(); app.launch()
        app.buttons["Open today’s practice"].tap()
        XCTAssertTrue(feedback.waitForExistence(timeout: 8))
        show(firstCorrect); firstCorrect.tap()
        let next = app.buttons["practice.continue"]
        XCTAssertTrue(next.waitForExistence(timeout: 5)); show(next); next.tap()
        let second = app.buttons["practice.choice.finance-discrepancy"]
        show(second); second.tap()
        show(next); next.tap()
        let mistake = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "practice.choice.mistake:")).firstMatch
        show(mistake); mistake.tap()
        show(next); next.tap()
        XCTAssertTrue(app.staticTexts["You showed up."].waitForExistence(timeout: 8))
        let done = app.buttons["Enjoy the rest of your day"]
        show(done); done.tap()
        let stretch = app.buttons["Try it in my own words"]
        show(stretch); stretch.tap()
        XCTAssertTrue(app.textViews["practice.sentence"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["50 XP"].exists)
        show(app.textViews["practice.sentence"])
        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = "Completed practice with optional stretch"
        screenshot.lifetime = .keepAlways
        add(screenshot)
        show(next, up: false)
        XCTAssertEqual(next.label, "Back to Home")
        next.tap()
        XCTAssertTrue(app.buttons["See today’s progress"].waitForExistence(timeout: 5))
        app.buttons["See today’s progress"].tap()
        let check = app.buttons["course.starting-check"]
        show(check); check.tap()
        let unsure = app.buttons["course.unsure"]
        let checkNext = app.buttons["course.next"]
        show(unsure); unsure.tap(); show(checkNext); checkNext.tap()
        app.buttons["Close"].tap()
        show(check); check.tap()
        XCTAssertTrue(app.staticTexts["QUESTION 2 OF 6"].waitForExistence(timeout: 5))
        for _ in 1..<6 {
            show(unsure); unsure.tap(); show(checkNext); checkNext.tap()
        }
        XCTAssertTrue(app.staticTexts["A starting point, not a label."].waitForExistence(timeout: 5))
        let apply = app.buttons["course.apply"]
        show(apply); apply.tap()
        XCTAssertTrue(app.staticTexts["50 XP"].exists, "Starting check manufactured or lost credit")
        let home = app.buttons["navigation.home"]
        home.tap()
        XCTAssertTrue(app.buttons["See today’s progress"].waitForExistence(timeout: 5))
        let welcome = XCTAttachment(screenshot: app.screenshot())
        welcome.name = "Welcome with new Lucid mark"
        welcome.lifetime = .keepAlways
        add(welcome)
    }
}
