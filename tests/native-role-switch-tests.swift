import Foundation

enum ReminderScheduler { static func cancel() {} }
struct RoleSwitchFailure: Error, CustomStringConvertible { let description: String }
func roleRequire(_ condition: @autoclosure () -> Bool, _ message: String) throws {
    if !condition() { throw RoleSwitchFailure(description: message) }
}

@MainActor final class RoleSwitchClock {
    var now: Date
    init(_ now: Date) { self.now = now }
}

@main @MainActor struct RoleSwitchTests {
    static var ownedDirectories: [URL] = []

    static func makeStore(catalog: ProfessionalCatalog, now: Date, initial: LearnerData = LearnerData()) throws -> (LearningStore, RoleSwitchClock, LearningPersistence) {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("lucid-role-switch-fixture-\(UUID())", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        ownedDirectories.append(directory)
        let persistence = LearningPersistence(directory: directory)
        // Never migrate or read a real user's UserDefaults or Documents storage.
        try persistence.save(initial, scope: "guest")
        let clock = RoleSwitchClock(now)
        let store = LearningStore(catalog: catalog, persistence: persistence, now: { clock.now }, accountService: nil)
        return (store, clock, persistence)
    }

    static func practise(_ id: String, store: LearningStore) throws {
        let word = store.word(id: id)!
        store.saveDraft("Our team will discuss \(word.term) carefully at tomorrow's meeting.", wordId: id)
        try roleRequire(store.markTodayWord(id, quality: .good), "Fixture could not practise \(word.term)")
    }

    static func requireRole(_ roleId: String, store: LearningStore, count: Int? = nil) throws {
        try roleRequire(store.profile?.roleId == roleId, "Profile failed to change to \(roleId)")
        try roleRequire(!store.todayWords.isEmpty, "\(roleId) unexpectedly has no starter words")
        try roleRequire(store.todayWords.allSatisfy { $0.learningMode == "active" && $0.roles.contains(roleId) },
                        "\(roleId) is showing unrelated or recognition-only words: \(store.todayWords.map(\.term).joined(separator: ", "))")
        if let count { try roleRequire(store.todayWords.count == count, "Expected \(count) words for \(roleId), got \(store.todayWords.count)") }
    }

    static func main() throws {
        let catalog = try JSONDecoder().decode(ProfessionalCatalog.self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
        let today = Calendar.current.date(from: DateComponents(year: 2026, month: 9, day: 14, hour: 12))!
        let finance = catalog.roles.first { $0.id == "finance-accounting" }!
        let technology = catalog.roles.first { $0.id == "technology-engineering" }!
        let level = catalog.seniorityLevels.first!.id
        func profile(_ role: ProfessionalRole) -> LearnerProfile {
            LearnerProfile(roleId: role.id, seniorityId: level, situationIds: [role.situations.first!.id],
                           goalIds: [role.defaultGoalIds.first ?? catalog.goals.first!.id])
        }
        func day(_ offset: Int) -> Date { today.lucidAdding(days: offset).addingTimeInterval(12 * 3600) }
        defer { for directory in ownedDirectories { try? FileManager.default.removeItem(at: directory) } }
        let tests: [(String, () throws -> Void)] = [
            ("every role change immediately shows only words for the selected role", {
                for from in catalog.roles {
                    for to in catalog.roles where from.id != to.id {
                        let (store, _, _) = try makeStore(catalog: catalog, now: today)
                        store.finishOnboarding(profile: profile(from), goal: 3)
                        store.finishOnboarding(profile: profile(to), goal: 3)
                        try requireRole(to.id, store: store, count: 3)
                    }
                }
            }),
            ("role changes preserve earned history, due reviews, drafts, bookmarks, and review attempts", {
                let (store, _, _) = try makeStore(catalog: catalog, now: today)
                store.finishOnboarding(profile: profile(finance), goal: 3)
                let id = store.data.currentWordIds[0]
                try practise(id, store: store)
                store.data.progressByWordId[id]?.nextReviewOn = day(-1)
                store.saveDraft("A private unfinished explanation should remain available.", wordId: store.data.currentWordIds[1])
                store.data.reviewAttempts = ["\(today.lucidDayKey):\(id)": ReviewAttempt(originalAttempt: "An unfinished private recall answer.", independent: false)]
                store.toggleFavourite(id)
                let before = store.data
                let xp = store.totalXP
                store.finishOnboarding(profile: profile(technology), goal: 3)
                try requireRole(technology.id, store: store)
                try roleRequire(store.data.introducedWordIds == before.introducedWordIds, "Changing roles lost introduced words")
                try roleRequire(store.data.progressByWordId == before.progressByWordId, "Changing roles rewrote review schedules or mastery")
                try roleRequire(store.data.activities == before.activities && store.totalXP == xp && store.data.sessions == before.sessions, "Changing roles altered earned activity or XP")
                try roleRequire(store.data.practiceDrafts == before.practiceDrafts && store.data.reviewAttempts == before.reviewAttempts, "Changing roles discarded private drafts or recall attempts")
                try roleRequire(store.data.favouriteWordIds == before.favouriteWordIds && store.data.favouriteChanges == before.favouriteChanges, "Changing roles discarded saved words")
                try roleRequire(store.dueWords.contains { $0.id == id }, "A due review disappeared because its original role was changed")
            }),
            ("same-day return restores the previous role's exact plan and completed work without rerolling", {
                let (store, _, _) = try makeStore(catalog: catalog, now: today)
                store.finishOnboarding(profile: profile(finance), goal: 3)
                let financePlan = store.data.currentWordIds
                try practise(financePlan[0], store: store)
                let xp = store.totalXP
                store.finishOnboarding(profile: profile(technology), goal: 3)
                try requireRole(technology.id, store: store)
                let technologyPlan = store.data.currentWordIds
                try roleRequire(technologyPlan != financePlan, "Fixture requires distinguishable role plans")
                store.finishOnboarding(profile: profile(finance), goal: 3)
                try roleRequire(store.data.currentWordIds == financePlan, "Returning to Finance rerolled or skipped its practised card")
                try roleRequire(store.data.completedWordIdsToday.contains(financePlan[0]), "Returning to Finance forgot its completed card")
                try roleRequire(store.totalXP == xp && !store.markTodayWord(financePlan[0], quality: .good), "Returning to a role duplicated practice credit")
                store.finishOnboarding(profile: profile(technology), goal: 3)
                try roleRequire(store.data.currentWordIds == technologyPlan, "Repeated role switching rerolled the second role")
            }),
            ("each visited role restores its partial completion and prevents duplicate rewards", {
                let (store, _, _) = try makeStore(catalog: catalog, now: today)
                store.finishOnboarding(profile: profile(finance), goal: 3)
                let financeIDs = store.data.currentWordIds
                try practise(financeIDs[0], store: store)
                store.finishOnboarding(profile: profile(technology), goal: 3)
                try requireRole(technology.id, store: store)
                let technologyIDs = store.data.currentWordIds
                try practise(technologyIDs[0], store: store)
                let xp = store.totalXP
                let activityCount = store.activities.count
                for _ in 0..<3 {
                    store.finishOnboarding(profile: profile(finance), goal: 3)
                    try roleRequire(store.data.currentWordIds == financeIDs && store.data.completedWordIdsToday.contains(financeIDs[0]), "Finance progress did not restore")
                    try roleRequire(!store.markTodayWord(financeIDs[0], quality: .strong), "Finance allowed the same card reward twice")
                    store.finishOnboarding(profile: profile(technology), goal: 3)
                    try roleRequire(store.data.currentWordIds == technologyIDs && store.data.completedWordIdsToday.contains(technologyIDs[0]), "Technology progress did not restore")
                    try roleRequire(!store.markTodayWord(technologyIDs[0], quality: .strong), "Technology allowed the same card reward twice")
                }
                try roleRequire(store.totalXP == xp && store.activities.count == activityCount, "Role cycling minted duplicate learning rewards")
            }),
            ("same-role pace and profile edits keep today's original plan and work", {
                let (store, clock, _) = try makeStore(catalog: catalog, now: today)
                store.finishOnboarding(profile: profile(finance), goal: 2)
                let ids = store.data.currentWordIds
                try practise(ids[0], store: store)
                var edited = profile(finance)
                edited.situationIds = finance.situations.map(\.id)
                edited.goalIds = finance.defaultGoalIds
                store.finishOnboarding(profile: edited, name: "Updated learner", goal: 1)
                try roleRequire(store.dailyGoal == 1 && store.data.currentWordIds == ids, "Same-role preference edit rerolled today's two-word plan")
                try roleRequire(store.data.completedWordIdsToday.contains(ids[0]), "Preference edit discarded today's completion")
                clock.now = day(1); store.refreshDay()
                try requireRole(finance.id, store: store, count: 1)
                try roleRequire(!store.data.currentWordIds.contains(ids[0]), "The new day reintroduced an already practised word")
            }),
            ("old-app same-day role/card mismatches are repaired on launch without losing progress", {
                let (legacy, _, _) = try makeStore(catalog: catalog, now: today)
                legacy.finishOnboarding(profile: profile(finance), goal: 3)
                let financeIDs = legacy.data.currentWordIds
                try practise(financeIDs[0], store: legacy)
                var initial = legacy.data
                initial.profile = profile(technology)
                initial.profileUpdatedAt = today.addingTimeInterval(60)
                let beforeXP = legacy.totalXP
                let (store, _, _) = try makeStore(catalog: catalog, now: today.addingTimeInterval(120), initial: initial)
                store.prepareToday()
                try requireRole(technology.id, store: store, count: 3)
                try roleRequire(store.data.progressByWordId == initial.progressByWordId && store.totalXP == beforeXP, "Mismatch repair reset earned progress")
                try roleRequire(store.draft(for: financeIDs[0]) == initial.practiceDrafts?[financeIDs[0]], "Mismatch repair lost the original practice draft")
            }),
            ("valid same-role legacy plans keep their order, completion, and original pace", {
                let words = catalog.words.filter { $0.learningMode == "active" && $0.roles.contains(finance.id) }
                let ids = Array(words.suffix(2).reversed().map(\.id))
                var initial = LearnerData()
                initial.profile = profile(finance); initial.dailyWordGoal = 3
                initial.currentLessonDate = today.lucidStartOfDay; initial.lessonDayKey = nil
                initial.currentWordIds = ids; initial.completedWordIdsToday = [ids[0]]
                initial.introducedWordIds = [ids[0]]
                initial.progressByWordId[ids[0]] = WordProgress(introducedOn: today, nextReviewOn: day(1))
                let (store, _, _) = try makeStore(catalog: catalog, now: today, initial: initial)
                store.prepareToday()
                try roleRequire(store.data.currentWordIds == ids && store.data.completedWordIdsToday == [ids[0]], "Role migration rewrote a valid pre-upgrade daily plan")
                try roleRequire(store.data.lessonDayKey == today.lucidDayKey, "Legacy date-only daily plan did not acquire its day key")
            }),
            ("visited-role plans and partial completion survive app relaunch", {
                let (store, clock, persistence) = try makeStore(catalog: catalog, now: today)
                store.finishOnboarding(profile: profile(finance), goal: 2)
                let financeIDs = store.data.currentWordIds
                try practise(financeIDs[0], store: store)
                store.finishOnboarding(profile: profile(technology), goal: 3)
                try requireRole(technology.id, store: store, count: 3)
                let technologyIDs = store.data.currentWordIds
                try practise(technologyIDs[0], store: store)
                let restored = LearningStore(catalog: catalog, persistence: persistence, now: { clock.now }, accountService: nil)
                restored.prepareToday()
                try roleRequire(restored.data.currentWordIds == technologyIDs && restored.data.completedWordIdsToday.contains(technologyIDs[0]), "Relaunch forgot current-role plan or progress")
                restored.finishOnboarding(profile: profile(finance), goal: 3)
                try roleRequire(restored.data.currentWordIds == financeIDs && restored.data.completedWordIdsToday.contains(financeIDs[0]), "Relaunch forgot the earlier role's original two-card plan")
                try roleRequire(restored.totalXP == store.totalXP, "Reloading and changing roles modified XP")
            }),
            ("additional role plans cannot earn another daily completion bonus", {
                let (store, _, _) = try makeStore(catalog: catalog, now: today)
                store.finishOnboarding(profile: profile(finance), goal: 1)
                let financeID = store.data.currentWordIds[0]
                try practise(financeID, store: store)
                try roleRequire(store.completeToday(), "First role could not complete today's lesson")
                let sessions = store.data.sessions
                let beforeXP = store.totalXP
                store.finishOnboarding(profile: profile(technology), goal: 1)
                try requireRole(technology.id, store: store, count: 1)
                let technologyID = store.data.currentWordIds[0]
                try practise(technologyID, store: store)
                try roleRequire(!store.completeToday(), "Second role awarded another daily lesson bonus")
                try roleRequire(store.data.sessions == sessions && store.isTodayComplete, "Role change erased or duplicated the day's earned completion")
                try roleRequire(store.totalXP == beforeXP + 10, "New role's single practice earned more than its one practice reward")
                store.finishOnboarding(profile: profile(finance), goal: 1)
                try roleRequire(store.data.currentWordIds == [financeID] && !store.markTodayWord(financeID, quality: .good) && !store.completeToday(), "Returning to the completed role minted duplicate rewards")
            }),
            ("same-day sync honors the newer selected role while preserving both devices' completions", {
                let (financeStore, _, _) = try makeStore(catalog: catalog, now: today)
                financeStore.finishOnboarding(profile: profile(finance), goal: 3)
                let financeIDs = financeStore.data.currentWordIds
                try practise(financeIDs[0], store: financeStore)
                let (technologyStore, _, _) = try makeStore(catalog: catalog, now: today.addingTimeInterval(60))
                technologyStore.finishOnboarding(profile: profile(technology), goal: 2)
                let technologyIDs = technologyStore.data.currentWordIds
                try practise(technologyIDs[0], store: technologyStore)
                let snapshots = [
                    LearningMerge.combine(local: financeStore.data, remote: LearningMerge.cloudRecord(technologyStore.data)),
                    LearningMerge.combine(local: technologyStore.data, remote: LearningMerge.cloudRecord(financeStore.data))
                ]
                for snapshot in snapshots {
                    let (restored, _, _) = try makeStore(catalog: catalog, now: today.addingTimeInterval(120), initial: snapshot)
                    restored.prepareToday()
                    try requireRole(technology.id, store: restored, count: 2)
                    try roleRequire(restored.data.currentWordIds == technologyIDs, "Sync did not retain the selected role's existing plan")
                    try roleRequire(Set(restored.data.completedWordIdsToday).isSuperset(of: [financeIDs[0], technologyIDs[0]]), "Same-day role-plan merge dropped one device's card completion")
                    try roleRequire(restored.totalXP == 20, "Merging separate role practice lost or duplicated XP")
                    try roleRequire(!restored.markTodayWord(technologyIDs[0], quality: .good), "Synced role plan let an already-completed card earn again")
                }
            }),
            ("role-plan caches survive local encoding but do not change the cloud schema", {
                let (store, _, _) = try makeStore(catalog: catalog, now: today)
                store.finishOnboarding(profile: profile(finance), goal: 3)
                store.finishOnboarding(profile: profile(technology), goal: 2)
                let local = try JSONSerialization.jsonObject(with: JSONEncoder().encode(store.data)) as! [String: Any]
                try roleRequire(local["lessonRoleId"] as? String == technology.id && local["dailyRolePlans"] != nil, "Local encoding lacks role attribution or visited-role plans")
                let remote = try JSONSerialization.jsonObject(with: JSONEncoder().encode(LearningMerge.cloudRecord(store.data))) as! [String: Any]
                try roleRequire(remote["lessonRoleId"] == nil && remote["dailyRolePlans"] == nil, "Device-local plan cache leaked into the strict cloud schema")
                try roleRequire(remote["schemaVersion"] as? Int == 2, "Local role fix unexpectedly changed the cloud schema version")
            }),
            ("a new calendar day uses the active role and new pace rather than archived daily cards", {
                let (store, clock, _) = try makeStore(catalog: catalog, now: today)
                store.finishOnboarding(profile: profile(finance), goal: 3)
                let financeIDs = store.data.currentWordIds
                try practise(financeIDs[0], store: store)
                store.finishOnboarding(profile: profile(technology), goal: 2)
                try requireRole(technology.id, store: store, count: 2)
                let technologyIDs = store.data.currentWordIds
                try practise(technologyIDs[0], store: store)
                store.finishOnboarding(profile: profile(technology), goal: 1)
                clock.now = day(1); store.refreshDay()
                try requireRole(technology.id, store: store, count: 1)
                try roleRequire(!store.data.currentWordIds.contains(technologyIDs[0]) && store.data.completedWordIdsToday.isEmpty, "Yesterday's Technology completion or card carried into the new day")
                store.finishOnboarding(profile: profile(finance), goal: 1)
                try requireRole(finance.id, store: store, count: 1)
                try roleRequire(!store.data.currentWordIds.contains(financeIDs[0]), "Returning to Finance tomorrow restored yesterday's archive")
            })
        ]
        var failures = 0
        for (name, run) in tests {
            do { try run(); print("PASS: \(name)") }
            catch { failures += 1; print("FAIL: \(name): \(error)") }
        }
        print("\(tests.count - failures)/\(tests.count) role-switch regression groups passed")
        if failures != 0 { exit(1) }
    }
}
