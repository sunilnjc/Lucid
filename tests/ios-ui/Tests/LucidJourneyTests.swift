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
            XCTAssertTrue(element.isHittable, "Could not reach \(element)\n\(app.debugDescription)")
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

        // Exercise the actual new studio UI without injecting dates or learner state.
        app.buttons["See today’s progress"].tap()
        let studio = app.buttons["today.expression-studio"]
        XCTAssertTrue(studio.waitForExistence(timeout: 8), app.debugDescription)
        show(studio, up: false); studio.tap()
        XCTAssertTrue(app.textViews["studio.gap"].waitForExistence(timeout: 8), app.debugDescription)
        XCTAssertTrue(app.staticTexts["Find words for your next conversation."].exists)
        // This authored focus also labels a rehearsal button. The later match is
        // the Nuance navigation link in the following comparison panel.
        let nuanceMatches = app.buttons.matching(NSPredicate(format: "label == %@", "Explain why you chose an approach"))
        XCTAssertTrue(nuanceMatches.firstMatch.waitForExistence(timeout: 5), app.debugDescription)
        XCTAssertGreaterThanOrEqual(nuanceMatches.count, 1)
        let nuance = nuanceMatches.element(boundBy: nuanceMatches.count - 1)
        show(nuance); nuance.tap()
        XCTAssertTrue(app.navigationBars["Nuance"].waitForExistence(timeout: 5), app.debugDescription)
        let fitting = app.buttons["The rationale for the pilot is to learn before committing."]
        XCTAssertTrue(fitting.waitForExistence(timeout: 5), app.debugDescription)
        show(fitting); fitting.tap()
        let distinction = app.staticTexts["This fits the authored distinction. An explanation of a decision is not proof of its outcome."]
        XCTAssertTrue(distinction.waitForExistence(timeout: 5), app.debugDescription)
        show(distinction)
        let nuanceScreenshot = XCTAttachment(screenshot: app.screenshot())
        nuanceScreenshot.name = "Expression studio nuance distinction"
        nuanceScreenshot.lifetime = .keepAlways
        add(nuanceScreenshot)
    }
}
