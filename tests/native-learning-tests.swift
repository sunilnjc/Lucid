import Foundation

// Compile with Models.swift, LearningPersistence.swift, LearningStore.swift,
// AccountService.swift and the account-sync extension. Omit Services.swift.
// This stub prevents tests from touching the user's notification centre.
enum ReminderScheduler {
    static func cancel() {}
}

struct LaunchTestFailure: Error, CustomStringConvertible {
    let description: String
}

func require(_ condition: @autoclosure () throws -> Bool, _ message: String) throws {
    if try !condition() { throw LaunchTestFailure(description: message) }
}

@MainActor
final class TestClock {
    var date: Date
    init(_ date: Date) { self.date = date }
}

@main
@MainActor
struct LucidLaunchTests {
    static var temporaryDirectories: [URL] = []

    static func temporaryPersistence() throws -> LearningPersistence {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("lucid-launch-behavior-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        temporaryDirectories.append(directory)
        return LearningPersistence(directory: directory)
    }

    static func makeStore(
        catalogue: ProfessionalCatalog,
        date: Date,
        initial: LearnerData = LearnerData()
    ) throws -> (LearningStore, TestClock, LearningPersistence) {
        let persistence = try temporaryPersistence()
        try persistence.save(initial, scope: "guest")
        let clock = TestClock(date)
        let store = LearningStore(catalog: catalogue, persistence: persistence, now: { clock.date }, accountService: nil)
        return (store, clock, persistence)
    }

    static func limited(_ catalogue: ProfessionalCatalog, words: [ProfessionalWord]) -> ProfessionalCatalog {
        ProfessionalCatalog(schemaVersion: catalogue.schemaVersion, roles: catalogue.roles,
                            seniorityLevels: catalogue.seniorityLevels, goals: catalogue.goals, words: words)
    }

    static func practiceSentence(_ word: ProfessionalWord) -> String {
        "We will use \(word.term) in our project discussion today."
    }

    static func main() async throws {
        guard CommandLine.arguments.count == 2 else {
            throw LaunchTestFailure(description: "Usage: lucid-launch-tests /absolute/path/professional-content.json")
        }
        let catalogue = try JSONDecoder().decode(ProfessionalCatalog.self,
            from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
        guard let role = catalogue.roles.first,
              let seniority = catalogue.seniorityLevels.first,
              let situation = role.situations.first,
              let goal = catalogue.goals.first else {
            throw LaunchTestFailure(description: "The real catalogue must contain a role, seniority, situation, and goal")
        }
        let profile = LearnerProfile(roleId: role.id, seniorityId: seniority.id,
                                     situationIds: [situation.id], goalIds: [goal.id])
        let roleWords = catalogue.words.filter { $0.learningMode == "active" && $0.roles.contains(role.id) }
        try require(roleWords.count >= 3, "Catalogue must contain at least three active words for the first role")
        let word = roleWords[0]
        let baseline = Calendar.current.date(from: DateComponents(year: 2026, month: 9, day: 14, hour: 12))!
        func day(_ offset: Int) -> Date { baseline.lucidAdding(days: offset).addingTimeInterval(12 * 60 * 60) }
        defer {
            // Only UUID-named directories created by this test process are removed.
            for directory in temporaryDirectories { try? FileManager.default.removeItem(at: directory) }
        }

        var tests: [(String, () throws -> Void)] = []

        tests.append(("v1 learner JSON migrates without optional launch fields", {
            var original = LearnerData()
            original.profile = profile
            original.introducedWordIds = [word.id]
            original.favouriteWordIds = [word.id]
            original.progressByWordId[word.id] = WordProgress(introducedOn: day(-7), nextReviewOn: day(1))
            original.sessions = [DailySession(id: UUID(), date: day(-1), wordIds: [word.id], completedAt: day(-1))]
            let encoded = try JSONEncoder().encode(original)
            var legacy = try JSONSerialization.jsonObject(with: encoded) as! [String: Any]
            for key in ["schemaVersion", "displayName", "dailyWordGoal", "profileUpdatedAt", "lessonDayKey", "practiceDrafts", "activities", "favouriteChanges", "updatedAt"] {
                legacy.removeValue(forKey: key)
            }
            let migrated = try JSONDecoder().decode(LearnerData.self, from: JSONSerialization.data(withJSONObject: legacy))
            try require(migrated.profile == profile, "Migration lost the professional profile")
            try require(migrated.progressByWordId == original.progressByWordId, "Migration changed word history")
            try require(migrated.sessions == original.sessions && migrated.favouriteWordIds == [word.id], "Migration lost sessions or favourites")
            try require(migrated.activities == nil && migrated.practiceDrafts == nil, "Absent optional fields must decode safely")
        }))

        tests.append(("atomic backup recovers a corrupt primary and survives the next save", {
            let persistence = try temporaryPersistence()
            var first = LearnerData(); first.displayName = "First saved learner"
            var second = first; second.displayName = "Second saved learner"
            try persistence.save(first, scope: "guest")
            try persistence.save(second, scope: "guest")
            let primary = persistence.file(for: "guest")
            try Data("not-json".utf8).write(to: primary)
            let recovered = try persistence.load(scope: "guest")
            try require(recovered.data == first && recovered.notice != nil, "Corruption must recover the last valid backup with a notice")
            var third = first; third.displayName = "After recovery"
            try persistence.save(third, scope: "guest")
            let backup = try JSONDecoder().decode(LearningPersistence.Envelope.self, from: Data(contentsOf: primary.appendingPathExtension("backup")))
            try require(backup.learner == first, "The corrupt primary replaced the valid backup")
            try require(try persistence.load(scope: "guest").data == third, "The repaired primary did not persist")
        }))

        tests.append(("unrecoverable records block mutations without overwriting evidence", {
            let persistence = try temporaryPersistence()
            let primary = persistence.file(for: "guest")
            let damaged = Data("unrecoverable-record".utf8)
            try damaged.write(to: primary)
            let store = LearningStore(catalog: catalogue, persistence: persistence, now: { baseline }, accountService: nil)
            try require(store.storageBlocked, "Unreadable progress must block writes")
            store.finishOnboarding(profile: profile)
            store.saveDraft(practiceSentence(word), wordId: word.id)
            try require(!store.markTodayWord(word.id, quality: .good), "Blocked storage accepted a practice event")
            try require(try Data(contentsOf: primary) == damaged, "Blocked storage overwrote the unreadable record")
        }))

        tests.append(("a newer primary version is blocked even if an older valid backup exists", {
            let persistence = try temporaryPersistence()
            var old = LearnerData(); old.displayName = "Older backup"
            try persistence.save(old, scope: "guest")
            try persistence.save(old, scope: "guest")
            var future = old; future.displayName = "Newer version with additional progress"
            let bytes = try JSONEncoder().encode(LearningPersistence.Envelope(version: 3, learner: future))
            let primary = persistence.file(for: "guest")
            try bytes.write(to: primary)
            let store = LearningStore(catalog: catalogue, persistence: persistence, now: { baseline }, accountService: nil)
            try require(store.storageBlocked, "A future-version primary must not fall back to stale progress")
            store.finishOnboarding(profile: profile)
            try require(try Data(contentsOf: primary) == bytes, "The future-version record was overwritten")
            let changedSchema = Data(#"{"version":3,"learner":{"futureSchema":true}}"#.utf8)
            try changedSchema.write(to: primary)
            let unknown = LearningStore(catalog: catalogue, persistence: persistence, now: { baseline }, accountService: nil)
            try require(unknown.storageNeedsUpdate, "An unfamiliar future learner schema was mistaken for corrupt current data")
        }))

        tests.append(("opening today's plan introduces no words and creates no rewards", {
            let (store, _, _) = try makeStore(catalogue: catalogue, date: baseline)
            store.finishOnboarding(profile: profile, name: "  Avery  ", goal: 3)
            try require(store.todayWords.count == 3, "A new role should receive its requested daily words")
            try require(store.todayWords.allSatisfy { $0.roles.contains(role.id) }, "The daily plan contains unrelated-role vocabulary")
            try require(store.data.introducedWordIds.isEmpty && store.data.progressByWordId.isEmpty, "Viewing introduced unpractised words")
            try require(store.totalXP == 0 && store.activities.isEmpty, "Viewing awarded activity or XP")
            let ids = store.data.currentWordIds
            store.prepareToday()
            try require(store.data.currentWordIds == ids, "Same-day refresh changed a planned lesson")
            try require(store.displayName == "Avery", "Display names should be trimmed")
        }))

        tests.append(("practice is required, drafts survive relaunch, and rewards cannot repeat", {
            let (store, _, persistence) = try makeStore(catalogue: limited(catalogue, words: [word]), date: baseline)
            store.finishOnboarding(profile: profile, goal: 1)
            try require(!store.markTodayWord(word.id, quality: .good), "A blank attempt completed a word")
            store.saveDraft(word.term, wordId: word.id)
            try require(!store.markTodayWord(word.id, quality: .good), "A one-word attempt completed a word")
            store.saveDraft("The team will explain our next decision clearly.", wordId: word.id)
            try require(!store.markTodayWord(word.id, quality: .good), "An attempt without the target completed a word")
            let sentence = practiceSentence(word)
            store.saveDraft(sentence, wordId: word.id)
            let restored = LearningStore(catalog: store.catalog, persistence: persistence, now: { baseline }, accountService: nil)
            try require(restored.draft(for: word.id) == sentence, "The draft was lost on relaunch")
            try require(restored.markTodayWord(word.id, quality: .good), "A valid guided attempt did not complete")
            try require(!restored.markTodayWord(word.id, quality: .good), "A duplicate guided attempt was accepted")
            try require(restored.data.progressByWordId[word.id]?.successfulReviewDates.isEmpty == true, "Guided practice incorrectly counted as independent retrieval")
            try require(restored.totalXP == 10, "Practice XP must be awarded exactly once")
            try require(restored.completeToday(), "A one-word lesson could not complete")
            try require(!restored.completeToday(), "Duplicate lesson completion was accepted")
            try require(restored.totalXP == 30 && restored.data.sessions.count == 1, "Completion duplicated XP or sessions")
        }))

        tests.append(("last one or two unseen words complete without recycling exhausted content", {
            for remaining in [1, 2] {
                let remainingWords = Array(roleWords.prefix(remaining))
                let (store, clock, _) = try makeStore(catalogue: limited(catalogue, words: remainingWords), date: baseline)
                store.finishOnboarding(profile: profile, goal: 3)
                try require(store.todayWords.count == remaining, "A partial final lesson discarded unseen words")
                for activeWord in store.todayWords {
                    store.saveDraft(practiceSentence(activeWord), wordId: activeWord.id)
                    try require(store.markTodayWord(activeWord.id, quality: .good), "Could not practise a final unseen word")
                }
                try require(store.completeToday(), "A lesson with fewer than three words could not complete")
                clock.date = day(1)
                store.refreshDay()
                try require(store.todayWords.isEmpty, "Exhausted content was recycled as a new word")
                try require(store.dueWords.count == remaining, "Exhaustion lost scheduled reviews")
                try require(!store.completeToday(), "An empty lesson awarded completion")
            }
        }))

        tests.append(("daily goal and profile edits preserve the active day's work", {
            let (store, _, _) = try makeStore(catalogue: catalogue, date: baseline)
            store.finishOnboarding(profile: profile, goal: 2)
            try require(store.todayWords.count == 2 && store.dailyGoal == 2, "The requested two-word goal was ignored")
            let ids = store.data.currentWordIds
            let activeWord = store.todayWords[0]
            store.saveDraft(practiceSentence(activeWord), wordId: activeWord.id)
            try require(store.markTodayWord(activeWord.id, quality: .good), "Could not establish partial progress")
            store.finishOnboarding(profile: profile, name: "Updated name", goal: 1)
            try require(store.data.currentWordIds == ids, "Profile edit replaced today's planned words")
            try require(store.data.completedWordIdsToday == [activeWord.id], "Profile edit erased today's completion")
            try require(store.draft(for: activeWord.id) == practiceSentence(activeWord), "Profile edit erased the draft")
        }))

        tests.append(("revealing without retrieval cannot earn mastery or advance the interval", {
            var initial = LearnerData(); initial.profile = profile
            initial.introducedWordIds = [word.id]
            initial.progressByWordId[word.id] = WordProgress(introducedOn: day(-40), intervalIndex: 2,
                nextReviewOn: day(0), reviewCount: 2, successfulReviewDates: [day(-30), day(-20)])
            let (store, _, _) = try makeStore(catalogue: catalogue, date: baseline, initial: initial)
            try require(store.review(wordId: word.id, quality: .strong, productive: false), "A reveal/helped review should still be recorded")
            let progress = store.data.progressByWordId[word.id]!
            try require(!progress.mastered && progress.successfulReviewDates.count == 2, "A reveal counted as independent productive retrieval")
            try require(progress.intervalIndex == 1, "A revealed answer advanced the review interval")
            try require(store.totalXP == 5 && store.streak == 1, "A helped review must earn effort credit, not independent-retrieval XP")
            try require(!store.review(wordId: word.id, quality: .good, productive: true), "The same-day review was counted twice")
            try require(store.totalXP == 5 && store.data.progressByWordId[word.id]?.reviewCount == 3, "Duplicate review inflated rewards or counters")
        }))

        tests.append(("productive review-only days maintain an activity streak", {
            var initial = LearnerData(); initial.profile = profile
            initial.introducedWordIds = roleWords.map(\.id)
            initial.progressByWordId[word.id] = WordProgress(introducedOn: day(-10), nextReviewOn: day(0))
            initial.activities = [LearningActivity(id: UUID(), kind: .review, wordId: roleWords[1].id,
                date: day(-1), dayKey: day(-1).lucidDayKey, quality: 2, productive: true)]
            let (store, _, _) = try makeStore(catalogue: limited(catalogue, words: roleWords), date: baseline, initial: initial)
            store.prepareToday()
            try require(store.todayWords.isEmpty, "The review-only fixture should have no new words")
            try require(store.review(wordId: word.id, quality: .good, productive: true), "Productive recall was not recorded")
            try require(store.streak == 2, "Review-only learning broke the activity streak")
            try require(store.data.sessions.isEmpty, "Review-only practice fabricated a daily lesson completion")
            try require(store.totalXP == 30, "Two productive reviews should earn exactly 30 XP")
        }))

        tests.append(("mastery needs three distinct productive review days and 30-day retention", {
            let (store, clock, _) = try makeStore(catalogue: limited(catalogue, words: [word]), date: baseline)
            store.finishOnboarding(profile: profile, goal: 1)
            store.saveDraft(practiceSentence(word), wordId: word.id)
            try require(store.markTodayWord(word.id, quality: .good), "Could not introduce the mastery fixture")
            for (offset, expectedCount) in [(1, 1), (4, 2), (30, 3)] {
                clock.date = day(offset); store.refreshDay()
                try require(store.review(wordId: word.id, quality: .good, productive: true), "Due productive review at day \(offset) failed")
                let progress = store.data.progressByWordId[word.id]!
                try require(progress.successfulReviewDates.count == expectedCount, "Productive dates were not deduplicated")
                try require(progress.mastered == (offset == 30), "Mastery timing is incorrect at day \(offset)")
                try require(!store.review(wordId: word.id, quality: .strong, productive: true), "Same-day recall was accepted twice")
            }
            try require(store.masteredCount == 1, "The retention milestone did not appear in progress")
            try require(store.achievements.first { $0.id == "retain" }?.earned == true, "30-day mastery did not unlock its achievement")
        }))

        tests.append(("whole-word matching rejects substrings and accepts common inflections", {
            let (store, _, _) = try makeStore(catalogue: catalogue, date: baseline)
            guard let material = catalogue.words.first(where: { $0.term == "material" }),
                  let reconcile = catalogue.words.first(where: { $0.term == "reconcile" }) else {
                throw LaunchTestFailure(description: "Expected real catalogue fixtures material and reconcile")
            }
            try require(!store.containsTerm("That point is immaterial to our decision.", word: material), "Substring matching accepted immaterial as material")
            try require(store.containsTerm("This has a material impact on our forecast.", word: material), "A whole-word match was rejected")
            try require(store.containsTerm("We are reconciling the balances before closing.", word: reconcile), "The common reconciling inflection was rejected")
        }))

        tests.append(("merge is idempotent and explicit favourite removals survive stale snapshots", {
            let event = LearningActivity(id: UUID(), kind: .practice, wordId: word.id,
                date: day(-1), dayKey: day(-1).lucidDayKey, quality: 2, productive: false)
            var local = LearnerData(); local.profile = profile; local.activities = [event]
            local.introducedWordIds = [word.id]
            local.favouriteWordIds = [word.id]
            local.favouriteChanges = [word.id: FavouriteChange(selected: true, updatedAt: day(-3))]
            local.practiceDrafts = [word.id: "Private local draft"]
            local.settings.notificationsEnabled = true
            local.settings.reminderHour = 11
            var remote = local
            remote.activities = [event, LearningActivity(id: UUID(), kind: .review, wordId: word.id,
                date: baseline, dayKey: baseline.lucidDayKey, quality: 2, productive: true)]
            remote.favouriteWordIds = []
            remote.favouriteChanges = [word.id: FavouriteChange(selected: false, updatedAt: day(-1))]
            remote.practiceDrafts = [word.id: "A different device draft"]
            remote.settings.reminderHour = 18
            let combined = LearningMerge.combine(local: local, remote: remote)
            let repeated = LearningMerge.combine(local: combined, remote: remote)
            try require(combined == repeated, "Applying the same remote state twice changed merged data")
            try require(combined.activities?.count == 2, "Immutable event IDs were duplicated during merge")
            try require(!combined.favouriteWordIds.contains(word.id), "An explicit favourite removal was lost")
            let stale = LearningMerge.combine(local: combined, remote: local)
            try require(!stale.favouriteWordIds.contains(word.id), "A stale snapshot resurrected a removed favourite")
            try require(combined.practiceDrafts == local.practiceDrafts && combined.settings == local.settings, "Merge overwrote device-local drafts or notification settings")
            let cloud = LearningMerge.cloudRecord(combined)
            try require(cloud.practiceDrafts == nil && cloud.settings == AppSettings(), "Cloud record exposes private drafts or device notification settings")
        }))

        tests.append(("guest and account files remain isolated through save, recovery, and removal", {
            let persistence = try temporaryPersistence()
            let aliceScope = UUID().uuidString
            let bobScope = UUID().uuidString
            var guest = LearnerData(); guest.displayName = "Guest learner"
            var alice = LearnerData(); alice.displayName = "Alice account"
            alice.favouriteWordIds = [word.id]
            var bob = LearnerData(); bob.displayName = "Bob account"
            bob.practiceDrafts = [word.id: "Bob's private draft"]
            try persistence.save(guest, scope: "guest")
            try persistence.save(alice, scope: aliceScope)
            try persistence.save(bob, scope: bobScope)
            try require(Set([persistence.file(for: "guest"), persistence.file(for: aliceScope), persistence.file(for: bobScope)]).count == 3,
                        "Guest and account scopes share a file")
            try require(persistence.file(for: aliceScope) == persistence.file(for: aliceScope.lowercased()),
                        "UUID case created duplicate files for one account")
            try require(try persistence.load(scope: aliceScope).data == alice, "Alice loaded another learner's data")
            try require(try persistence.load(scope: bobScope).data == bob, "Bob loaded another learner's data")
            try require(try persistence.load(scope: "guest").data == guest, "Signing into an account changed guest data")
            var aliceNew = alice; aliceNew.displayName = "Updated Alice"
            try persistence.save(aliceNew, scope: aliceScope)
            try Data("damaged-account-primary".utf8).write(to: persistence.file(for: aliceScope))
            try require(try persistence.load(scope: aliceScope).data == alice, "Account backup recovery loaded the wrong scope")
            try require(try persistence.load(scope: bobScope).data == bob, "Account corruption affected another account")
            try persistence.remove(scope: aliceScope)
            try require(!FileManager.default.fileExists(atPath: persistence.file(for: aliceScope).path)
                        && !FileManager.default.fileExists(atPath: persistence.file(for: aliceScope).appendingPathExtension("backup").path),
                        "Account removal left its primary or backup behind")
            try require(try persistence.load(scope: bobScope).data == bob, "Removing Alice erased Bob's data")
            try require(try persistence.load(scope: "guest").data == guest, "Removing an account erased guest data")
        }))

        tests.append(("an unrefreshed previous-day screen cannot complete words or lessons after midnight", {
            let oneWord = limited(catalogue, words: [word])
            let (ready, readyClock, _) = try makeStore(catalogue: oneWord, date: baseline)
            ready.finishOnboarding(profile: profile, goal: 1)
            ready.saveDraft(practiceSentence(word), wordId: word.id)
            try require(ready.markTodayWord(word.id, quality: .good), "Could not prepare a complete previous-day lesson")
            let activityCount = ready.activities.count
            let xp = ready.totalXP
            readyClock.date = day(1)
            try require(!ready.completeToday(), "A stale screen completed yesterday's lesson after midnight")
            try require(ready.data.sessions.isEmpty && ready.activities.count == activityCount && ready.totalXP == xp,
                        "Rejected stale completion still created a session or reward")

            let (pending, pendingClock, _) = try makeStore(catalogue: oneWord, date: baseline)
            pending.finishOnboarding(profile: profile, goal: 1)
            pending.saveDraft(practiceSentence(word), wordId: word.id)
            pendingClock.date = day(1)
            try require(!pending.markTodayWord(word.id, quality: .good), "A stale screen accepted new practice without refreshing its day")
            try require(pending.activities.isEmpty && pending.data.introducedWordIds.isEmpty,
                        "Rejected stale practice introduced a word or activity")
        }))

        tests.append(("foreground refresh rolls over once and retains unfinished drafts and tab selection", {
            let (store, clock, persistence) = try makeStore(catalogue: limited(catalogue, words: Array(roleWords.prefix(3))), date: baseline)
            store.finishOnboarding(profile: profile, goal: 2)
            let practisedWord = store.todayWords[0]
            let unfinishedWord = store.todayWords[1]
            store.saveDraft(practiceSentence(practisedWord), wordId: practisedWord.id)
            try require(store.markTodayWord(practisedWord.id, quality: .good), "Could not establish yesterday's practice")
            let unfinishedDraft = "We will use \(unfinishedWord.term) in the next team meeting."
            store.saveDraft(unfinishedDraft, wordId: unfinishedWord.id)
            let eventsBeforeRefresh = store.activities
            store.selectedTab = 2
            clock.date = day(1)
            store.refreshDay()
            let nextPlan = store.data.currentWordIds
            try require(store.data.lessonDayKey == day(1).lucidDayKey && nextPlan.count == 2,
                        "Foreground refresh did not create the next day's plan")
            try require(!nextPlan.contains(practisedWord.id) && nextPlan.contains(unfinishedWord.id),
                        "The next plan recycled a practised word or discarded unfinished unseen work")
            try require(store.data.completedWordIdsToday.isEmpty, "Yesterday's completion leaked into today")
            try require(store.draft(for: unfinishedWord.id) == unfinishedDraft, "Foreground refresh erased the unfinished draft")
            try require(store.selectedTab == 2, "Refreshing the day unexpectedly changed the selected tab")
            try require(store.dueWords.contains { $0.id == practisedWord.id }, "Yesterday's practice did not become due")
            store.refreshDay()
            store.prepareToday()
            try require(store.data.currentWordIds == nextPlan && store.activities == eventsBeforeRefresh,
                        "Repeated foreground refresh changed the plan or created learning events")
            let restored = LearningStore(catalog: store.catalog, persistence: persistence, now: { day(1) }, accountService: nil)
            restored.refreshDay()
            try require(restored.data.currentWordIds == nextPlan && restored.draft(for: unfinishedWord.id) == unfinishedDraft,
                        "Relaunch changed today's selected plan or lost the retained draft")
        }))

        tests.append(("merging independent device reviews derives mastery from distinct productive days", {
            @MainActor func reviewEvent(_ offset: Int, quality: Int = 2, productive: Bool = true, seconds: TimeInterval = 0) -> LearningActivity {
                LearningActivity(id: UUID(), kind: .review, wordId: word.id,
                                 date: day(offset).addingTimeInterval(seconds), dayKey: day(offset).lucidDayKey,
                                 quality: quality, productive: productive)
            }
            var local = LearnerData(); local.profile = profile
            local.introducedWordIds = [word.id]
            local.activities = [reviewEvent(1), reviewEvent(4)]
            local.progressByWordId[word.id] = WordProgress(introducedOn: baseline, intervalIndex: 2,
                nextReviewOn: day(11), lastReviewedOn: day(4), reviewCount: 2,
                successfulReviewDates: [day(1), day(4)], mastered: false)
            var remote = LearnerData(); remote.profile = profile
            remote.introducedWordIds = [word.id]
            remote.activities = [reviewEvent(30)]
            remote.progressByWordId[word.id] = WordProgress(introducedOn: baseline, intervalIndex: 1,
                nextReviewOn: day(33), lastReviewedOn: day(30), reviewCount: 1,
                successfulReviewDates: [day(30)], mastered: false)
            let combined = LearningMerge.combine(local: local, remote: remote)
            try require(combined.progressByWordId[word.id]?.mastered == true,
                        "Three productive review days across devices did not derive 30-day mastery")
            try require(combined.progressByWordId[word.id]?.reviewCount == 3,
                        "Merged review counts did not include distinct independent events")
            try require(LearningMerge.combine(local: combined, remote: remote) == combined,
                        "Repeating the remote snapshot changed derived mastery or counts")

            var twoDays = local
            twoDays.activities = [reviewEvent(1), reviewEvent(30)]
            twoDays.progressByWordId[word.id]?.successfulReviewDates = [day(1), day(30)]
            let sameDayDuplicate = LearningMerge.combine(local: twoDays, remote: remote)
            try require(sameDayDuplicate.progressByWordId[word.id]?.mastered == false,
                        "Independent same-day events were counted as three distinct mastery days")

            var conflictingDevice = remote
            conflictingDevice.activities = [reviewEvent(30, quality: 1, productive: false, seconds: 60)]
            let conflict = LearningMerge.combine(local: combined, remote: conflictingDevice)
            try require(conflict.progressByWordId[word.id]?.mastered == false,
                        "A conflicting helped review on the retention day incorrectly preserved mastery")
        }))

        tests.append(("retrying a failed save persists current memory instead of reloading stale disk data", {
            let (store, _, persistence) = try makeStore(catalogue: catalogue, date: baseline)
            store.finishOnboarding(profile: profile, goal: 1)
            let activeWord = store.todayWords[0]
            let oldDraft = "This older draft was saved before the temporary storage failure."
            store.saveDraft(oldDraft, wordId: activeWord.id)
            let directory = persistence.directory
            let heldDirectory = directory.deletingLastPathComponent()
                .appendingPathComponent("lucid-launch-held-\(UUID().uuidString)", isDirectory: true)
            try FileManager.default.moveItem(at: directory, to: heldDirectory)
            var obstructed = true
            defer {
                if obstructed {
                    try? FileManager.default.removeItem(at: directory)
                    try? FileManager.default.moveItem(at: heldDirectory, to: directory)
                }
            }
            // A file at the expected directory path creates a deterministic write failure;
            // no permissions or storage outside this test's UUID-owned fixture are changed.
            try Data("temporary-save-obstruction".utf8).write(to: directory)
            let unsavedDraft = practiceSentence(activeWord)
            store.saveDraft(unsavedDraft, wordId: activeWord.id)
            try require(store.hasUnsavedChanges && store.storageNotice != nil, "Save failure was not surfaced")
            try require(store.draft(for: activeWord.id) == unsavedDraft, "Save failure discarded the latest in-memory draft")
            store.retryStorage()
            try require(store.hasUnsavedChanges && store.draft(for: activeWord.id) == unsavedDraft,
                        "A still-failing retry discarded pending memory")

            try FileManager.default.removeItem(at: directory)
            try FileManager.default.moveItem(at: heldDirectory, to: directory)
            obstructed = false
            try require(try persistence.load(scope: "guest").data.practiceDrafts?[activeWord.id] == oldDraft,
                        "The disk fixture should still contain only the older draft before retry")
            store.retryStorage()
            try require(!store.hasUnsavedChanges && store.storageNotice == nil, "Successful retry did not clear the save error")
            try require(store.draft(for: activeWord.id) == unsavedDraft,
                        "Retry reloaded older disk data over pending changes")
            try require(try persistence.load(scope: "guest").data.practiceDrafts?[activeWord.id] == unsavedDraft,
                        "Retry did not persist the latest in-memory draft")
            let restored = LearningStore(catalog: catalogue, persistence: persistence, now: { baseline }, accountService: nil)
            try require(restored.draft(for: activeWord.id) == unsavedDraft, "The recovered save did not survive relaunch")
        }))
        tests.append(("restoring a backup honors explicit profile replacement while preserving combined history", {
            var backupProfile = profile
            backupProfile.seniorityId = catalogue.seniorityLevels.last!.id
            let localEvent = LearningActivity(id: UUID(), kind: .practice, wordId: word.id,
                date: day(-1), dayKey: day(-1).lucidDayKey, quality: 2, productive: false)
            let incomingEvent = LearningActivity(id: UUID(), kind: .practice, wordId: roleWords[1].id,
                date: day(-4), dayKey: day(-4).lucidDayKey, quality: 2, productive: false)
            var local = LearnerData()
            local.profile = profile; local.displayName = "Current learner"; local.dailyWordGoal = 3
            local.profileUpdatedAt = baseline
            local.introducedWordIds = [word.id]
            local.progressByWordId[word.id] = WordProgress(introducedOn: day(-1), nextReviewOn: day(1))
            local.activities = [localEvent]
            local.sessions = [DailySession(id: UUID(), date: day(-1), wordIds: [word.id], completedAt: day(-1))]
            local.practiceDrafts = [word.id: "Keep this existing local sentence.", roleWords[1].id: ""]
            var incoming = LearnerData()
            incoming.profile = backupProfile; incoming.displayName = "Backup learner"; incoming.dailyWordGoal = 1
            incoming.profileUpdatedAt = day(-30)
            incoming.introducedWordIds = [roleWords[1].id]
            incoming.progressByWordId[roleWords[1].id] = WordProgress(introducedOn: day(-4), nextReviewOn: day(-1))
            incoming.activities = [incomingEvent]
            incoming.sessions = [DailySession(id: UUID(), date: day(-4), wordIds: [roleWords[1].id], completedAt: day(-4))]
            incoming.practiceDrafts = [word.id: "Older conflicting backup sentence.",
                                      roleWords[1].id: "Restore this useful backup sentence.",
                                      roleWords[2].id: "Restore this backup-only sentence."]
            let restored = LearningMerge.restoringBackup(local: local, incoming: incoming, restoreProfile: true)
            try require(restored.profile == backupProfile && restored.displayName == "Backup learner" && restored.dailyWordGoal == 1,
                        "Explicit profile restore did not override the newer local profile")
            try require(Set(restored.introducedWordIds) == Set([word.id, roleWords[1].id]), "Backup restore lost introduced history")
            try require(restored.progressByWordId[word.id] != nil && restored.progressByWordId[roleWords[1].id] != nil,
                        "Backup restore lost one device's word history")
            try require(Set((restored.activities ?? []).map(\.id)) == Set([localEvent.id, incomingEvent.id]) && restored.sessions.count == 2,
                        "Backup restore replaced activity or session history instead of merging it")
            try require(restored.practiceDrafts?[word.id] == local.practiceDrafts?[word.id], "Restore overwrote a nonempty local draft")
            try require(restored.practiceDrafts?[roleWords[1].id] == incoming.practiceDrafts?[roleWords[1].id],
                        "An empty local draft suppressed useful backup work")
            try require(restored.practiceDrafts?[roleWords[2].id] == incoming.practiceDrafts?[roleWords[2].id],
                        "A draft found only in the backup was discarded")
        }))

        tests.append(("keep-current profile preference survives newer backup metadata and fills an absent profile", {
            var backupProfile = profile
            backupProfile.seniorityId = catalogue.seniorityLevels.last!.id
            var local = LearnerData()
            local.profile = profile; local.displayName = "Keep current name"; local.dailyWordGoal = 2
            local.profileUpdatedAt = day(-10)
            var incoming = LearnerData()
            incoming.profile = backupProfile; incoming.displayName = "Newer backup name"; incoming.dailyWordGoal = 1
            incoming.profileUpdatedAt = baseline
            incoming.introducedWordIds = [word.id]
            let kept = LearningMerge.restoringBackup(local: local, incoming: incoming, restoreProfile: false)
            try require(kept.profile == local.profile && kept.displayName == local.displayName && kept.dailyWordGoal == local.dailyWordGoal,
                        "A newer backup ignored the choice to keep the current profile")
            try require(kept.introducedWordIds == [word.id], "Keeping the current profile prevented history restoration")
            let restoredMissing = LearningMerge.restoringBackup(local: LearnerData(), incoming: incoming, restoreProfile: false)
            try require(restoredMissing.profile == backupProfile && restoredMissing.displayName == "Newer backup name" && restoredMissing.dailyWordGoal == 1,
                        "A device without a profile failed to restore the backup's identity and goal")
        }))

        tests.append(("hinted reveal survives relaunch and cannot be relabeled independent afterward", {
            var initial = LearnerData(); initial.profile = profile
            initial.introducedWordIds = [word.id]
            initial.progressByWordId[word.id] = WordProgress(introducedOn: day(-40), nextReviewOn: baseline)
            let recallKey = "recall:\(baseline.lucidDayKey):\(word.id)"
            let attemptKey = "\(baseline.lucidDayKey):\(word.id)"
            let original = "I need a hint to remember this word."
            initial.practiceDrafts = [recallKey: original]
            let (store, _, persistence) = try makeStore(catalogue: catalogue, date: baseline, initial: initial)
            store.revealReview(wordId: word.id, usingHint: true)
            try require(store.reviewAttempt(for: word.id)?.originalAttempt == original
                        && store.reviewAttempt(for: word.id)?.independent == false,
                        "Hint reveal did not capture and lock the original attempt")
            try require(store.data.reviewAttempts?[attemptKey]?.independent == false,
                        "Review attempt is not keyed by its original local day and word")

            let restored = LearningStore(catalog: catalogue, persistence: persistence, now: { baseline }, accountService: nil)
            try require(restored.reviewAttempt(for: word.id)?.originalAttempt == original
                        && restored.reviewAttempt(for: word.id)?.independent == false,
                        "Relaunch forgot that the answer had already been revealed with a hint")
            var drafts = restored.data.practiceDrafts ?? [:]
            drafts[recallKey] = practiceSentence(word)
            restored.data.practiceDrafts = drafts
            restored.revealReview(wordId: word.id, usingHint: false)
            try require(restored.reviewAttempt(for: word.id)?.originalAttempt == original
                        && restored.reviewAttempt(for: word.id)?.independent == false,
                        "Editing the answer and revealing again upgraded a hinted attempt")
            try require(restored.review(wordId: word.id, quality: .strong, productive: true), "A helped review should still be recordable")
            let progress = restored.data.progressByWordId[word.id]!
            try require(!progress.mastered && progress.successfulReviewDates.isEmpty,
                        "A caller bypassed the persisted hint by passing productive true")
            try require(restored.activities.last?.productive == false && restored.totalXP == 5,
                        "A hinted attempt earned independent-recall rewards")
            try require(restored.streak == 1, "Honest helped practice should count toward the effort streak")
        }))

        tests.append(("independent reveal preserves its original answer and eligibility across relaunch", {
            var initial = LearnerData(); initial.profile = profile
            initial.introducedWordIds = [word.id]
            initial.progressByWordId[word.id] = WordProgress(introducedOn: day(-1), nextReviewOn: baseline)
            let recallKey = "recall:\(baseline.lucidDayKey):\(word.id)"
            let original = practiceSentence(word)
            initial.practiceDrafts = [recallKey: original]
            let (store, _, persistence) = try makeStore(catalogue: catalogue, date: baseline, initial: initial)
            store.revealReview(wordId: word.id, usingHint: false)
            try require(store.reviewAttempt(for: word.id)?.independent == true, "A complete independent answer was not eligible for recall")
            let restored = LearningStore(catalog: catalogue, persistence: persistence, now: { baseline }, accountService: nil)
            try require(restored.reviewAttempt(for: word.id)?.independent == true
                        && restored.reviewAttempt(for: word.id)?.originalAttempt == original,
                        "Relaunch lost independent recall eligibility or its original sentence")
            var drafts = restored.data.practiceDrafts ?? [:]
            drafts[recallKey] = "A later edit must not replace the first submitted answer."
            restored.data.practiceDrafts = drafts
            restored.revealReview(wordId: word.id, usingHint: false)
            try require(restored.reviewAttempt(for: word.id)?.originalAttempt == original,
                        "Repeated reveal replaced the saved original answer")
            try require(restored.review(wordId: word.id, quality: .good, productive: true), "Persisted independent review could not be rated")
            try require(restored.activities.last?.productive == true && restored.totalXP == 15,
                        "Persisted independent review was not recorded as successful recall")
            try require(restored.data.progressByWordId[word.id]?.successfulReviewDates.count == 1,
                        "Successful persisted review did not create exactly one productive date")
        }))

        tests.append(("revealing an insufficient answer locks it as helped even when the hint button was not used", {
            var initial = LearnerData(); initial.profile = profile
            initial.introducedWordIds = [word.id]
            initial.progressByWordId[word.id] = WordProgress(introducedOn: day(-1), nextReviewOn: baseline)
            let recallKey = "recall:\(baseline.lucidDayKey):\(word.id)"
            initial.practiceDrafts = [recallKey: word.term]
            let (store, _, _) = try makeStore(catalogue: catalogue, date: baseline, initial: initial)
            store.revealReview(wordId: word.id, usingHint: false)
            try require(store.reviewAttempt(for: word.id)?.independent == false,
                        "A target word without a practice sentence earned independent-use eligibility")
            var drafts = store.data.practiceDrafts ?? [:]
            drafts[recallKey] = practiceSentence(word)
            store.data.practiceDrafts = drafts
            store.revealReview(wordId: word.id, usingHint: false)
            try require(store.reviewAttempt(for: word.id)?.originalAttempt == word.term
                        && store.reviewAttempt(for: word.id)?.independent == false,
                        "Answer edits after revelation upgraded an insufficient first attempt")
        }))

        tests.append(("review attempts stay local and older learner records decode without them", {
            let attemptKey = "\(baseline.lucidDayKey):\(word.id)"
            var learner = LearnerData(); learner.profile = profile
            learner.reviewAttempts = [attemptKey: ReviewAttempt(originalAttempt: "A private workplace sentence.", independent: false)]
            learner.practiceDrafts = [word.id: "Another private draft."]
            let cloud = LearningMerge.cloudRecord(learner)
            try require(cloud.reviewAttempts == nil && cloud.practiceDrafts == nil,
                        "Cloud sync includes a saved recall sentence or attempt marker")
            let cloudJSON = try JSONSerialization.jsonObject(with: JSONEncoder().encode(cloud)) as! [String: Any]
            try require(cloudJSON["reviewAttempts"] == nil, "Encoded cloud payload still contains review attempts")
            var legacyJSON = try JSONSerialization.jsonObject(with: JSONEncoder().encode(learner)) as! [String: Any]
            legacyJSON.removeValue(forKey: "reviewAttempts")
            let decoded = try JSONDecoder().decode(LearnerData.self, from: JSONSerialization.data(withJSONObject: legacyJSON))
            try require(decoded.reviewAttempts == nil && decoded.profile == profile,
                        "Adding review attempts broke decoding of an existing learner record")
        }))
        tests.append(("exported backup restores before onboarding and invalid imports leave progress intact", {
            var incoming = LearnerData(); incoming.profile = profile
            incoming.displayName = "Returning learner"; incoming.dailyWordGoal = 1
            incoming.profileUpdatedAt = day(-20)
            incoming.practiceDrafts = [word.id: "My private saved practice sentence."]
            incoming.introducedWordIds = [word.id]
            incoming.progressByWordId[word.id] = WordProgress(introducedOn: day(-5), nextReviewOn: day(1))
            let (store, _, persistence) = try makeStore(catalogue: catalogue, date: baseline)
            let file = persistence.directory.appendingPathComponent("transfer.json")
            try LucidBackupDocument(data: incoming).content.write(to: file)
            try store.importBackup(from: file, restoreProfile: true)
            try require(store.profile == profile && store.displayName == "Returning learner" && store.dailyGoal == 1,
                        "Fresh-install restore did not recover profile, name, and pace")
            try require(store.data.profileUpdatedAt == baseline && store.draft(for: word.id) == incoming.practiceDrafts?[word.id],
                        "Restore did not preserve the draft or timestamp the profile choice")
            let saved = try persistence.load(scope: "guest").data
            try require(saved == store.data, "Restored progress was not durably saved")
            var invalid = incoming; invalid.currentWordIds = ["unknown-word"]
            try LucidBackupDocument(data: invalid).content.write(to: file)
            do { try store.importBackup(from: file); throw LaunchTestFailure(description: "Invalid backup was accepted") }
            catch is LucidBackupDocument.BackupError { }
            try require(store.data == saved && (try persistence.load(scope: "guest").data) == saved,
                        "Rejected import changed current progress")
        }))

        tests.append(("explicit backup recovery preserves damaged files and refuses newer-version data", {
            let persistence = try temporaryPersistence()
            let primary = persistence.file(for: "guest")
            let damaged = Data("damaged-primary".utf8), damagedBackup = Data("damaged-backup".utf8)
            try damaged.write(to: primary)
            try damagedBackup.write(to: primary.appendingPathExtension("backup"))
            let store = LearningStore(catalog: catalogue, persistence: persistence, now: { baseline }, accountService: nil)
            try require(store.storageBlocked && !store.storageNeedsUpdate, "Damaged local storage did not enable safe recovery")
            var incoming = LearnerData(); incoming.profile = profile; incoming.displayName = "Recovered"
            let transfer = persistence.directory.appendingPathComponent("transfer.json")
            try LucidBackupDocument(data: incoming).content.write(to: transfer)
            try store.importBackup(from: transfer, restoreProfile: true)
            try require(!store.storageBlocked && store.displayName == "Recovered", "Explicit backup recovery failed")
            let archives = try FileManager.default.contentsOfDirectory(at: persistence.directory, includingPropertiesForKeys: nil)
                .filter { $0.lastPathComponent.hasPrefix("Recovery-") }
            try require(archives.count == 1, "Recovery did not archive the damaged evidence")
            try require(try Data(contentsOf: archives[0].appendingPathComponent(primary.lastPathComponent)) == damaged,
                        "Recovery lost the original damaged primary")
            try require(try Data(contentsOf: archives[0].appendingPathComponent(primary.lastPathComponent + ".backup")) == damagedBackup,
                        "Recovery lost the original damaged backup")
            let future = try JSONEncoder().encode(LearningPersistence.Envelope(version: 3, learner: incoming))
            try future.write(to: primary)
            let blocked = LearningStore(catalog: catalogue, persistence: persistence, now: { baseline }, accountService: nil)
            try require(blocked.storageBlocked && blocked.storageNeedsUpdate, "Newer-version storage was not protected")
            do { try blocked.importBackup(from: transfer, restoreProfile: true); throw LaunchTestFailure(description: "A backup downgraded future data") }
            catch is LucidBackupDocument.BackupError { }
            try require(try Data(contentsOf: primary) == future, "Rejected downgrade changed future data")
            try persistence.remove(scope: "guest")
            try require(!FileManager.default.fileExists(atPath: archives[0].path), "Explicit erasure left private recovery evidence behind")
        }))

        tests.append(("stale review cards cannot bypass a hint by submitting after midnight", {
            var initial = LearnerData(); initial.profile = profile
            initial.progressByWordId[word.id] = WordProgress(introducedOn: day(-30), nextReviewOn: day(-1))
            let (store, clock, _) = try makeStore(catalogue: catalogue, date: baseline, initial: initial)
            store.revealReview(wordId: word.id, usingHint: true)
            clock.date = day(1)
            try require(!store.review(wordId: word.id, quality: .strong, productive: true),
                        "Yesterday's hinted review was credited as a new independent attempt")
            try require(store.activities.isEmpty, "A stale review created rewards")
            store.refreshDay()
            try require(store.reviewAttempt(for: word.id) == nil, "Yesterday's hint blocked a fresh day's recall")
        }))

        var failed: [String] = []
        for (name, test) in tests {
            do { try test(); print("PASS: \(name)") }
            catch { failed.append(name); print("FAIL: \(name) — \(error)") }
        }
        print("\(tests.count - failed.count)/\(tests.count) native behavioral tests passed")
        if !failed.isEmpty { throw LaunchTestFailure(description: "Failed: \(failed.joined(separator: "; "))") }
    }
}
