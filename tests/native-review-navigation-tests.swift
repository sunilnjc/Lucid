import Foundation

enum ReminderScheduler { static func cancel() {} }
struct ReviewNavigationFailure: Error, CustomStringConvertible { let description: String }
func reviewCheck(_ condition: @autoclosure () throws -> Bool, _ message: String) throws {
    if try !condition() { throw ReviewNavigationFailure(description: message) }
}
@MainActor final class ReviewNavigationClock {
    var now: Date
    init(_ now: Date) { self.now = now }
}

@main @MainActor struct ReviewNavigationTests {
    static var directories: [URL] = []
    static func makeStore(_ catalog: ProfessionalCatalog, _ now: Date, _ initial: LearnerData = LearnerData()) throws -> (LearningStore, ReviewNavigationClock, LearningPersistence) {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("lucid-review-navigation-fixture-\(UUID())", isDirectory: true)
        directories.append(directory)
        let persistence = LearningPersistence(directory: directory)
        // Prevent legacy migration from touching actual learner defaults.
        try persistence.save(initial, scope: "guest")
        let clock = ReviewNavigationClock(now)
        return (LearningStore(catalog: catalog, persistence: persistence, now: { clock.now }, accountService: nil), clock, persistence)
    }
    static func main() throws {
        let catalog = try JSONDecoder().decode(ProfessionalCatalog.self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
        let today = Calendar.current.date(from: DateComponents(year: 2026, month: 9, day: 15, hour: 12))!
        let finance = catalog.roles.first { $0.id == "finance-accounting" }!
        let technology = catalog.roles.first { $0.id == "technology-engineering" }!
        func profile(_ role: ProfessionalRole) -> LearnerProfile {
            .init(roleId: role.id, seniorityId: catalog.seniorityLevels[0].id, situationIds: [role.situations[0].id], goalIds: [role.defaultGoalIds.first ?? catalog.goals[0].id])
        }
        func date(_ offset: Int) -> Date { today.lucidAdding(days: offset).addingTimeInterval(12 * 3600) }
        func dueSnapshot(_ words: [ProfessionalWord], role: ProfessionalRole? = nil) -> LearnerData {
            var data = LearnerData(); data.profile = role.map(profile)
            data.introducedWordIds = words.map(\.id)
            for (index, word) in words.enumerated() {
                data.progressByWordId[word.id] = WordProgress(introducedOn: date(-20), nextReviewOn: date(-(index % 3)))
            }
            return data
        }
        let active = catalog.words.filter { $0.learningMode == "active" }
        let financeOnly = active.first { $0.roles.contains(finance.id) && !$0.roles.contains(technology.id) }!
        let technologyOnly = active.first { $0.roles.contains(technology.id) && !$0.roles.contains(finance.id) }!
        defer { for directory in directories { try? FileManager.default.removeItem(at: directory) } }
        let tests: [(String, () throws -> Void)] = [
            ("shared-word explanations follow the selected role without changing identity or base content", {
                let mappings = [("finance-material", "consulting-strategy"), ("finance-substantiate", "consulting-strategy"), ("finance-variance", "operations-supply-chain"), ("finance-run-rate", "sales-business-development"), ("healthcare-triage", "technology-engineering"), ("healthcare-triage", "operations-supply-chain")]
                for (id, roleId) in mappings {
                    let base = catalog.words.first { $0.id == id }!
                    let role = catalog.roles.first { $0.id == roleId }!
                    let (store, _, _) = try makeStore(catalog, today, dueSnapshot([base], role: role))
                    guard let context = base.roleContexts?[roleId], let contextual = store.word(id: id) else {
                        throw ReviewNavigationFailure(description: "Missing role context for \(id) / \(roleId)")
                    }
                    try reviewCheck(contextual.meaning == context.meaning && contextual.example == context.example && contextual.mission == context.mission, "Role-specific explanation was not applied consistently")
                    try reviewCheck(contextual.collocations == context.collocations && contextual.whenToUse == context.whenToUse && contextual.avoidOrMisuse == context.avoidOrMisuse, "Practice checks still use the base role's guidance")
                    try reviewCheck(store.currentRoleDueWords.first?.meaning == context.meaning, "Review still displays the base financial/clinical explanation")
                    try reviewCheck(contextual.id == base.id && contextual.term == base.term && contextual.roles == base.roles, "Context changed the shared word's learning identity")
                    try reviewCheck(store.catalog.words.first { $0.id == id } == base, "Contextual lookup mutated the canonical catalogue")
                    try reviewCheck(base.contextualized(for: base.roles.first).meaning == base.meaning, "Original Finance/Healthcare explanation was overwritten")
                }
            }),
            ("all-role review remains revealable and saveable while another role is selected", {
                let (store, _, _) = try makeStore(catalog, today, dueSnapshot([financeOnly], role: technology))
                store.reviewIncludesOtherRoles = true
                try reviewCheck(store.visibleReviewWords.map(\.id) == [financeOnly.id], "Other-role opt-in failed")
                store.revealReview(wordId: financeOnly.id, usingHint: true)
                try reviewCheck(store.reviewAttempt(for: financeOnly.id) != nil, "Current-role filtering blocked another role's reveal")
                try reviewCheck(store.review(wordId: financeOnly.id, quality: .again, productive: false), "Other-role review could not be saved")
                try reviewCheck(store.visibleReviewWords.isEmpty && store.dueWords.isEmpty, "Saved other-role review repeated")
            }),
            ("all 56 role switches immediately show the selected role's review queue", {
                for from in catalog.roles {
                    for to in catalog.roles where from.id != to.id {
                        let (store, _, _) = try makeStore(catalog, today, dueSnapshot(active, role: from))
                        store.prepareToday()
                        store.finishOnboarding(profile: profile(to))
                        let expected = store.dueWords.filter { $0.roles.contains(to.id) }.map(\.id)
                        try reviewCheck(!expected.isEmpty, "Fixture has no reviews for \(to.id)")
                        try reviewCheck(store.currentRoleDueWords.map(\.id) == expected, "\(from.id) → \(to.id) kept another role's default reviews")
                        try reviewCheck(store.reviewWords(includeOtherRoles: false).map(\.id) == expected, "Default Review queue ignored the selected role")
                    }
                }
            }),
            ("current-role and other-role queues partition global reviews without duplicates", {
                let (store, _, _) = try makeStore(catalog, today, dueSnapshot(active, role: technology))
                store.prepareToday()
                let current = store.currentRoleDueWords.map(\.id)
                let other = store.otherRoleDueWords.map(\.id)
                let global = store.dueWords.map(\.id)
                try reviewCheck(Set(current).isDisjoint(with: Set(other)), "A shared word appeared in both review sections")
                try reviewCheck(Set(current + other) == Set(global) && current.count + other.count == global.count, "Queue filtering lost or duplicated scheduled reviews")
                try reviewCheck(store.reviewWords(includeOtherRoles: true).map(\.id) == global, "Opting into other roles changed the global schedule order or omitted words")
                try reviewCheck(store.otherRoleDueWords.allSatisfy { !$0.roles.contains(technology.id) }, "Other-role section includes a word relevant to the active role")
            }),
            ("shared vocabulary is eligible in each tagged role but never repeated within one queue", {
                let shared = active.first { $0.roles.count > 1 }!
                let tagged = catalog.roles.filter { shared.roles.contains($0.id) }
                let (store, _, _) = try makeStore(catalog, today, dueSnapshot([shared], role: tagged[0]))
                for role in tagged {
                    store.finishOnboarding(profile: profile(role))
                    try reviewCheck(store.currentRoleDueWords.map(\.id) == [shared.id], "Shared vocabulary was hidden for \(role.id)")
                    try reviewCheck(store.otherRoleDueWords.isEmpty && store.reviewWords(includeOtherRoles: true).count == 1, "Shared vocabulary was duplicated as an other-role review")
                }
            }),
            ("a newly selected role with no due words stays empty and keeps old-role reviews opt-in", {
                var initial = dueSnapshot([financeOnly], role: finance)
                initial.progressByWordId[technologyOnly.id] = WordProgress(introducedOn: date(-1), nextReviewOn: date(3))
                let (store, _, _) = try makeStore(catalog, today, initial)
                store.finishOnboarding(profile: profile(technology))
                try reviewCheck(store.currentRoleDueWords.isEmpty && store.reviewWords(includeOtherRoles: false).isEmpty, "New Technology role fell back to Finance reviews")
                try reviewCheck(store.otherRoleDueWords.map(\.id) == [financeOnly.id], "Old Finance review was removed instead of available separately")
                try reviewCheck(store.nextReviewDateForCurrentRole == date(3), "Technology empty state describes another role's review date")
                try reviewCheck(store.dueWords.map(\.id) == [financeOnly.id], "Role change erased globally due Finance progress")
            }),
            ("an unconfigured learner has no implied role-specific review queue or date", {
                let (store, _, _) = try makeStore(catalog, today, dueSnapshot([financeOnly]))
                try reviewCheck(store.currentRoleDueWords.isEmpty && store.reviewWords(includeOtherRoles: false).isEmpty, "Missing profile silently assumed the first catalogue role")
                try reviewCheck(store.nextReviewDateForCurrentRole == nil, "Missing profile reported a role-specific next-review date")
                try reviewCheck(store.reviewWords(includeOtherRoles: true).map(\.id) == [financeOnly.id], "Opt-in global history became inaccessible without a profile")
            }),
            ("filtering review queues never mutates schedules, drafts, history, rewards, or persistence revision", {
                var initial = dueSnapshot([financeOnly, technologyOnly], role: technology)
                initial.practiceDrafts = [financeOnly.id: "Private Finance sentence", "recall:\(today.lucidDayKey):\(technologyOnly.id)": "Private recall draft"]
                initial.reviewAttempts = ["\(today.lucidDayKey):\(financeOnly.id)": .init(originalAttempt: "Keep this hint evidence", independent: false)]
                initial.activities = [.init(id: UUID(), kind: .practice, wordId: financeOnly.id, date: date(-2), dayKey: date(-2).lucidDayKey, quality: 2, productive: false)]
                let (store, _, persistence) = try makeStore(catalog, today, initial)
                store.prepareToday()
                let before = store.data; let revision = store.dataRevision; let xp = store.totalXP
                for _ in 0..<100 {
                    _ = store.currentRoleDueWords; _ = store.otherRoleDueWords
                    _ = store.reviewWords(includeOtherRoles: false); _ = store.reviewWords(includeOtherRoles: true)
                    _ = store.nextReviewDateForCurrentRole
                }
                try reviewCheck(store.data == before && store.totalXP == xp && store.dataRevision == revision, "Read-only review filters mutated learner state")
                try reviewCheck(try persistence.load(scope: "guest").data == before, "Filtering rewrote the durable learner record")
            }),
            ("saving a role-specific review removes it from both queues without changing other-role schedules", {
                let (store, _, _) = try makeStore(catalog, today, dueSnapshot([financeOnly, technologyOnly], role: technology))
                store.prepareToday()
                let untouched = store.data.progressByWordId[financeOnly.id]
                store.data.practiceDrafts = ["recall:\(today.lucidDayKey):\(technologyOnly.id)": "Our team will discuss \(technologyOnly.term) at tomorrow's meeting."]
                store.revealReview(wordId: technologyOnly.id, usingHint: false)
                try reviewCheck(store.review(wordId: technologyOnly.id, quality: .good, productive: true), "Could not save the current role's review")
                try reviewCheck(store.currentRoleDueWords.isEmpty && !store.reviewWords(includeOtherRoles: true).contains { $0.id == technologyOnly.id }, "Completed review stayed in a queue")
                try reviewCheck(store.otherRoleDueWords.map(\.id) == [financeOnly.id] && store.data.progressByWordId[financeOnly.id] == untouched, "Completing Technology changed or hid Finance's due review")
                try reviewCheck(!store.review(wordId: technologyOnly.id, quality: .good, productive: true), "Saved review could earn a duplicate same-day reward")
            }),
            ("a stale due date cannot show a stuck card when today's review activity already exists", {
                var initial = dueSnapshot([technologyOnly], role: technology)
                initial.activities = [.init(id: UUID(), kind: .review, wordId: technologyOnly.id, date: today.addingTimeInterval(-60), dayKey: today.lucidDayKey, quality: 0, productive: false)]
                let (store, _, _) = try makeStore(catalog, today, initial)
                let before = store.data
                try reviewCheck(store.dueWords.isEmpty && store.currentRoleDueWords.isEmpty && store.reviewWords(includeOtherRoles: true).isEmpty, "Already-reviewed activity remained as an unfinishable due card")
                store.revealReview(wordId: technologyOnly.id, usingHint: true)
                try reviewCheck(!store.review(wordId: technologyOnly.id, quality: .again, productive: false), "Stale schedule allowed the same review event twice")
                try reviewCheck(store.data == before, "Suppressed review still changed hint state or history")
            }),
            ("legacy lastReviewedOn today suppresses stale due cards and duplicate mutations without an activity event", {
                var initial = dueSnapshot([technologyOnly], role: technology)
                initial.progressByWordId[technologyOnly.id]?.lastReviewedOn = today.addingTimeInterval(-60)
                let (store, _, _) = try makeStore(catalog, today, initial)
                let before = store.data
                try reviewCheck(store.dueWords.isEmpty && store.currentRoleDueWords.isEmpty, "Legacy already-reviewed word appeared as an unfinishable card")
                store.revealReview(wordId: technologyOnly.id, usingHint: true)
                try reviewCheck(!store.review(wordId: technologyOnly.id, quality: .again, productive: false), "Legacy review date allowed a second same-day review")
                try reviewCheck(store.data == before, "Legacy duplicate guard mutated the record")
            }),
            ("previous-day review activity does not suppress a review that is due again today", {
                var initial = dueSnapshot([technologyOnly], role: technology)
                initial.progressByWordId[technologyOnly.id]?.lastReviewedOn = date(-1)
                initial.activities = [.init(id: UUID(), kind: .review, wordId: technologyOnly.id, date: date(-1), dayKey: date(-1).lucidDayKey, quality: 0, productive: false)]
                let (store, _, _) = try makeStore(catalog, today, initial)
                try reviewCheck(store.currentRoleDueWords.map(\.id) == [technologyOnly.id], "Yesterday's lapse hid today's scheduled retry")
                store.revealReview(wordId: technologyOnly.id, usingHint: true)
                try reviewCheck(store.review(wordId: technologyOnly.id, quality: .again, productive: false), "Yesterday's review blocked today's legitimate attempt")
            }),
            ("next-review messaging selects the earliest known word for the current role only", {
                let technologyWords = active.filter { $0.roles.contains(technology.id) }
                var initial = LearnerData(); initial.profile = profile(technology)
                initial.progressByWordId[technologyWords[0].id] = WordProgress(introducedOn: date(-2), nextReviewOn: date(7))
                initial.progressByWordId[technologyWords[1].id] = WordProgress(introducedOn: date(-2), nextReviewOn: date(3))
                initial.progressByWordId[financeOnly.id] = WordProgress(introducedOn: date(-2), nextReviewOn: date(1))
                initial.progressByWordId["removed-catalogue-word"] = WordProgress(introducedOn: date(-2), nextReviewOn: date(0))
                let (store, _, _) = try makeStore(catalog, today, initial)
                try reviewCheck(store.nextReviewDateForCurrentRole == date(3), "Other-role or removed-catalogue progress polluted the selected role's next review")
                store.finishOnboarding(profile: profile(finance))
                let expected = store.data.progressByWordId.filter { id, _ in store.word(id: id)?.roles.contains(finance.id) == true }.values.map(\.nextReviewOn).min()
                try reviewCheck(store.nextReviewDateForCurrentRole == expected, "Next-review message stayed on the previous role after changing roles")
            }),
            ("opening Review or switching roles resets the other-role opt-in and visible queue", {
                let (store, _, _) = try makeStore(catalog, today, dueSnapshot([financeOnly, technologyOnly], role: finance))
                store.prepareToday()
                store.reviewIncludesOtherRoles = true
                try reviewCheck(store.visibleReviewWords.count == 2, "Explicit all-role opt-in did not show both due words")
                store.openReview()
                try reviewCheck(store.hasEnteredLucid && store.selectedTab == 1 && !store.reviewIncludesOtherRoles, "Opening Review did not restore current-role default navigation")
                try reviewCheck(store.visibleReviewWords.map(\.id) == [financeOnly.id], "Review opened on stale all-role cards")
                store.reviewIncludesOtherRoles = true
                store.finishOnboarding(profile: profile(technology))
                try reviewCheck(!store.reviewIncludesOtherRoles && store.visibleReviewWords.map(\.id) == [technologyOnly.id], "Changing roles kept the previously opted-in Finance queue visible")
                store.reviewIncludesOtherRoles = true
                // Remote application replaces data through the same published setter.
                store.data.profile = profile(finance)
                try reviewCheck(!store.reviewIncludesOtherRoles && store.visibleReviewWords.map(\.id) == [financeOnly.id], "A remotely applied role change retained stale all-role filter state")
            }),
            ("Home and Today navigation remain reversible without altering learning data", {
                let (store, _, _) = try makeStore(catalog, today, dueSnapshot([financeOnly], role: finance))
                store.prepareToday()
                store.hasEnteredLucid = true; store.selectedTab = 4
                let before = store.data; let revision = store.dataRevision; let previousReset = store.todayNavigationReset
                store.openHome()
                try reviewCheck(!store.hasEnteredLucid, "Home action did not return to Welcome")
                store.openToday()
                try reviewCheck(store.hasEnteredLucid && store.selectedTab == 0 && store.todayNavigationReset != previousReset, "Continue from Home did not reopen the root Today dashboard")
                let reset = store.todayNavigationReset
                store.openHome(); store.openToday()
                try reviewCheck(store.hasEnteredLucid && store.todayNavigationReset != reset, "Repeated Home → Today navigation retained a stale nested lesson")
                try reviewCheck(store.data == before && store.dataRevision == revision, "Moving between Home and Today changed learning history or saved data")
            })
        ]
        var failures = 0
        for (name, run) in tests {
            do { try run(); print("PASS: \(name)") }
            catch { failures += 1; print("FAIL: \(name): \(error)") }
        }
        print("\(tests.count - failures)/\(tests.count) review/navigation regression groups passed")
        if failures > 0 { exit(1) }
    }
}
