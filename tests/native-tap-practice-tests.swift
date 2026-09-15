import Foundation

// All learning records live in UUID-named temporary fixture directories.
// Notifications, accounts, Keychain and network access are disabled.
enum ReminderScheduler { static func cancel() {} }
struct TapFailure: Error, CustomStringConvertible { let description: String }
func tapExpect(_ value: @autoclosure () throws -> Bool, _ message: String) throws {
    if try !value() { throw TapFailure(description: message) }
}
@MainActor final class TapClock {
    var now: Date
    init(_ now: Date) { self.now = now }
}

@main @MainActor struct TapPracticeTests {
    static var directories: [URL] = []
    static func main() throws {
        let catalog = try JSONDecoder().decode(ProfessionalCatalog.self,
            from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
        let baseline = Calendar.current.date(from: DateComponents(year: 2026, month: 10, day: 4, hour: 12))!
        let finance = catalog.roles.first { $0.id == "finance-accounting" }!
        let technology = catalog.roles.first { $0.id == "technology-engineering" }!
        func profile(_ role: ProfessionalRole) -> LearnerProfile {
            LearnerProfile(roleId: role.id, seniorityId: catalog.seniorityLevels[0].id,
                           situationIds: [role.situations[0].id], goalIds: role.defaultGoalIds)
        }
        func make(_ role: ProfessionalRole = finance, initial: LearnerData? = nil,
                  catalogue: ProfessionalCatalog? = nil) throws -> (LearningStore, TapClock) {
            let directory = FileManager.default.temporaryDirectory
                .appendingPathComponent("lucid-tap-tests-\(UUID().uuidString)", isDirectory: true)
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            directories.append(directory)
            var record = initial ?? LearnerData()
            if record.profile == nil { record.profile = profile(role) }
            let persistence = LearningPersistence(directory: directory)
            try persistence.save(record, scope: "guest")
            let clock = TapClock(baseline)
            let store = LearningStore(catalog: catalogue ?? catalog, persistence: persistence,
                now: { clock.now }, accountService: nil,
                sessionStorage: .init(load: { nil }, save: { _ in }, clear: {}))
            store.prepareToday()
            return (store, clock)
        }
        func reload(_ store: LearningStore, _ clock: TapClock,
                    catalogue: ProfessionalCatalog? = nil) -> LearningStore {
            let restored = LearningStore(catalog: catalogue ?? catalog, persistence: store.persistence,
                now: { clock.now }, accountService: nil,
                sessionStorage: .init(load: { nil }, save: { _ in }, clear: {}))
            restored.prepareToday()
            return restored
        }
        func challenge(_ store: LearningStore, index: Int = 0) throws -> PracticeChallenge {
            guard store.data.currentWordIds.indices.contains(index),
                  let result = store.practiceChallenge(for: store.data.currentWordIds[index]) else {
                throw TapFailure(description: "Fixture has no challenge at index \(index)")
            }
            return result
        }
        func wrong(_ item: PracticeChallenge) -> String {
            item.options.first { $0.id != item.correctId }!.id
        }
        func answerStartingCheck(_ store: LearningStore) throws {
            for question in store.startingCheckQuestions {
                try tapExpect(store.answerStartingCheck(pathId: store.learningPath!.id,
                    questionId: question.id, choice: question.correctIndex), "Starting-check fixture failed")
            }
        }
        func withWriteFailure(_ store: LearningStore, _ work: () throws -> Void) throws {
            let manager = FileManager.default
            let backup = store.persistence.file(for: store.scope).appendingPathExtension("backup")
            let parked = store.persistence.directory.appendingPathComponent("parked-fixture-backup-\(UUID())")
            let hadBackup = manager.fileExists(atPath: backup.path)
            if hadBackup { try manager.moveItem(at: backup, to: parked) }
            try manager.createDirectory(at: backup, withIntermediateDirectories: false)
            defer {
                try? manager.removeItem(at: backup)
                if hadBackup { try? manager.moveItem(at: parked, to: backup) }
            }
            try work()
        }
        func revisedCatalog(for wordId: String) -> ProfessionalCatalog {
            var words = catalog.words
            let index = words.firstIndex { $0.id == wordId }!
            words[index].roleContexts = nil
            words[index].meaning += " Updated course definition for this fixture."
            return ProfessionalCatalog(schemaVersion: catalog.schemaVersion, roles: catalog.roles,
                seniorityLevels: catalog.seniorityLevels, goals: catalog.goals,
                words: words, learningPaths: catalog.learningPaths)
        }
        defer { for directory in directories { try? FileManager.default.removeItem(at: directory) } }
        var passed = 0, failed = 0
        func test(_ name: String, _ work: () throws -> Void) {
            do { try work(); passed += 1; print("PASS \(name)") }
            catch { failed += 1; print("FAIL \(name): \(error)") }
        }

        test("all eight roles and 720 course word positions produce valid deterministic contextual challenges") {
            try tapExpect(catalog.learningPaths?.count == 8, "Expected eight role courses")
            var checked = 0
            var kinds = Set<PracticeChallenge.Kind>()
            var correctPositions = Set<Int>()
            for role in catalog.roles {
                let (store, _) = try make(role)
                let path = store.learningPath!
                try tapExpect(Set(path.wordIds).count == 90, "Expected 90 distinct words for \(role.id)")
                for start in stride(from: 0, to: path.wordIds.count, by: 3) {
                    // Catalogue validation needs no persistence side effects for every word.
                    store.isApplyingRemote = true
                    store.data.currentWordIds = Array(path.wordIds[start..<min(start + 3, path.wordIds.count)])
                    store.isApplyingRemote = false
                    for id in store.data.currentWordIds {
                        guard let item = store.practiceChallenge(for: id) else {
                            throw TapFailure(description: "Missing challenge for \(role.id):\(id)")
                        }
                        let target = store.word(id: id)!
                        try tapExpect(item == store.practiceChallenge(for: id), "Question changed on read: \(id)")
                        try tapExpect(item.roleId == role.id && item.wordId == id && item.dayKey == baseline.lucidDayKey,
                                      "Challenge identity mismatch: \(id)")
                        try tapExpect(item.options.count == 3 && Set(item.options.map(\.id)).count == 3,
                                      "Need three unique option IDs: \(id)")
                        try tapExpect(Set(item.options.map { $0.text.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }).count == 3,
                                      "Duplicate displayed options: \(id)")
                        try tapExpect(item.options.allSatisfy { !$0.text.isEmpty && !$0.explanation.isEmpty }, "Blank option: \(id)")
                        try tapExpect(item.options.filter { $0.id == item.correctId }.count == 1, "Invalid answer key: \(id)")
                        try tapExpect(!item.prompt.isEmpty && !item.context.isEmpty && item.explanation.contains(target.meaning),
                                      "Missing role-contextual meaning/explanation: \(role.id):\(id)")
                        if item.kind == .completeSentence {
                            try tapExpect(item.context.contains("______"), "Sentence has no blank: \(id)")
                        }
                        if item.kind != .spotMistake {
                            try tapExpect(item.options.first { $0.id == item.correctId }?.text == target.term,
                                          "Meaning/sentence key is not the target term: \(id)")
                            for option in item.options {
                                try tapExpect(store.word(id: option.id)?.roles.contains(role.id) == true,
                                              "Distractor belongs to another role: \(id)")
                            }
                        }
                        kinds.insert(item.kind)
                        correctPositions.insert(item.options.firstIndex { $0.id == item.correctId }!)
                        checked += 1
                    }
                }
            }
            try tapExpect(checked == 720 && kinds.count == 3 && correctPositions.count == 3,
                          "Insufficient course/format/answer-position coverage: \(checked), \(kinds), \(correctPositions)")
        }
        test("legacy snapshots decode with tap fields absent") {
            let (store, _) = try make()
            var object = try JSONSerialization.jsonObject(with: JSONEncoder().encode(store.data)) as! [String: Any]
            object.removeValue(forKey: "tapPracticeAttempts"); object.removeValue(forKey: "practiceCursors")
            let decoded = try JSONDecoder().decode(LearnerData.self,
                from: JSONSerialization.data(withJSONObject: object))
            try tapExpect(decoded.tapPracticeAttempts == nil && decoded.practiceCursors == nil,
                          "New fields broke optional decoding")
            try tapExpect(decoded.currentWordIds == store.data.currentWordIds && decoded.profile == store.profile,
                          "Migration changed profile/plan")
        }
        test("one-word daily pace still rotates the course's challenge formats") {
            var initial = LearnerData(); initial.dailyWordGoal = 1
            let (store, clock) = try make(initial: initial)
            var kinds = Set<PracticeChallenge.Kind>()
            for offset in 0..<6 {
                let item = try challenge(store)
                try tapExpect(store.data.currentWordIds.count == 1, "One-word pace grew its plan")
                kinds.insert(item.kind)
                try tapExpect(store.answerPractice(item, choiceId: item.correctId), "Could not finish one-word day")
                clock.now = baseline.lucidAdding(days: offset + 1).addingTimeInterval(12 * 60 * 60)
                store.refreshDay()
            }
            try tapExpect(kinds.count == 3, "One-word pace repeated one format instead of course rotation: \(kinds)")
        }
        test("wrong choice survives relaunch, retry succeeds, duplicate taps cannot mint rewards") {
            let (store, clock) = try make()
            let item = try challenge(store)
            try tapExpect(!store.answerPractice(item, choiceId: "unknown"), "Unknown choice accepted")
            try tapExpect(!store.continuePractice(item), "Unanswered card allowed Continue")
            try tapExpect(store.answerPractice(item, choiceId: wrong(item)), "Wrong choice was not saved")
            try tapExpect(store.tapAttempt(for: item)?.choices == [wrong(item)], "Wrong choice was not recorded")
            try tapExpect(store.data.introducedWordIds.isEmpty && store.data.progressByWordId.isEmpty && store.totalXP == 0,
                          "Wrong choice manufactured learning")
            try tapExpect(!store.answerPractice(item, choiceId: wrong(item)), "Duplicate wrong tap was accepted")
            let restored = reload(store, clock), current = try challenge(reload(store, clock))
            let live = try challenge(restored)
            try tapExpect(live.signature == item.signature && current.signature == item.signature,
                          "Relaunch changed the question identity")
            try tapExpect(restored.tapAttempt(for: live)?.choices == [wrong(item)], "Wrong feedback lost after relaunch")
            try tapExpect(!restored.answerPractice(item, choiceId: item.correctId), "Old instance token survived relaunch")
            try tapExpect(restored.answerPractice(live, choiceId: live.correctId), "Correct retry failed")
            try tapExpect(restored.totalXP == 10 && restored.data.completedWordIdsToday == [item.wordId], "Wrong reward/completion")
            try tapExpect(restored.data.progressByWordId[item.wordId]?.successfulReviewDates.isEmpty == true,
                          "Recognition counted as independent recall")
            try tapExpect(!restored.answerPractice(live, choiceId: live.correctId), "Duplicate correct tap accepted")
            try tapExpect(restored.continuePractice(live) && restored.continuePractice(live), "Completed card cannot continue")
            try tapExpect(restored.totalXP == 10 && restored.activities.count == 1,
                          "Continue duplicated guided credit")
            try tapExpect(try restored.persistence.load(scope: "guest").data == restored.data,
                          "Success was not durable before Continue")
        }
        test("reveal is persisted without credit and only explicit Continue completes guided learning") {
            let (store, clock) = try make()
            let item = try challenge(store)
            try tapExpect(store.revealPractice(item), "Help could not reveal explanation")
            try tapExpect(store.totalXP == 0 && store.data.progressByWordId.isEmpty && store.data.completedWordIdsToday.isEmpty,
                          "Reveal alone awarded credit")
            try tapExpect(!store.revealPractice(item), "Repeated reveal should be a no-op")
            try tapExpect(!store.answerPractice(item, choiceId: item.correctId), "Revealed answer was treated as independent input")
            let restored = reload(store, clock), live = try challenge(reload(store, clock))
            let active = restored.practiceChallenge(for: live.wordId)!
            try tapExpect(restored.tapAttempt(for: active)?.revealed == true, "Reveal did not resume")
            try tapExpect(restored.continuePractice(active), "Guided Continue failed")
            try tapExpect(restored.totalXP == 10 && restored.activities.first?.productive == false,
                          "Help completion lacks conservative guided credit")
            try tapExpect(restored.data.progressByWordId[active.wordId]?.mastered == false,
                          "Help marked mastery")
        }
        test("failed answer save retains memory state, blocks navigation and recovers without duplicate credit") {
            let (store, clock) = try make()
            let item = try challenge(store)
            try withWriteFailure(store) {
                try tapExpect(!store.answerPractice(item, choiceId: item.correctId), "Failed disk write claimed success")
                try tapExpect(store.hasUnsavedChanges && store.storageNotice != nil, "Missing unsaved warning")
                try tapExpect(store.tapAttempt(for: item)?.choices == [item.correctId], "Memory-only answer was discarded")
                try tapExpect(!store.continuePractice(item) && !store.focusPracticeWord(store.data.currentWordIds[1]),
                              "Could navigate away from unsaved work")
                try tapExpect(!store.answerPractice(item, choiceId: item.correctId), "Failed-save retry duplicated answer")
            }
            store.retryStorage()
            try tapExpect(!store.hasUnsavedChanges && store.continuePractice(item), "Storage retry did not unblock saved answer")
            let restored = reload(store, clock)
            try tapExpect(restored.totalXP == 10 && restored.activities.count == 1, "Retry lost or duplicated credit")
            try tapExpect(restored.data.completedWordIdsToday.contains(item.wordId), "Recovered answer missing from disk")
        }
        test("wrong-answer and help write failures retain feedback and require a successful storage retry") {
            for reveal in [false, true] {
                let (store, _) = try make()
                let item = try challenge(store)
                try withWriteFailure(store) {
                    let saved = reveal ? store.revealPractice(item) : store.answerPractice(item, choiceId: wrong(item))
                    try tapExpect(!saved && store.hasUnsavedChanges, "Failed feedback write claimed durable save")
                    try tapExpect(store.tapAttempt(for: item) != nil && store.totalXP == 0,
                                  "Feedback lost or failure awarded credit")
                    try tapExpect(!store.continuePractice(item), "Unsaved reveal allowed completion")
                }
                store.retryStorage()
                try tapExpect(!store.hasUnsavedChanges && store.tapAttempt(for: item) != nil, "Feedback retry failed")
            }
        }
        test("failed guided Continue and lesson saves cannot report success or duplicate recovered awards") {
            var initial = LearnerData(); initial.dailyWordGoal = 1
            let (store, clock) = try make(initial: initial)
            let item = try challenge(store)
            try tapExpect(store.revealPractice(item), "Help fixture failed")
            try withWriteFailure(store) {
                try tapExpect(!store.continuePractice(item) && store.hasUnsavedChanges,
                              "Failed helped-Continue claimed durable completion")
                try tapExpect(store.totalXP == 10 && !store.completeToday(),
                              "Unsaved helped completion was lost or allowed lesson completion")
            }
            store.retryStorage()
            try tapExpect(store.continuePractice(item) && store.totalXP == 10, "Help retry duplicated/lost credit")
            try withWriteFailure(store) {
                try tapExpect(!store.completeToday() && store.hasUnsavedChanges,
                              "Failed lesson write claimed success")
            }
            store.retryStorage()
            let restored = reload(store, clock)
            try tapExpect(restored.totalXP == 30 && restored.data.sessions.count == 1
                && restored.isTodayComplete && !restored.completeToday(), "Lesson retry duplicated/lost the daily bonus")
        }
        test("cursor is durable, role-specific, and cannot generate practice credit") {
            let (store, clock) = try make()
            let financeIDs = store.data.currentWordIds
            try tapExpect(store.focusPracticeWord(financeIDs[2]), "Could not skip/focus third card")
            try tapExpect(store.practiceResumeWordId == financeIDs[2] && store.totalXP == 0,
                          "Cursor did not resume or generated credit")
            let financeChallenge = try challenge(store, index: 2)
            try tapExpect(store.answerPractice(financeChallenge, choiceId: wrong(financeChallenge)), "Could not retain partial Finance attempt")
            let restored = reload(store, clock)
            try tapExpect(restored.practiceResumeWordId == financeIDs[2], "Relaunch reset paused card")
            try tapExpect(restored.finishOnboarding(profile: profile(technology)), "Role switch failed")
            let technologyIDs = restored.data.currentWordIds
            try tapExpect(restored.focusPracticeWord(technologyIDs[1]), "Could not focus Technology card")
            try tapExpect(restored.finishOnboarding(profile: profile(finance)), "Role return failed")
            try tapExpect(restored.data.currentWordIds == financeIDs && restored.practiceResumeWordId == financeIDs[2],
                          "Role round-trip lost Finance plan/cursor")
            let live = try challenge(restored, index: 2)
            try tapExpect(restored.tapAttempt(for: live)?.choices == [wrong(live)], "Role round-trip lost answer feedback")
            try tapExpect(restored.finishOnboarding(profile: profile(technology)) && restored.practiceResumeWordId == technologyIDs[1],
                          "Technology cursor was not retained independently")
            try tapExpect(!restored.focusPracticeWord("not-a-word") && restored.totalXP == 0, "Invalid cursor accepted or navigation rewarded")
        }
        test("wrong answers and paused cursors protect today's plan from starting-point replacement") {
            for useCursor in [false, true] {
                let (store, _) = try make()
                let original = store.data.currentWordIds, item = try challenge(store)
                if useCursor { try tapExpect(store.focusPracticeWord(original[1]), "Cursor save failed") }
                else { try tapExpect(store.answerPractice(item, choiceId: wrong(item)), "Wrong answer save failed") }
                try tapExpect(store.hasTapWorkToday(roleId: finance.id) && !store.startingCheckCanReplaceToday,
                              "Tap progress not protected from course placement")
                try answerStartingCheck(store)
                try tapExpect(store.applyStartingPoint(pathId: store.learningPath!.id, useSuggested: true), "Placement save failed")
                try tapExpect(store.data.currentWordIds == original, "Placement discarded tap-first daily work")
            }
        }
        test("midnight rejects stale cards and expires old tap state without losing drafts or earned history") {
            let (store, clock) = try make()
            let item = try challenge(store), second = try challenge(store, index: 1)
            try tapExpect(store.answerPractice(item, choiceId: item.correctId), "Correct answer setup failed")
            try tapExpect(store.answerPractice(second, choiceId: wrong(second)), "Wrong answer setup failed")
            try tapExpect(store.focusPracticeWord(second.wordId), "Cursor setup failed")
            store.saveDraft("An unfinished fictional workplace sentence", wordId: second.wordId)
            let progress = store.data.progressByWordId, activities = store.activities
            clock.now = baseline.lucidAdding(days: 1).addingTimeInterval(60)
            try tapExpect(!store.answerPractice(second, choiceId: second.correctId)
                && !store.revealPractice(second) && !store.continuePractice(item)
                && !store.focusPracticeWord(second.wordId), "Yesterday's UI accepted an action")
            store.refreshDay()
            try tapExpect(store.data.tapPracticeAttempts?.isEmpty != false && store.data.practiceCursors?.isEmpty != false,
                          "Yesterday's feedback/cursor survived rollover")
            try tapExpect(store.data.progressByWordId == progress && store.activities == activities
                && !store.draft(for: second.wordId).isEmpty && store.data.completedWordIdsToday.isEmpty,
                "Rollover erased history/drafts or retained daily completion")
            try tapExpect(!store.data.currentWordIds.contains(item.wordId), "New day reintroduced a completed word")
        }
        test("stale account, role, and changed challenge content cannot mutate progress") {
            let (store, clock) = try make()
            let item = try challenge(store)
            store.accountGeneration = UUID()
            try tapExpect(!store.answerPractice(item, choiceId: item.correctId) && !store.revealPractice(item)
                && !store.continuePractice(item), "Stale account-generation action accepted")
            let current = try challenge(store)
            try tapExpect(store.finishOnboarding(profile: profile(technology)), "Role fixture failed")
            try tapExpect(!store.answerPractice(current, choiceId: current.correctId), "Stale role action accepted")
            try tapExpect(store.finishOnboarding(profile: profile(finance)), "Role return fixture failed")
            let financeItem = try challenge(store)
            try tapExpect(store.answerPractice(financeItem, choiceId: wrong(financeItem)), "Content fixture answer failed")
            let revised = revisedCatalog(for: financeItem.wordId)
            let updated = reload(store, clock, catalogue: revised)
            let newItem = updated.practiceChallenge(for: financeItem.wordId)!
            try tapExpect(newItem.signature != financeItem.signature && updated.challengeWasUpdated(newItem)
                && updated.tapAttempt(for: newItem) == nil, "Changed content reinterpreted an old positional answer")
            try tapExpect(!updated.answerPractice(financeItem, choiceId: financeItem.correctId), "Old content token accepted")
            try tapExpect(updated.answerPractice(newItem, choiceId: newItem.correctId) && updated.totalXP == 10,
                          "Updated question could not safely restart")
        }
        test("account transition and missing-profile restore gates stop all tap-state writes") {
            let (store, _) = try make()
            let item = try challenge(store)
            for busy in [true, false] {
                store.accountBusy = busy; store.cloudRestorePending = !busy
                if !busy { store.data.profile = nil }
                let before = store.data
                try tapExpect(!store.answerPractice(item, choiceId: item.correctId)
                    && !store.revealPractice(item) && !store.continuePractice(item), "Account gate allowed answer mutation")
                try tapExpect(!store.focusPracticeWord(store.data.currentWordIds[1]), "Account gate allowed cursor mutation")
                try tapExpect(store.data == before, "Account transition changed local tap state")
            }
        }
        test("a returning account with a valid cached profile may practise while cloud restore is offline") {
            let (store, _) = try make()
            let item = try challenge(store)
            store.cloudRestorePending = true
            try tapExpect(store.focusPracticeWord(item.wordId)
                && store.answerPractice(item, choiceId: item.correctId)
                && store.continuePractice(item), "Cloud outage blocked valid cached local practice")
            try tapExpect(store.totalXP == 10 && !store.hasUnsavedChanges, "Offline cached practice was not durably saved")
        }
        test("guided introduction schedules tomorrow but never changes an existing review or mastery record") {
            let (store, _) = try make()
            let first = try challenge(store), second = try challenge(store, index: 1)
            try tapExpect(store.answerPractice(first, choiceId: first.correctId), "Initial guided answer failed")
            let initial = store.data.progressByWordId[first.wordId]!
            try tapExpect(initial.introducedOn == baseline && initial.nextReviewOn == baseline.lucidAdding(days: 1)
                && initial.intervalIndex == 0 && initial.reviewCount == 0 && initial.successfulReviewDates.isEmpty
                && initial.lastReviewedOn == nil && initial.lapses == 0 && !initial.mastered,
                "Guided introduction did not create a conservative first review")
            let existing = WordProgress(introducedOn: baseline.lucidAdding(days: -60), intervalIndex: 4,
                nextReviewOn: baseline.lucidAdding(days: 17), lastReviewedOn: baseline.lucidAdding(days: -13),
                reviewCount: 8, successfulReviewDates: [baseline.lucidAdding(days: -35), baseline.lucidAdding(days: -13)],
                lapses: 2, mastered: true)
            store.data.progressByWordId[second.wordId] = existing
            try tapExpect(store.answerPractice(second, choiceId: second.correctId), "Existing-word guided answer failed")
            try tapExpect(store.data.progressByWordId[second.wordId] == existing, "Tap answer changed existing mastery or review schedule")
            try tapExpect(store.activities.allSatisfy { $0.kind == .practice && !$0.productive }, "Tap generated recall evidence")
        }
        test("shared words and different role plans cannot duplicate word credit or daily completion bonus") {
            let shared = catalog.words.first { $0.learningMode == "active" && $0.roles.count > 1 }!
            let firstRole = catalog.roles.first { $0.id == shared.roles[0] }!
            let secondRole = catalog.roles.first { $0.id == shared.roles[1] }!
            var initial = LearnerData(); initial.profile = profile(firstRole)
            initial.lessonDayKey = baseline.lucidDayKey; initial.currentLessonDate = baseline.lucidStartOfDay
            initial.lessonRoleId = firstRole.id; initial.currentWordIds = [shared.id]
            initial.dailyRolePlans = [firstRole.id: .init(dayKey: baseline.lucidDayKey, wordIds: [shared.id]),
                                     secondRole.id: .init(dayKey: baseline.lucidDayKey, wordIds: [shared.id])]
            let (store, _) = try make(firstRole, initial: initial)
            let item = try challenge(store)
            try tapExpect(store.answerPractice(item, choiceId: item.correctId) && store.completeToday(), "Shared fixture completion failed")
            let progress = store.data.progressByWordId
            try tapExpect(store.finishOnboarding(profile: profile(secondRole)), "Shared role switch failed")
            let next = try challenge(store)
            try tapExpect(store.data.completedWordIdsToday.contains(shared.id) && store.continuePractice(next), "Shared-word credit lost")
            try tapExpect(!store.answerPractice(next, choiceId: next.correctId) && !store.completeToday(), "Shared role minted duplicate credit")
            try tapExpect(store.totalXP == 30 && store.data.sessions.count == 1 && store.data.progressByWordId == progress,
                          "Shared-word switch altered credit/schedule")
        }
        test("bookmark remains independent of answering, hints, cursors and daily credit") {
            let (store, _) = try make()
            let item = try challenge(store)
            store.toggleFavourite(item.wordId)
            try tapExpect(store.isFavourite(item.wordId) && store.totalXP == 0 && store.data.tapPracticeAttempts?.isEmpty != false,
                          "Bookmark awarded practice or recorded an answer")
            try tapExpect(store.answerPractice(item, choiceId: item.correctId), "Bookmarked answer failed")
            store.toggleFavourite(item.wordId)
            try tapExpect(!store.isFavourite(item.wordId) && store.totalXP == 10
                && store.data.completedWordIdsToday.contains(item.wordId), "Unbookmark changed practice completion")
        }
        test("cloud projection strips private attempts/cursors and ordinary merge preserves the current device") {
            let (store, _) = try make()
            let item = try challenge(store)
            try tapExpect(store.answerPractice(item, choiceId: wrong(item)) && store.focusPracticeWord(item.wordId), "Cloud fixture failed")
            let cloud = LearningMerge.cloudRecord(store.data)
            let json = try JSONSerialization.jsonObject(with: JSONEncoder().encode(cloud)) as! [String: Any]
            try tapExpect(json["tapPracticeAttempts"] == nil && json["practiceCursors"] == nil
                && json["schemaVersion"] as? Int == 2, "Private state leaked into strict cloud schema")
            var remote = store.data
            remote.tapPracticeAttempts = [item.key: .init(signature: "remote-only", choices: [], revealed: true)]
            remote.practiceCursors = [finance.id: .init(dayKey: baseline.lucidDayKey, wordId: store.data.currentWordIds[2])]
            let merged = LearningMerge.combine(local: store.data, remote: remote)
            try tapExpect(merged.tapPracticeAttempts == store.data.tapPracticeAttempts
                && merged.practiceCursors == store.data.practiceCursors, "Ordinary sync overwrote device-local tap state")
        }
        test("backup round trip restores answers/cursor and preserves nonempty local work on conflicts") {
            let (source, _) = try make()
            let item = try challenge(source, index: 1)
            try tapExpect(source.answerPractice(item, choiceId: wrong(item)) && source.focusPracticeWord(item.wordId), "Backup fixture failed")
            let (target, clock) = try make()
            let backup = target.persistence.directory.appendingPathComponent("fixture-import.json")
            try JSONEncoder().encode(LearningPersistence.Envelope(version: 2, learner: source.data)).write(to: backup)
            try target.importBackup(from: backup)
            let live = target.practiceChallenge(for: item.wordId)!
            try tapExpect(target.tapAttempt(for: live)?.choices == [wrong(item)] && target.practiceResumeWordId == item.wordId,
                          "Backup lost answer feedback/cursor")
            let restored = reload(target, clock)
            try tapExpect(restored.data.tapPracticeAttempts == target.data.tapPracticeAttempts
                && restored.data.practiceCursors == target.data.practiceCursors, "Imported state not durable")
            let otherWrong = live.options.first { $0.id != live.correctId && $0.id != wrong(live) }!.id
            try tapExpect(target.answerPractice(live, choiceId: otherWrong), "Local conflict setup failed")
            let localChoices = target.tapAttempt(for: live)?.choices
            try target.importBackup(from: backup)
            try tapExpect(target.tapAttempt(for: live)?.choices == localChoices, "Backup overwrote newer nonempty local choices")
            try tapExpect(target.totalXP == 0, "Importing wrong answers manufactured practice credit")
        }
        test("valid backup feedback replaces incompatible local challenge signature after a catalogue update") {
            let (source, _) = try make()
            let item = try challenge(source)
            try tapExpect(source.answerPractice(item, choiceId: wrong(item)), "Valid backup fixture failed")
            var local = source.data
            local.tapPracticeAttempts = [item.key: .init(signature: "obsolete-catalogue-signature", choices: [wrong(item)])]
            let (target, _) = try make(initial: local)
            let live = try challenge(target)
            try tapExpect(target.challengeWasUpdated(live), "Obsolete local fixture was not detected")
            let backup = target.persistence.directory.appendingPathComponent("valid-current-content-import.json")
            try JSONEncoder().encode(LearningPersistence.Envelope(version: 2, learner: source.data)).write(to: backup)
            try target.importBackup(from: backup)
            try tapExpect(target.tapAttempt(for: live)?.choices == [wrong(item)],
                          "Valid backup attempt was discarded in favor of unusable local signature")
        }
        test("malformed stored option IDs are invalidated and cannot be used to complete a challenge") {
            let (store, _) = try make()
            let item = try challenge(store)
            store.data.tapPracticeAttempts = [item.key: .init(signature: item.signature, choices: ["removed-option"], revealed: true)]
            try tapExpect(store.tapAttempt(for: item) == nil && store.challengeWasUpdated(item), "Invalid option ID treated as current feedback")
            try tapExpect(!store.continuePractice(item) && store.totalXP == 0, "Malformed revealed attempt completed practice")
            try tapExpect(store.answerPractice(item, choiceId: item.correctId), "Invalid feedback could not safely restart")
        }
        test("backup signature recovery also preserves feedback in inactive same-day role plans") {
            let (source, _) = try make()
            let item = try challenge(source)
            try tapExpect(source.answerPractice(item, choiceId: wrong(item)), "Inactive-role backup fixture failed")
            try tapExpect(source.finishOnboarding(profile: profile(technology)), "Inactive-role switch fixture failed")
            var local = source.data
            local.tapPracticeAttempts = [item.key: .init(signature: "obsolete-finance-signature", choices: [wrong(item)])]
            let (target, _) = try make(technology, initial: local)
            let backup = target.persistence.directory.appendingPathComponent("inactive-role-feedback-import.json")
            try JSONEncoder().encode(LearningPersistence.Envelope(version: 2, learner: source.data)).write(to: backup)
            let activeIDs = target.data.currentWordIds
            try target.importBackup(from: backup)
            try tapExpect(target.profile?.roleId == technology.id && target.data.currentWordIds == activeIDs,
                          "Backup repair switched the active role/plan")
            try tapExpect(target.finishOnboarding(profile: profile(finance)), "Could not return to inactive role")
            let live = target.practiceChallenge(for: item.wordId)!
            try tapExpect(target.tapAttempt(for: live)?.choices == [wrong(item)],
                          "Valid backup feedback was not recovered for an inactive cached role")
        }
        print("\(passed)/\(passed + failed) tap-first regression groups passed")
        if failed > 0 { exit(1) }
    }
}
