import Foundation

enum ReminderScheduler { static func cancel() {} }
struct CourseFailure: Error, CustomStringConvertible { let description: String }
func expect(_ value: @autoclosure () throws -> Bool, _ message: String) throws {
    if try !value() { throw CourseFailure(description: message) }
}
@MainActor final class CourseClock {
    var now: Date
    init(_ now: Date) { self.now = now }
}

@main @MainActor struct CourseTests {
    static var directories: [URL] = []
    static func main() throws {
        let catalog = try JSONDecoder().decode(ProfessionalCatalog.self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
        let baseline = Calendar.current.date(from: DateComponents(year: 2026, month: 10, day: 4, hour: 12))!
        let finance = catalog.roles.first { $0.id == "finance-accounting" }!
        func profile(_ role: ProfessionalRole) -> LearnerProfile {
            LearnerProfile(roleId: role.id, seniorityId: catalog.seniorityLevels[0].id,
                           situationIds: [role.situations[0].id], goalIds: role.defaultGoalIds)
        }
        func make(_ role: ProfessionalRole = finance, initial: LearnerData? = nil) throws -> (LearningStore, CourseClock) {
            let directory = FileManager.default.temporaryDirectory.appendingPathComponent("lucid-course-tests-\(UUID().uuidString)")
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            directories.append(directory)
            var record = initial ?? LearnerData()
            if record.profile == nil { record.profile = profile(role) }
            let persistence = LearningPersistence(directory: directory)
            try persistence.save(record, scope: "guest")
            let clock = CourseClock(baseline)
            let store = LearningStore(catalog: catalog, persistence: persistence, now: { clock.now }, accountService: nil)
            store.prepareToday()
            return (store, clock)
        }
        func answer(_ store: LearningStore, correct: Set<Int> = Set(0..<6)) throws {
            let path = store.learningPath!
            for (index, question) in store.startingCheckQuestions.enumerated() {
                try expect(store.answerStartingCheck(pathId: path.id, questionId: question.id,
                                                      choice: correct.contains(index) ? question.correctIndex : -1), "Could not answer question \(index)")
            }
        }
        defer { for directory in directories { try? FileManager.default.removeItem(at: directory) } }
        var count = 0
        func test(_ name: String, _ work: () throws -> Void) throws {
            try work(); count += 1; print("PASS \(name)")
        }

        try test("all eight roles have a complete authored course and safe starting check") {
            try expect(catalog.learningPaths?.count == 8, "Expected eight courses")
            for role in catalog.roles {
                let (store, _) = try make(role)
                let path = store.learningPath!
                try expect(path.modules.count == 6 && path.lessons.count == 30 && Set(path.wordIds).count == 90, "Incomplete course: \(role.id)")
                try expect(store.startingCheckQuestions.count == 6, "Invalid check: \(role.id)")
                try expect(store.data.currentWordIds == Array(path.wordIds.prefix(3)), "First plan is not the course opening")
            }
        }
        try test("legacy records decode without course fields") {
            var legacy = LearnerData(); legacy.profile = profile(finance)
            legacy.favouriteWordIds = [catalog.words[0].id]
            let bytes = try JSONEncoder().encode(legacy)
            let decoded = try JSONDecoder().decode(LearnerData.self, from: bytes)
            try expect(decoded.pathPlacements == nil && decoded.courseCheckDrafts == nil, "Optional fields required a migration")
            try expect(decoded.favouriteWordIds == legacy.favouriteWordIds, "Legacy favourite lost")
        }
        try test("submitted answers resume on disk and duplicate taps cannot advance") {
            let (store, clock) = try make()
            let path = store.learningPath!, question = store.startingCheckQuestions[0]
            try expect(!store.answerStartingCheck(pathId: "wrong", questionId: question.id, choice: 0), "Wrong path accepted")
            try expect(!store.answerStartingCheck(pathId: path.id, questionId: question.id, choice: 3), "Invalid option accepted")
            try expect(store.answerStartingCheck(pathId: path.id, questionId: question.id, choice: question.correctIndex), "First answer failed")
            try expect(!store.answerStartingCheck(pathId: path.id, questionId: question.id, choice: question.correctIndex), "Duplicate tap advanced the check")
            let restored = LearningStore(catalog: catalog, persistence: store.persistence, now: { clock.now }, accountService: nil)
            try expect(restored.startingCheckAnswers == [question.correctIndex], "Check did not resume")
            try expect(restored.startingCheckScore == nil && restored.totalXP == 0, "Incomplete check earned a result or XP")
        }
        try test("recognition changes the starting chapter without manufacturing learning") {
            let (store, _) = try make()
            let path = store.learningPath!
            try answer(store)
            try expect(store.suggestedStartingModuleIndex == 4, "Six correct answers did not suggest chapter five")
            try expect(store.applyStartingPoint(pathId: path.id, useSuggested: true), "Could not apply starting point")
            try expect(store.data.currentWordIds == Array(path.modules[4].lessons.flatMap(\.wordIds).prefix(3)), "Untouched cards were not replanned")
            try expect(store.data.introducedWordIds.isEmpty && store.data.progressByWordId.isEmpty && store.activities.isEmpty && store.totalXP == 0 && store.pathProgress == 0, "Placement invented learning")
            try expect(store.nextPathLesson?.id == path.modules[4].lessons[0].id, "Next lesson ignores starting chapter")
        }
        try test("intermediate result requires foundational evidence; not-sure is valid") {
            let (middle, _) = try make()
            try answer(middle, correct: [0, 1, 2, 3])
            try expect(middle.startingCheckScore == 4 && middle.suggestedStartingModuleIndex == 2, "Intermediate suggestion incorrect")
            let (foundation, _) = try make()
            try answer(foundation, correct: [1, 2, 3, 4, 5])
            try expect(foundation.suggestedStartingModuleIndex == 0, "Missing foundations were ignored")
            let (unsure, _) = try make()
            try answer(unsure, correct: [])
            try expect(unsure.startingCheckScore == 0 && unsure.suggestedStartingModuleIndex == 0, "Not-sure was scored as evidence")
        }
        try test("learner can choose foundations instead of the suggestion") {
            let (store, _) = try make()
            let path = store.learningPath!, original = store.data.currentWordIds
            try answer(store)
            try expect(store.applyStartingPoint(pathId: path.id, useSuggested: false), "Foundation choice failed")
            try expect(store.data.currentWordIds == original && store.courseStartingModule?.id == path.modules[0].id, "Foundation choice ignored")
        }
        try test("unfinished daily writing survives placement and next day follows new sequence") {
            let (store, clock) = try make()
            let path = store.learningPath!, original = store.data.currentWordIds
            store.saveDraft("An unfinished thought", wordId: original[0])
            try answer(store)
            try expect(!store.startingCheckCanReplaceToday, "Written work could be discarded")
            try expect(store.applyStartingPoint(pathId: path.id, useSuggested: true), "Placement save failed")
            try expect(store.data.currentWordIds == original && store.draft(for: original[0]) == "An unfinished thought", "Placement discarded written work")
            clock.now = baseline.lucidAdding(days: 1); store.refreshDay()
            try expect(store.data.currentWordIds == Array(path.modules[4].lessons[0].wordIds.prefix(3)), "Next day ignored chosen start")
            try expect(store.draft(for: original[0]) == "An unfinished thought", "Next day lost earlier draft")
        }
        try test("completed practice and daily awards survive a changed starting point") {
            let (store, _) = try make()
            let path = store.learningPath!
            for word in store.todayWords {
                store.saveDraft("Our fictional team will discuss \(word.term) at the next meeting.", wordId: word.id)
                try expect(store.markTodayWord(word.id, quality: .good), "Practice setup failed")
            }
            try expect(store.completeToday(), "Lesson setup failed")
            let before = store.data, xp = store.totalXP
            try answer(store)
            try expect(store.applyStartingPoint(pathId: path.id, useSuggested: true), "Could not apply completed-day preference")
            try expect(store.data.currentWordIds == before.currentWordIds && store.data.progressByWordId == before.progressByWordId && store.totalXP == xp && store.isTodayComplete, "Completed work changed")
        }
        try test("role switches keep check drafts and placements separate") {
            let (store, _) = try make()
            let first = store.learningPath!
            try answer(store)
            try expect(store.applyStartingPoint(pathId: first.id, useSuggested: true), "First placement failed")
            let other = catalog.roles.first { $0.id == "technology-engineering" }!
            try expect(store.finishOnboarding(profile: profile(other)), "Role switch failed")
            try expect(store.startingCheckAnswers.isEmpty && store.courseStartingModule == nil, "Another role inherited Finance placement")
            try expect(!store.applyStartingPoint(pathId: first.id, useSuggested: true), "Stale Finance screen changed another role")
            try expect(store.finishOnboarding(profile: profile(finance)), "Return to Finance failed")
            try expect(store.startingCheckScore == 6 && store.courseStartingModule?.id == first.modules[4].id, "Finance selection lost")
        }
        try test("cloud record syncs placement but not unfinished answers") {
            let (store, _) = try make()
            try answer(store)
            try expect(store.applyStartingPoint(pathId: store.learningPath!.id, useSuggested: true), "Placement failed")
            let remote = LearningMerge.cloudRecord(store.data)
            try expect(remote.courseCheckDrafts == nil && remote.pathPlacements == store.data.pathPlacements, "Cloud disclosure contract incorrect")
            let merged = LearningMerge.combine(local: LearnerData(), remote: remote)
            try expect(merged.pathPlacements == remote.pathPlacements, "Fresh device lost placement")
            let retained = LearningMerge.combine(local: store.data, remote: LearnerData())
            try expect(retained.pathPlacements == store.data.pathPlacements && retained.courseCheckDrafts == store.data.courseCheckDrafts, "Old client cleared new fields")
            let (otherAccount, _) = try make()
            try expect(otherAccount.data.pathPlacements == nil && otherAccount.startingCheckAnswers.isEmpty, "Account data leaked")
        }
        try test("placement merge selects newer choice independently for each role") {
            let path = catalog.learningPaths![0]
            let early = PathPlacement(pathId: path.id, startingModuleId: path.modules[0].id, checkedAt: baseline, correctAnswers: 2, questionCount: 6)
            let later = PathPlacement(pathId: path.id, startingModuleId: path.modules[4].id, checkedAt: baseline.addingTimeInterval(10), correctAnswers: 6, questionCount: 6)
            var left = LearnerData(), right = LearnerData()
            left.pathPlacements = [path.roleId: early]; right.pathPlacements = [path.roleId: later]
            try expect(LearningMerge.combine(local: left, remote: right).pathPlacements?[path.roleId] == later, "Newer remote choice lost")
            try expect(LearningMerge.combine(local: right, remote: left).pathPlacements?[path.roleId] == later, "Older remote choice won")
            let encoded = try JSONEncoder().encode(LearningPersistence.Envelope(version: 2, learner: right))
            let backup = try JSONDecoder().decode(LearningPersistence.Envelope.self, from: encoded)
            try expect(backup.learner.pathPlacements == right.pathPlacements, "Backup lost choice")
        }
        try test("blocked storage and malformed check answers do not apply") {
            let (store, _) = try make()
            let path = store.learningPath!
            store.data.courseCheckDrafts = [path.roleId: CourseCheckDraft(pathId: path.id, answers: [99])]
            try expect(store.startingCheckAnswers.isEmpty && !store.applyStartingPoint(pathId: path.id, useSuggested: true), "Malformed answer produced placement")
            store.restartStartingCheck(pathId: path.id); try answer(store)
            store.storageBlocked = true
            let before = store.data
            try expect(!store.applyStartingPoint(pathId: path.id, useSuggested: true) && store.data == before, "Blocked storage mutated choice")
        }
        try test("earlier chapters remain in the sequence, with no duplicate or missing words") {
            for role in catalog.roles {
                let (store, _) = try make(role)
                let path = store.learningPath!
                try answer(store); try expect(store.applyStartingPoint(pathId: path.id, useSuggested: true), "Could not choose later chapter")
                let ordered = store.orderedModules(in: path, for: store.data).flatMap(\.lessons).flatMap(\.wordIds)
                try expect(ordered.count == 90 && Set(ordered) == Set(path.wordIds), "Starting point dropped course content")
                try expect(Array(ordered.suffix(15)) == path.modules[3].lessons.flatMap(\.wordIds), "Earlier chapters did not return")
            }
        }
        try test("updated questions cannot reinterpret previously submitted answers") {
            let (store, clock) = try make()
            try answer(store)
            let old = store.data
            var updated = catalog
            var path = updated.learningPaths![0]
            var questions = path.startingCheck!
            questions.swapAt(0, 1)
            path.startingCheck = questions
            updated.learningPaths![0] = path
            let restored = LearningStore(catalog: updated, persistence: store.persistence, now: { clock.now }, accountService: nil)
            try expect(restored.startingCheckWasUpdated && restored.startingCheckAnswers.isEmpty && restored.startingCheckScore == nil, "Changed questions reused positional answers")
            try expect(!restored.applyStartingPoint(pathId: path.id, useSuggested: true), "Stale answers applied a new result")
            try expect(restored.data.introducedWordIds == old.introducedWordIds && restored.data.pathPlacements == old.pathPlacements, "Question refresh changed learning history")
        }
        try test("backup restores valid answers over an empty or incompatible local draft") {
            let (store, _) = try make()
            let path = store.learningPath!
            try answer(store)
            let saved = store.data
            let file = store.persistence.directory.appendingPathComponent("course-test-backup.json")
            try JSONEncoder().encode(LearningPersistence.Envelope(version: 2, learner: saved)).write(to: file)
            store.restartStartingCheck(pathId: path.id)
            try store.importBackup(from: file)
            try expect(store.startingCheckScore == 6, "Empty local draft hid a completed backup")
            store.data.courseCheckDrafts = [path.roleId: CourseCheckDraft(pathId: "outdated-course", answers: [1])]
            try store.importBackup(from: file)
            try expect(store.startingCheckScore == 6, "Incompatible local draft hid a valid backup")
        }
        try test("real disk write failure preserves in-memory check answers for retry") {
            let (store, _) = try make()
            let path = store.learningPath!, question = store.startingCheckQuestions[0]
            let directory = store.persistence.directory, held = directory.appendingPathExtension("held")
            directories.append(held)
            try FileManager.default.moveItem(at: directory, to: held)
            try Data("test-only blocker".utf8).write(to: directory)
            try expect(!store.answerStartingCheck(pathId: path.id, questionId: question.id, choice: question.correctIndex), "Failed disk write was reported as saved")
            try expect(store.hasUnsavedChanges && store.startingCheckAnswers.count == 1, "Failed write lost the attempt or hid the warning")
            try FileManager.default.removeItem(at: directory)
            try FileManager.default.moveItem(at: held, to: directory)
            store.retryStorage()
            let persisted = try store.persistence.load(scope: "guest").data
            try expect(!store.hasUnsavedChanges && persisted.courseCheckDrafts == store.data.courseCheckDrafts, "Retry did not save the attempt")
        }
        try test("real disk failure while applying cannot report a saved starting point") {
            let (store, _) = try make()
            try answer(store)
            let path = store.learningPath!, directory = store.persistence.directory
            let held = directory.appendingPathExtension("held"); directories.append(held)
            try FileManager.default.moveItem(at: directory, to: held)
            try Data("test-only blocker".utf8).write(to: directory)
            try expect(!store.applyStartingPoint(pathId: path.id, useSuggested: true) && store.hasUnsavedChanges, "Unsaved placement reported success")
            try expect(store.totalXP == 0 && store.data.introducedWordIds.isEmpty, "Failed placement awarded learning")
            try FileManager.default.removeItem(at: directory)
            try FileManager.default.moveItem(at: held, to: directory)
            store.retryStorage()
            let persisted = try store.persistence.load(scope: "guest").data
            try expect(!store.hasUnsavedChanges && persisted.pathPlacements == store.data.pathPlacements, "Placement retry failed")
        }
        print("\(count) course behavior groups passed")
    }
}
