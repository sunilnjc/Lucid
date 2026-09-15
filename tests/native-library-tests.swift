import Foundation

enum ReminderScheduler { static func cancel() {} }
struct LibraryTestFailure: Error, CustomStringConvertible { let description: String }
func libraryCheck(_ condition: @autoclosure () throws -> Bool, _ message: String) throws {
    if try !condition() { throw LibraryTestFailure(description: message) }
}

@main @MainActor struct LibraryTests {
    static var directories: [URL] = []
    static func makeStore(_ catalog: ProfessionalCatalog, _ now: Date, _ initial: LearnerData = LearnerData()) throws -> (LearningStore, LearningPersistence) {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("lucid-library-fixture-\(UUID())", isDirectory: true)
        directories.append(directory)
        let persistence = LearningPersistence(directory: directory)
        // An existing fixture record prevents legacy migration from actual defaults.
        try persistence.save(initial, scope: "guest")
        return (LearningStore(catalog: catalog, persistence: persistence, now: { now }, accountService: nil), persistence)
    }
    static func main() throws {
        let catalog = try JSONDecoder().decode(ProfessionalCatalog.self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
        let today = Calendar.current.date(from: DateComponents(year: 2026, month: 9, day: 15, hour: 12))!
        let finance = catalog.roles.first { $0.id == "finance-accounting" }!
        let technology = catalog.roles.first { $0.id == "technology-engineering" }!
        let consulting = catalog.roles.first { $0.id == "consulting-strategy" }!
        let material = catalog.words.first { $0.term == "material" }!
        let financeOnly = catalog.words.first { $0.roles.contains(finance.id) && !$0.roles.contains(technology.id) }!
        let technologyOnly = catalog.words.first { $0.roles.contains(technology.id) && !$0.roles.contains(finance.id) }!
        func profile(_ role: ProfessionalRole) -> LearnerProfile {
            .init(roleId: role.id, seniorityId: catalog.seniorityLevels[0].id, situationIds: [role.situations[0].id], goalIds: [role.defaultGoalIds.first ?? catalog.goals[0].id])
        }
        func initial(_ role: ProfessionalRole) -> LearnerData {
            var data = LearnerData(); data.profile = profile(role); return data
        }
        func ids(_ words: [ProfessionalWord]) -> Set<String> { Set(words.map(\.id)) }
        func dirtyFilters(_ store: LearningStore) {
            store.libraryIncludesOtherRoles = true
            store.librarySearch = "Previous search"
            store.librarySavedOnly = true
        }
        func assertDefaultFilters(_ store: LearningStore) throws {
            try libraryCheck(!store.libraryIncludesOtherRoles && store.librarySearch.isEmpty && !store.librarySavedOnly, "Library retained stale all-role/search/bookmark filters")
        }
        defer { for directory in directories { try? FileManager.default.removeItem(at: directory) } }
        let tests: [(String, () throws -> Void)] = [
            ("all 56 role changes reset Library filters and show only the new role's words", {
                for from in catalog.roles {
                    for to in catalog.roles where from.id != to.id {
                        let (store, _) = try makeStore(catalog, today, initial(from))
                        store.prepareToday(); dirtyFilters(store)
                        let navigation = store.libraryNavigationReset
                        store.finishOnboarding(profile: profile(to))
                        try assertDefaultFilters(store)
                        try libraryCheck(store.libraryNavigationReset != navigation, "\(from.id) → \(to.id) retained a stale detail screen")
                        let expected = catalog.words.filter { $0.roles.contains(to.id) }
                        try libraryCheck(ids(store.visibleLibraryWords) == ids(expected) && store.visibleLibraryWords.count == expected.count,
                                         "\(from.id) → \(to.id) kept other-role words or hid relevant Library content")
                    }
                }
            }),
            ("role Library is a catalogue, not only today's cards or already-learned words", {
                let (store, _) = try makeStore(catalog, today, initial(finance))
                store.prepareToday()
                let expected = catalog.words.filter { $0.roles.contains(finance.id) }
                try libraryCheck(store.data.progressByWordId.isEmpty && store.data.introducedWordIds.isEmpty, "Fixture unexpectedly has learned words")
                let library = store.libraryWords(includeOtherRoles: false)
                try libraryCheck(library.count == expected.count && library.count > store.todayWords.count, "Library was incorrectly limited to today's or learned vocabulary")
                let recognition = expected.filter { $0.learningMode != "active" }
                try libraryCheck(!recognition.isEmpty && ids(library).isSuperset(of: ids(recognition)), "Recognition vocabulary disappeared from the browse catalogue")
                try libraryCheck(store.totalXP == 0 && store.data.sessions.isEmpty, "Browsing the Library awarded learning progress")
            }),
            ("all-role catalogue requires explicit opt-in and includes unlearned vocabulary exactly once", {
                let (store, _) = try makeStore(catalog, today, initial(technology))
                let own = store.libraryWords(includeOtherRoles: false)
                let all = store.libraryWords(includeOtherRoles: true)
                try libraryCheck(own.allSatisfy { $0.roles.contains(technology.id) } && own.count < all.count, "Default Library silently widened to all roles")
                try libraryCheck(ids(all) == ids(catalog.words) && all.count == catalog.words.count, "Explicit all-role catalogue lost, duplicated, or excluded unlearned words")
                try libraryCheck(store.data.progressByWordId.isEmpty && store.learnedCount == 0, "All-role browsing introduced words")
            }),
            ("search uses the displayed Consulting meaning of shared material rather than its Finance base meaning", {
                let (store, _) = try makeStore(catalog, today, initial(consulting))
                let matches = store.libraryWords(includeOtherRoles: false, search: "judgement")
                guard let displayed = matches.first(where: { $0.id == material.id }) else { throw LibraryTestFailure(description: "Consulting meaning search could not find material") }
                try libraryCheck(displayed.meaning == material.roleContexts?[consulting.id]?.meaning, "Search result showed the Finance definition to Consulting")
                try libraryCheck(!store.libraryWords(includeOtherRoles: false, search: "financial decision").contains { $0.id == material.id }, "Consulting search matched hidden Finance copy instead of displayed meaning")
                try libraryCheck(store.libraryWords(includeOtherRoles: true, search: "judgement").contains { $0.id == material.id }, "All-role opt-in removed the current role's contextualized search")
                store.finishOnboarding(profile: profile(finance))
                try libraryCheck(store.libraryWords(includeOtherRoles: false, search: "financial decision").contains { $0.id == material.id && $0.meaning == material.meaning }, "Switching back to Finance retained Consulting search context")
            }),
            ("search trims whitespace and matches case-insensitively without changing role scope", {
                let (store, _) = try makeStore(catalog, today, initial(finance))
                let plain = store.libraryWords(includeOtherRoles: false, search: "material")
                let padded = store.libraryWords(includeOtherRoles: false, search: " \n MATERIAL \t ")
                try libraryCheck(!plain.isEmpty && ids(plain) == ids(padded), "Pasted whitespace or uppercase text broke a valid search")
                try libraryCheck(ids(store.libraryWords(includeOtherRoles: false, search: " \n\t ")) == ids(store.libraryWords(includeOtherRoles: false)), "Whitespace-only search hid the current role catalogue")
                try libraryCheck(padded.allSatisfy { $0.roles.contains(finance.id) }, "Search widened the selected role")
            }),
            ("an empty search result never falls back to other roles or changes filter state", {
                let (store, _) = try makeStore(catalog, today, initial(technology))
                store.librarySearch = "zz-no-such-vocabulary-987"
                try libraryCheck(store.visibleLibraryWords.isEmpty, "Unmatched search fell back to arbitrary words")
                try libraryCheck(!store.libraryIncludesOtherRoles && store.librarySearch == "zz-no-such-vocabulary-987", "Empty results silently widened or cleared a user's filters")
                store.librarySearch = ""; store.librarySavedOnly = true
                try libraryCheck(store.visibleLibraryWords.isEmpty && store.librarySavedOnly && !store.libraryIncludesOtherRoles, "No-bookmark state silently widened to unsaved or other-role words")
            }),
            ("Saved words only intersects the selected role until all roles are explicitly requested", {
                var data = initial(technology); data.favouriteWordIds = [financeOnly.id, technologyOnly.id]
                let (store, _) = try makeStore(catalog, today, data)
                try libraryCheck(ids(store.libraryWords(includeOtherRoles: false, savedOnly: true)) == [technologyOnly.id], "Saved-only default included a saved Finance-only word")
                try libraryCheck(ids(store.libraryWords(includeOtherRoles: true, savedOnly: true)) == [financeOnly.id, technologyOnly.id], "Explicit all-role saved search lost bookmarks")
                try libraryCheck(ids(store.libraryWords(includeOtherRoles: true, search: " \(technologyOnly.term.uppercased()) ", savedOnly: true)).contains(technologyOnly.id), "Search and saved filters did not compose")
                try libraryCheck(Set(store.data.favouriteWordIds) == [financeOnly.id, technologyOnly.id], "Role filtering deleted other-role bookmarks")
            }),
            ("Clear filters returns to the selected role instead of implicitly showing every role", {
                let (store, _) = try makeStore(catalog, today, initial(technology))
                dirtyFilters(store)
                let navigation = store.libraryNavigationReset
                store.resetLibraryFilters()
                try assertDefaultFilters(store)
                try libraryCheck(store.libraryNavigationReset != navigation, "Clear filters did not return from a stale nested Library detail")
                try libraryCheck(!store.visibleLibraryWords.isEmpty && store.visibleLibraryWords.allSatisfy { $0.roles.contains(technology.id) }, "Clear filters widened the catalogue beyond the selected role")
                try libraryCheck(store.visibleLibraryWords.count == catalog.words.filter { $0.roles.contains(technology.id) }.count, "Clear filters did not restore the full current-role catalogue")
            }),
            ("opening Library resets all filters and nested navigation and enters the Library tab", {
                let (store, _) = try makeStore(catalog, today, initial(technology))
                store.selectedTab = 4; store.hasEnteredLucid = false; dirtyFilters(store)
                let navigation = store.libraryNavigationReset
                store.openLibrary()
                try assertDefaultFilters(store)
                try libraryCheck(store.selectedTab == 2 && store.hasEnteredLucid && store.libraryNavigationReset != navigation, "Open Library did not enter its root screen")
                dirtyFilters(store)
                let repeated = store.libraryNavigationReset
                store.openLibrary()
                try assertDefaultFilters(store)
                try libraryCheck(store.libraryNavigationReset != repeated, "Opening Library again left a stale nested detail screen")
            }),
            ("entering Library from another tab clears stale filters but remaining on Library does not interrupt searching", {
                let (store, _) = try makeStore(catalog, today, initial(technology))
                store.selectedTab = 1; dirtyFilters(store)
                let navigation = store.libraryNavigationReset
                store.selectedTab = 2
                try assertDefaultFilters(store)
                try libraryCheck(store.libraryNavigationReset != navigation, "Tab entry retained a nested previous-role Library screen")
                store.librarySearch = "material"; store.librarySavedOnly = true; store.libraryIncludesOtherRoles = true
                let inLibraryNavigation = store.libraryNavigationReset
                store.selectedTab = 2
                try libraryCheck(store.librarySearch == "material" && store.librarySavedOnly && store.libraryIncludesOtherRoles && store.libraryNavigationReset == inLibraryNavigation,
                                 "Reassigning the active tab unexpectedly interrupted the learner's current search")
            }),
            ("returning Home clears Library scope, search, saved filter and nested detail navigation", {
                let (store, _) = try makeStore(catalog, today, initial(technology))
                store.openLibrary(); dirtyFilters(store)
                let navigation = store.libraryNavigationReset
                let before = store.data; let revision = store.dataRevision
                store.openHome()
                try assertDefaultFilters(store)
                try libraryCheck(!store.hasEnteredLucid && store.libraryNavigationReset != navigation, "Home retained hidden Library detail/filter state")
                try libraryCheck(store.data == before && store.dataRevision == revision, "Returning Home changed saved learning data")
            }),
            ("a remotely applied role change clears every Library filter and stale detail navigation", {
                let (store, _) = try makeStore(catalog, today, initial(finance))
                dirtyFilters(store)
                let navigation = store.libraryNavigationReset
                store.data.profile = profile(technology)
                try assertDefaultFilters(store)
                try libraryCheck(store.libraryNavigationReset != navigation && store.visibleLibraryWords.allSatisfy { $0.roles.contains(technology.id) }, "Remote profile update left stale Library state from Finance")
            }),
            ("changing account scope clears private Library search state and nested navigation", {
                let (store, _) = try makeStore(catalog, today, initial(finance))
                let before = store.data; let revision = store.dataRevision
                for scope in ["33333333-5555-4444-8888-111111111111", "guest"] {
                    dirtyFilters(store)
                    let navigation = store.libraryNavigationReset
                    store.scope = scope
                    try assertDefaultFilters(store)
                    try libraryCheck(store.libraryNavigationReset != navigation, "An account scope change kept another account's Library detail open")
                }
                try libraryCheck(store.data == before && store.dataRevision == revision, "Account filter reset modified learner data")
            }),
            ("visible Library counts match the combined role, search, and saved filters", {
                var data = initial(consulting); data.favouriteWordIds = [material.id, technologyOnly.id]
                let (store, _) = try makeStore(catalog, today, data)
                for all in [false, true] {
                    for saved in [false, true] {
                        for query in ["", "material", "recommendation", "no-match-987"] {
                            store.libraryIncludesOtherRoles = all; store.librarySavedOnly = saved; store.librarySearch = query
                            let expected = catalog.words.map { $0.contextualized(for: consulting.id) }.filter { word in
                                (all || word.roles.contains(consulting.id)) && (!saved || data.favouriteWordIds.contains(word.id))
                                    && (query.isEmpty || word.term.localizedCaseInsensitiveContains(query) || word.meaning.localizedCaseInsensitiveContains(query))
                            }
                            try libraryCheck(store.visibleLibraryWords.count == expected.count && ids(store.visibleLibraryWords) == ids(expected), "Visible count diverged from actual filters: all=\(all), saved=\(saved), query=\(query)")
                        }
                    }
                }
            }),
            ("Library browsing and navigation do not introduce words or mutate drafts, reviews, XP, or source content", {
                var data = initial(consulting)
                data.progressByWordId[material.id] = WordProgress(introducedOn: today.lucidAdding(days: -3), nextReviewOn: today.lucidAdding(days: 4))
                data.introducedWordIds = [material.id]; data.favouriteWordIds = [material.id]
                data.practiceDrafts = [material.id: "Private workplace draft"]
                data.activities = [.init(id: UUID(), kind: .practice, wordId: material.id, date: today, dayKey: today.lucidDayKey, quality: 2, productive: false)]
                let (store, persistence) = try makeStore(catalog, today, data)
                store.prepareToday()
                let before = store.data; let revision = store.dataRevision; let xp = store.totalXP; let originalWords = store.catalog.words
                for _ in 0..<20 {
                    _ = store.libraryWords(includeOtherRoles: true, search: "material", savedOnly: true)
                    _ = store.libraryWords(includeOtherRoles: false)
                    dirtyFilters(store); store.resetLibraryFilters(); store.openLibrary()
                    _ = store.visibleLibraryWords
                }
                try libraryCheck(store.data == before && store.dataRevision == revision && store.totalXP == xp, "Library actions altered learning history or persistence revision")
                try libraryCheck(store.catalog.words == originalWords, "Role-specific search mutated canonical catalogue copy")
                try libraryCheck(try persistence.load(scope: "guest").data == before, "Library actions rewrote saved learner records")
            }),
            ("a learner without a selected role gets no assumed role while explicit all-role browsing remains available", {
                let (store, _) = try makeStore(catalog, today)
                try libraryCheck(store.libraryWords(includeOtherRoles: false).isEmpty && store.visibleLibraryWords.isEmpty, "Missing profile silently defaulted to Finance or all roles")
                try libraryCheck(ids(store.libraryWords(includeOtherRoles: true)) == ids(catalog.words), "Explicit catalogue browsing failed without a profile")
            })
        ]
        var failures = 0
        for (name, run) in tests {
            do { try run(); print("PASS: \(name)") }
            catch { failures += 1; print("FAIL: \(name): \(error)") }
        }
        print("\(tests.count - failures)/\(tests.count) Library regression groups passed")
        if failures > 0 { exit(1) }
    }
}
