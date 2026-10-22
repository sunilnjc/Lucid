import Foundation

// Every store uses a UUID-named fixture directory and explicitly saves a guest
// record first. No production account, notifications, or learner defaults are used.
enum ReminderScheduler { static func cancel() {} }
struct StudioTestFailure: Error, CustomStringConvertible { let description: String }
func studioRequire(_ condition: @autoclosure () throws -> Bool, _ message: String) throws {
    if try !condition() { throw StudioTestFailure(description: message) }
}
@MainActor final class StudioTestClock {
    var date: Date
    init(_ date: Date) { self.date = date }
}

@main @MainActor struct NativeExpressionStudioTests {
    static var directories: [URL] = []

    static func makeStore(_ catalog: ProfessionalCatalog, _ content: ExpressionContent, _ now: Date,
                          _ initial: LearnerData) throws -> (LearningStore, StudioTestClock, LearningPersistence) {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("lucid-expression-fixture-\(UUID())", isDirectory: true)
        directories.append(directory)
        let persistence = LearningPersistence(directory: directory)
        try persistence.save(initial, scope: "guest")
        let clock = StudioTestClock(now)
        return (LearningStore(catalog: catalog, expressionContent: content, persistence: persistence,
                              now: { clock.date }, accountService: nil), clock, persistence)
    }

    static func main() throws {
        guard CommandLine.arguments.count == 2 else {
            throw StudioTestFailure(description: "Usage: native-expression-tests /absolute/path/professional-content.json")
        }
        let catalogURL = URL(fileURLWithPath: CommandLine.arguments[1])
        let catalog = try JSONDecoder().decode(ProfessionalCatalog.self, from: Data(contentsOf: catalogURL))
        let contentURL = catalogURL.deletingLastPathComponent().appendingPathComponent("expression-content.json")
        let content = try JSONDecoder().decode(ExpressionContent.self, from: Data(contentsOf: contentURL))
        guard let finance = catalog.roles.first(where: { $0.id == "finance-accounting" }),
              let technology = catalog.roles.first(where: { $0.id == "technology-engineering" }),
              let expression = content.expressions.first(where: { $0.id == "explain-the-reason" }),
              let scenario = content.scenarios.first(where: { $0.expressionId == expression.id }),
              let word = catalog.words.first(where: { $0.id == expression.wordId }) else {
            throw StudioTestFailure(description: "Expected the authored rationale scenario and real role fixtures")
        }
        let today = Calendar.current.date(from: DateComponents(year: 2026, month: 10, day: 13, hour: 12))!
        func day(_ offset: Int) -> Date { today.lucidAdding(days: offset).addingTimeInterval(12 * 3600) }
        func profile(_ role: ProfessionalRole) -> LearnerProfile {
            .init(roleId: role.id, seniorityId: catalog.seniorityLevels[0].id,
                  situationIds: [role.situations[0].id], goalIds: [role.defaultGoalIds.first ?? catalog.goals[0].id])
        }
        func initial(_ role: ProfessionalRole = finance) -> LearnerData {
            var record = LearnerData(); record.profile = profile(role); return record
        }
        func evidence(_ offset: Int, kind: ContextEvidence.Kind = .unaidedRecall, quality: Int = 2,
                      independent: Bool = true, roleId: String? = nil, id: String = UUID().uuidString.lowercased()) -> ContextEvidence {
            let role = roleId ?? finance.id
            return .init(id: id, wordId: word.id, roleId: role, senseId: "\(word.id)::\(role)",
                         date: day(offset).lucidDayKey, recordedAt: day(offset), kind: kind,
                         quality: quality, independent: independent)
        }
        func withDays(_ count: Int, ending offset: Int = 0) -> LearnerData {
            var record = initial()
            record.introducedWordIds = content.expressions.filter { $0.roleIds.contains(finance.id) }.map(\.wordId)
            record.activities = (0..<count).map { index in
                let date = day(offset - count + index + 1)
                return .init(id: UUID(), kind: .practice, wordId: word.id, date: date,
                             dayKey: date.lucidDayKey, quality: 2, productive: false)
            }
            return record
        }
        func saveRecall(_ store: LearningStore, at date: Date) {
            var drafts = store.data.practiceDrafts ?? [:]
            drafts["recall:\(date.lucidDayKey):\(store.profile?.roleId ?? ""):\(word.id)"] = "We will explain the rationale for this decision in our meeting."
            store.data.practiceDrafts = drafts
            store.revealReview(wordId: word.id, usingHint: false)
        }
        func finishScenario(_ store: LearningStore, scenarioId: String, mode: String) throws {
            guard let id = store.startRehearsal(scenarioId: scenarioId, mode: mode),
                  let session = store.rehearsal(id) else { throw StudioTestFailure(description: "Could not start transfer scenario") }
            store.saveRehearsalResponse(store.rehearsalExample(session), id: id)
            store.checkRehearsal(id)
            store.setRehearsalAssessment(id, meaning: true, naturalness: true)
            try studioRequire(store.finishRehearsal(id, quality: .good), "Could not complete a fresh scenario fixture")
        }
        defer { for directory in directories { try? FileManager.default.removeItem(at: directory) } }

        var tests: [(String, () throws -> Void)] = []

        tests.append(("the exported authored studio contains coherent alternatives, nuance and unfamiliar prompts", {
            try studioRequire(content.schemaVersion == 1 && content.expressions.count >= 8 && content.scenarios.count >= 8,
                              "The exported studio curriculum is missing")
            try studioRequire(Set(content.expressions.map(\.id)).count == content.expressions.count
                              && Set(content.scenarios.map(\.id)).count == content.scenarios.count, "Authored IDs are duplicated")
            try studioRequire(Set(content.scenarios.map(\.kind)).isSuperset(of: ["meeting", "interview", "disagreement"]),
                              "Rehearsal must cover the three promised situations")
            for entry in content.expressions {
                guard let target = catalog.words.first(where: { $0.id == entry.wordId }) else {
                    throw StudioTestFailure(description: "Expression \(entry.id) points at missing vocabulary")
                }
                try studioRequire(entry.term == target.term && Set(entry.roleIds).isSubset(of: Set(target.roles)),
                                  "Expression \(entry.id) introduces an unsupported role or changed term")
                try studioRequire(!entry.plain.isEmpty && !entry.precise.isEmpty
                                  && !entry.register.isEmpty && !entry.misuse.isEmpty && !entry.collocations.isEmpty,
                                  "Expression \(entry.id) lacks natural-register guidance")
                if !entry.id.hasPrefix("catalogue:") {
                    try studioRequire(entry.plain != entry.precise && !entry.contrasts.isEmpty,
                                      "Curated expression \(entry.id) lacks authored nuance comparisons")
                }
            }
            for authored in content.scenarios {
                guard let target = content.expressions.first(where: { $0.id == authored.expressionId }) else {
                    throw StudioTestFailure(description: "Scenario points at missing expression")
                }
                try studioRequire(Set(authored.roleIds).isSubset(of: Set(target.roleIds)) && authored.wordIds.contains(target.wordId),
                                  "Scenario roles or vocabulary disagree with the expression")
                try studioRequire(!authored.prompt.isEmpty && !authored.freshPrompt.isEmpty && authored.prompt != authored.freshPrompt,
                                  "Delayed practice repeats the original situation")
                if !target.id.hasPrefix("catalogue:") {
                    try studioRequire(authored.exampleResponse != authored.freshExampleResponse,
                                      "Curated delayed practice repeats the original example")
                }
                try studioRequire(!authored.freshPrompt.localizedCaseInsensitiveContains(target.term),
                                  "The supposedly unhinted fresh prompt supplies its target term")
            }
        }))

        tests.append(("context evidence requires a UUID, role sense, bounded quality and portable calendar-day format", {
            let valid = evidence(0)
            let invalid = [
                evidence(0, id: "legacy-word-counter"),
                ContextEvidence(id: UUID().uuidString, wordId: word.id, roleId: finance.id, senseId: "different-sense",
                                date: day(0).lucidDayKey, recordedAt: day(0), kind: .unaidedRecall, quality: 2, independent: true),
                evidence(0, quality: 4),
                evidence(0, kind: .recognition, independent: true),
                ContextEvidence(id: UUID().uuidString, wordId: word.id, roleId: finance.id, senseId: "\(word.id)::\(finance.id)",
                                date: "2026/10/13", recordedAt: day(0), kind: .unaidedRecall, quality: 2, independent: true),
                ContextEvidence(id: UUID().uuidString, wordId: word.id, roleId: finance.id, senseId: "\(word.id)::\(finance.id)",
                                date: "2026-02-30", recordedAt: day(0), kind: .unaidedRecall, quality: 2, independent: true)
            ]
            try studioRequire(valid.isValid && invalid.allSatisfy { !$0.isValid }, "Malformed evidence acquired eligibility")
            var record = initial(); record.contextEvidence = [valid] + invalid
            let (store, _, _) = try makeStore(catalog, content, today, record)
            try studioRequire(store.contextEvidence == [valid] && store.recalledContextCount == 1,
                              "Malformed entries inflated fresh-recall evidence")
        }))

        tests.append(("legacy global mastery never fabricates context or production evidence", {
            var record = initial(); record.introducedWordIds = [word.id]
            record.progressByWordId[word.id] = .init(introducedOn: day(-60), nextReviewOn: day(1),
                successfulReviewDates: [day(-40), day(-20), day(-1)], mastered: true)
            record.activities = [LearningActivity(id: UUID(), kind: .review, wordId: word.id, date: day(-1),
                dayKey: day(-1).lucidDayKey, quality: 3, productive: true)]
            let (store, _, _) = try makeStore(catalog, content, today, record)
            try studioRequire(store.recognizedContextCount == 0 && store.recalledContextCount == 0
                              && store.producedContextCount == 0 && store.retainedContextCount == 0,
                              "Existing global history was silently upgraded to role-specific proof")
            try studioRequire(store.data.progressByWordId[word.id] == record.progressByWordId[word.id],
                              "Adding honest new evidence erased legacy review history")
        }))

        tests.append(("a caller cannot earn successful review credit without a frozen fresh response", {
            var record = initial(); record.introducedWordIds = [word.id]
            record.progressByWordId[word.id] = .init(introducedOn: day(-1), nextReviewOn: today)
            let (store, _, _) = try makeStore(catalog, content, today, record)
            try studioRequire(store.review(wordId: word.id, quality: .strong, productive: true), "An effort-only review should still save")
            try studioRequire(store.data.progressByWordId[word.id]?.successfulReviewDates.isEmpty == true
                              && store.activities.last?.productive == false && store.recalledContextCount == 0,
                              "A missing reviewAttempt still defaults to independent recall")
        }))

        tests.append(("a persisted independent flag cannot turn an insufficient original response into recall", {
            var record = initial(); record.introducedWordIds = [word.id]
            record.progressByWordId[word.id] = .init(introducedOn: day(-1), nextReviewOn: today)
            record.reviewAttempts = ["\(today.lucidDayKey):\(word.id)": .init(originalAttempt: word.term, independent: true)]
            let (store, _, _) = try makeStore(catalog, content, today, record)
            try studioRequire(store.review(wordId: word.id, quality: .strong, productive: true)
                              && store.recalledContextCount == 0 && store.activities.last?.productive == false,
                              "A short persisted answer bypassed the fresh-context requirement")
        }))

        tests.append(("fresh persisted review records recall separately from recognition and production", {
            var record = initial(); record.introducedWordIds = [word.id]
            record.progressByWordId[word.id] = .init(introducedOn: day(-1), nextReviewOn: today)
            let (store, _, persistence) = try makeStore(catalog, content, today, record)
            saveRecall(store, at: today)
            try studioRequire(store.review(wordId: word.id, quality: .good, productive: true), "Fresh review was rejected")
            let restored = LearningStore(catalog: catalog, expressionContent: content, persistence: persistence,
                                         now: { today }, accountService: nil)
            try studioRequire(restored.recalledContextCount == 1 && restored.producedContextCount == 0,
                              "Independent recall was mislabeled as appropriate production")
            try studioRequire(restored.evidence(kind: .unaidedRecall).allSatisfy {
                $0.roleId == finance.id && $0.senseId == "\(word.id)::\(finance.id)" && $0.independent && $0.isValid
            }, "Review lost its role/sense or generated a non-UUID event")
        }))

        tests.append(("reading the target in Library prevents a same-day review from claiming unaided recall", {
            var record = initial(); record.introducedWordIds = [word.id]
            record.progressByWordId[word.id] = .init(introducedOn: day(-1), nextReviewOn: today)
            let (store, _, _) = try makeStore(catalog, content, today, record)
            store.markContextExposure(wordId: word.id)
            saveRecall(store, at: today)
            try studioRequire(store.reviewAttempt(for: word.id)?.independent == false,
                              "Reading the word in another surface did not taint current-day recall")
            try studioRequire(store.review(wordId: word.id, quality: .strong, productive: true)
                              && store.recalledContextCount == 0 && store.activities.last?.productive == false,
                              "Exposed target acquired independent recall credit")
        }))

        tests.append(("a frozen answer from another role cannot prove recall in a newly selected sense", {
            var record = initial(); record.introducedWordIds = [word.id]
            record.progressByWordId[word.id] = .init(introducedOn: day(-1), nextReviewOn: today)
            let (store, _, _) = try makeStore(catalog, content, today, record)
            saveRecall(store, at: today)
            try studioRequire(store.reviewAttempt(for: word.id)?.independent == true, "Could not freeze the Finance recall fixture")
            store.data.profile = profile(technology)
            let accepted = store.review(wordId: word.id, quality: .good, productive: true)
            try studioRequire(store.recalledContextCount == 0
                              && (!accepted || store.activities.last?.productive == false),
                              "A frozen Finance response was relabeled as independent Technology recall")
        }))

        tests.append(("shared-word recall has separate role ledgers and one global daily review award", {
            var record = initial(); record.introducedWordIds = [word.id]
            record.progressByWordId[word.id] = .init(introducedOn: day(-40), nextReviewOn: today)
            record.contextIntroducedOn = ["\(word.id)::\(finance.id)": day(-40), "\(word.id)::\(technology.id)": day(-40)]
            record.contextEvidence = [evidence(-30), evidence(-20), evidence(-30, roleId: technology.id), evidence(-20, roleId: technology.id)]
            let (store, _, _) = try makeStore(catalog, content, today, record)
            saveRecall(store, at: today)
            try studioRequire(store.review(wordId: word.id, quality: .good, productive: true), "Finance context could not review")
            let xp = store.totalXP; let global = store.data.progressByWordId[word.id]
            store.data.profile = profile(technology)
            try studioRequire(!store.reviewedToday(word.id) && store.currentRoleDueWords.contains { $0.id == word.id },
                              "Finance recall hid the independently due Technology context")
            saveRecall(store, at: today)
            try studioRequire(store.reviewAttempt(for: word.id)?.independent == true, "Technology fixture did not capture an actual fresh role-scoped original")
            try studioRequire(store.review(wordId: word.id, quality: .good, productive: true), "Fresh Technology recall was blocked by Finance activity")
            try studioRequire(store.totalXP == xp && store.activities.filter { $0.kind == .review && $0.wordId == word.id }.count == 1
                              && store.data.progressByWordId[word.id] == global,
                              "A second role minted global review XP or rewrote the global schedule")
            for role in [finance, technology] {
                try studioRequire(store.evidence(for: role.id, kind: .unaidedRecall).filter { $0.date == today.lucidDayKey }.count == 1,
                                  "A role's fresh recall was lost or duplicated")
                store.data.profile = profile(role)
                try studioRequire(store.reviewedToday(word.id) && !store.review(wordId: word.id, quality: .strong, productive: true),
                                  "A role allowed a second same-day recall event")
            }
        }))

        tests.append(("Hard and Again context reviews return tomorrow even after an advanced interval", {
            for quality in [ReviewQuality.hard, .again] {
                var record = initial(); record.introducedWordIds = [word.id]
                record.progressByWordId[word.id] = .init(introducedOn: day(-70), intervalIndex: 4, nextReviewOn: today)
                record.contextIntroducedOn = ["\(word.id)::\(finance.id)": day(-70)]
                record.contextEvidence = [-65, -55, -48, -31].map { evidence($0) }
                let (store, _, _) = try makeStore(catalog, content, today, record)
                try studioRequire(store.contextSchedule(wordId: word.id, roleId: finance.id)?.intervalIndex == 4,
                                  "The advanced-context fixture did not reach its intended interval")
                saveRecall(store, at: today)
                try studioRequire(store.review(wordId: word.id, quality: quality, productive: false), "A difficult due review did not save")
                let schedule = store.contextSchedule(wordId: word.id, roleId: finance.id)!
                try studioRequire(schedule.nextReviewOn.lucidDayKey == day(1).lucidDayKey
                                  && schedule.intervalIndex == (quality == .hard ? 3 : 0),
                                  "A difficult context review waited its old long interval instead of tomorrow")
            }
        }))

        tests.append(("context retention needs three days and a thirty-day context anchor, not the legacy word age", {
            var record = initial()
            record.progressByWordId[word.id] = .init(introducedOn: day(-90), nextReviewOn: day(1))
            record.contextEvidence = [evidence(-2), evidence(-1), evidence(0)]
            let (store, _, _) = try makeStore(catalog, content, today, record)
            try studioRequire(!store.contextIsRetained(wordId: word.id, roleId: finance.id),
                              "A legacy introduction date made a newly used role look retained")
            store.data.contextEvidence = [evidence(-40, kind: .recognition, independent: false), evidence(-30), evidence(-20), evidence(0)]
            try studioRequire(store.contextIsRetained(wordId: word.id, roleId: finance.id),
                              "Three independent recall days with context retention were rejected")
            try studioRequire(!store.contextIsRetained(wordId: word.id, roleId: technology.id),
                              "Finance evidence was reused as Technology retention")
        }))

        tests.append(("same-day helped evidence conservatively blocks retention in both merge orders", {
            var strong = initial(); strong.progressByWordId[word.id] = .init(introducedOn: day(-50), nextReviewOn: day(1))
            strong.contextEvidence = [evidence(-40, kind: .recognition, independent: false), evidence(-30), evidence(-20), evidence(0)]
            var helped = initial(); helped.contextEvidence = [evidence(0, quality: 1, independent: false)]
            for merged in [LearningMerge.combine(local: strong, remote: helped), LearningMerge.combine(local: helped, remote: strong)] {
                let (store, _, _) = try makeStore(catalog, content, today, merged)
                try studioRequire(!store.contextIsRetained(wordId: word.id, roleId: finance.id),
                                  "Merge order promoted a conflicted helped day into retained recall")
                let repeated = LearningMerge.combine(local: merged, remote: strong)
                try studioRequire(repeated.contextEvidence == merged.contextEvidence, "Repeated sync duplicated immutable evidence")
            }
        }))

        tests.append(("expression search and saved alternatives preserve the learner's choice without learning credit", {
            let (store, _, _) = try makeStore(catalog, content, today, initial())
            try studioRequire(store.expressionMatches(text: "I want to explain the reason for our decision", goalId: "clarify")
                              .contains { $0.id == expression.id }, "Authored intent matching cannot find a relevant expression")
            let before = store.totalXP
            try studioRequire(!store.saveExpressionGap(situation: " ", expressionId: expression.id, style: "plain")
                              && !store.saveExpressionGap(situation: "A meeting", expressionId: expression.id, style: "formal"),
                              "Blank input or a nonexistent style was saved")
            try studioRequire(store.saveExpressionGap(situation: "A fictional decision discussion", expressionId: expression.id, style: "plain"),
                              "Plain-English selection could not be saved")
            try studioRequire(store.expressionGaps.first?.selectedPhrase == expression.plain
                              && store.expressionGaps.first?.selectedStyle == "plain", "Saving imposed sophisticated phrasing")
            try studioRequire(store.totalXP == before && store.data.introducedWordIds.isEmpty
                              && store.recognizedContextCount == 0 && store.producedContextCount == 0,
                              "Saving a phrase awarded practice or mastery credit")
            store.recordNuanceRecognition(expressionId: expression.id)
            store.recordNuanceRecognition(expressionId: expression.id)
            try studioRequire(store.recognizedContextCount == 1 && store.recalledContextCount == 0
                              && store.producedContextCount == 0 && store.retainedContextCount == 0
                              && store.totalXP == before,
                              "A nuance comparison was conflated with independent use or duplicated its context count")
            try studioRequire(store.data.introducedWordIds.contains(word.id) && store.data.progressByWordId[word.id] != nil
                              && store.contextHasIntroduction(wordId: word.id, roleId: finance.id)
                              && store.contextSchedule(wordId: word.id, roleId: finance.id)?.nextReviewOn.lucidDayKey == day(1).lucidDayKey,
                              "Correct recognition did not create an honest next-day review without XP")
        }))

        tests.append(("private situations, drafts and rehearsal text remain local while completed evidence can sync", {
            let (store, _, _) = try makeStore(catalog, content, today, initial())
            let privateText = "Fictional private phrase fixture ZX-482, never sent anywhere."
            try studioRequire(store.saveExpressionGap(situation: privateText, expressionId: expression.id, style: "precise"), "Could not save private fixture")
            store.saveStudioDraft(privateText, key: "gap-input")
            let id = store.startRehearsal(scenarioId: scenario.id)!
            store.saveRehearsalResponse(privateText, id: id)
            store.data.contextEvidence = [evidence(0, kind: .selfAssessedProduction)]
            let cloud = LearningMerge.cloudRecord(store.data)
            let bytes = try JSONEncoder().encode(cloud)
            try studioRequire(!String(decoding: bytes, as: UTF8.self).contains(privateText), "Cloud projection contains private learner text")
            try studioRequire(cloud.expressionGaps == nil && cloud.studioDrafts == nil && cloud.rehearsalSessions == nil,
                              "Private studio collections were projected to sync")
            try studioRequire(cloud.contextEvidence == store.data.contextEvidence, "Completed non-text evidence was stripped")
            let merged = LearningMerge.combine(local: store.data, remote: LearnerData())
            try studioRequire(merged.expressionGaps == store.data.expressionGaps && merged.studioDrafts == store.data.studioDrafts
                              && merged.rehearsalSessions == store.data.rehearsalSessions, "Ordinary sync overwrote this device's private work")
        }))

        tests.append(("role changes isolate unfinished studio text and reject stale session actions", {
            let (store, _, _) = try makeStore(catalog, content, today, initial())
            store.saveStudioDraft("Fictional finance response", key: "gap-input")
            let id = store.startRehearsal(scenarioId: scenario.id)!
            let frozen = store.rehearsal(id)!
            store.data.profile = profile(technology)
            try studioRequire(store.studioDraft("gap-input").isEmpty && store.rehearsal(id) == nil,
                              "A role switch showed another role's draft")
            store.saveRehearsalResponse("A stale view must not replace the old response", id: id)
            store.checkRehearsal(id, revealWithoutAttempt: true)
            try studioRequire(store.data.rehearsalSessions?[id.uuidString] == frozen, "A stale role view mutated another role's attempt")
            store.data.profile = profile(finance)
            try studioRequire(store.studioDraft("gap-input") == "Fictional finance response" && store.rehearsal(id) == frozen,
                              "Returning to the role lost local studio work")
        }))

        tests.append(("checking locks the original response and retries cannot create unaided-production credit", {
            let (store, _, _) = try makeStore(catalog, content, today, initial())
            let id = store.startRehearsal(scenarioId: scenario.id)!
            store.saveRehearsalResponse("My reply", id: id)
            store.checkRehearsal(id)
            try studioRequire(store.rehearsal(id)?.checked == false, "A two-word response passed the basic context gate")
            let original = "We chose this option because it saves time for the team."
            store.saveRehearsalResponse(original, id: id)
            store.checkRehearsal(id)
            store.saveRehearsalResponse(expression.precise, id: id)
            store.saveRehearsalResponse(expression.precise, id: id, retry: true)
            store.setRehearsalAssessment(id, meaning: true, naturalness: true)
            try studioRequire(store.rehearsal(id)?.response == original && store.rehearsal(id)?.retry == expression.precise,
                              "Correction replaced the frozen original")
            try studioRequire(!store.finishRehearsal(id, quality: .good), "A model-assisted retry became independent production")
            try studioRequire(store.finishRehearsal(id, quality: .hard) && store.producedContextCount == 0,
                              "An honest plain-English rehearsal could not be saved as effort")
        }))

        tests.append(("fresh rehearsal success requires explicit self-assessment and remains labeled self-assessed", {
            let (store, _, _) = try makeStore(catalog, content, today, initial())
            let id = store.startRehearsal(scenarioId: scenario.id)!
            store.saveRehearsalResponse(expression.precise, id: id)
            store.checkRehearsal(id)
            try studioRequire(!store.finishRehearsal(id, quality: .good), "Word presence alone awarded successful production")
            store.setRehearsalAssessment(id, meaning: true, naturalness: false)
            try studioRequire(!store.finishRehearsal(id, quality: .good), "Meaning confirmation silently implied naturalness")
            store.setRehearsalAssessment(id, meaning: true, naturalness: true)
            try studioRequire(store.finishRehearsal(id, quality: .good), "Fresh assessed attempt could not complete")
            try studioRequire(store.producedContextCount == 1 && store.recalledContextCount == 0
                              && store.retainedContextCount == 0, "Production was conflated with unaided recall or long-term retention")
            try studioRequire(store.data.introducedWordIds.contains(word.id) && store.data.progressByWordId[word.id] != nil
                              && store.contextHasIntroduction(wordId: word.id, roleId: finance.id)
                              && store.contextSchedule(wordId: word.id, roleId: finance.id)?.nextReviewOn.lucidDayKey == day(1).lucidDayKey
                              && store.totalXP == 0, "First actual studio use failed to create a next-day review without XP")
            try studioRequire(store.evidence(kind: .selfAssessedProduction).count == 1
                              && store.studioCheck(store.rehearsal(id)!).message.contains("does not grade"),
                              "Heuristic feedback was mislabeled semantic grading")
            try studioRequire(!store.finishRehearsal(id, quality: .strong), "Repeated completion duplicated production evidence")
        }))

        tests.append(("a previous-day frozen original stays in history and saves only supported participation today", {
            let (store, clock, _) = try makeStore(catalog, content, today, initial())
            let id = store.startRehearsal(scenarioId: scenario.id)!
            store.saveRehearsalResponse(expression.precise, id: id)
            store.checkRehearsal(id)
            store.setRehearsalAssessment(id, meaning: true, naturalness: true)
            clock.date = day(3); store.refreshDay()
            try studioRequire(!store.rehearsalOriginalIsFresh(store.rehearsal(id)!)
                              && !store.finishRehearsal(id, quality: .good), "An older original earned new independent production")
            try studioRequire(store.finishRehearsal(id, quality: .hard), "Older practice could not be saved honestly")
            let saved = store.evidence(kind: .selfAssessedProduction)
            try studioRequire(saved.count == 1 && saved[0].quality == 1 && !saved[0].independent && saved[0].capturedAt == nil,
                              "Supported completion silently dropped evidence or manufactured today's capture")
            try studioRequire(store.rehearsal(id)?.response == expression.precise && store.rehearsal(id)?.completedAt != nil
                              && store.producedContextCount == 0 && store.totalXP == 0, "Older response history changed or received learning credit")
        }))

        tests.append(("Help exposure survives relaunch and reentry without upgrading original eligibility", {
            let (store, _, persistence) = try makeStore(catalog, content, today, initial())
            let id = store.startRehearsal(scenarioId: scenario.id)!
            store.checkRehearsal(id, revealWithoutAttempt: true)
            store.saveRehearsalResponse(expression.precise, id: id, retry: true)
            store.setRehearsalAssessment(id, meaning: true, naturalness: true)
            let restored = LearningStore(catalog: catalog, expressionContent: content, persistence: persistence,
                                         now: { today }, accountService: nil)
            try studioRequire(restored.startRehearsal(scenarioId: scenario.id) == id
                              && restored.rehearsal(id)?.modelSeen == true, "Reentry started a new pristine attempt after Help")
            try studioRequire(!restored.finishRehearsal(id, quality: .strong), "Helped response received independent success")
            try studioRequire(restored.finishRehearsal(id, quality: .again) && restored.producedContextCount == 0,
                              "Helped practice was not saved honestly")
        }))

        tests.append(("exposure in an earlier rehearsal taints a new same-day attempt", {
            let (store, _, _) = try makeStore(catalog, content, today, initial())
            let first = store.startRehearsal(scenarioId: scenario.id)!
            store.checkRehearsal(first, revealWithoutAttempt: true)
            try studioRequire(store.finishRehearsal(first, quality: .again), "Could not save helped fixture")
            let second = store.startRehearsal(scenarioId: scenario.id)!
            store.saveRehearsalResponse(expression.precise, id: second)
            store.checkRehearsal(second)
            store.setRehearsalAssessment(second, meaning: true, naturalness: true)
            try studioRequire(store.rehearsal(second)?.modelSeen == true && !store.finishRehearsal(second, quality: .good),
                              "Repeating a revealed scenario on the same day laundered assisted use")
        }))

        tests.append(("reading alternatives after starting a rehearsal is detected when the response is frozen", {
            let (store, _, _) = try makeStore(catalog, content, today, initial())
            let id = store.startRehearsal(scenarioId: scenario.id)!
            try studioRequire(store.rehearsal(id)?.modelSeen == false, "Fresh fixture began as already helped")
            store.markContextExposure(wordId: word.id)
            store.saveRehearsalResponse(expression.precise, id: id)
            store.checkRehearsal(id)
            store.setRehearsalAssessment(id, meaning: true, naturalness: true)
            try studioRequire(store.rehearsal(id)?.modelSeen == true && !store.finishRehearsal(id, quality: .good),
                              "A saved session ignored alternative exposure between start and check")
            try studioRequire(store.finishRehearsal(id, quality: .hard) && store.producedContextCount == 0,
                              "A helped attempt could not be retained as honest practice")
        }))

        tests.append(("delayed gap practice starts when due and uses a different unhinted situation", {
            let (store, clock, _) = try makeStore(catalog, content, today, initial())
            try studioRequire(store.saveExpressionGap(situation: "A fictional interview", expressionId: expression.id, style: "precise"),
                              "Could not save delayed gap fixture")
            let gap = store.expressionGaps[0]
            try studioRequire(store.dueExpressionGaps.isEmpty
                              && store.startRehearsal(scenarioId: scenario.id, mode: "delayed", gapId: gap.id) == nil,
                              "A not-yet-due gap became independent delayed practice")
            clock.date = day(1); store.refreshDay()
            try studioRequire(store.dueExpressionGaps.map(\.id) == [gap.id], "The chosen phrase did not become due tomorrow")
            let id = store.startRehearsal(scenarioId: scenario.id, mode: "delayed", gapId: gap.id)!
            let session = store.rehearsal(id)!
            try studioRequire(store.rehearsalPrompt(session) == scenario.freshPrompt
                              && store.rehearsalExample(session) == scenario.freshExampleResponse,
                              "Delayed practice reused its familiar situation")
            store.saveRehearsalResponse(scenario.freshExampleResponse, id: id); store.checkRehearsal(id)
            store.setRehearsalAssessment(id, meaning: true, naturalness: true)
            try studioRequire(store.finishRehearsal(id, quality: .good), "Due delayed response could not be saved")
            try studioRequire(store.expressionGaps[0].lastPractisedAt == clock.date
                              && store.expressionGaps[0].nextReviewOn.lucidDayKey == day(4).lucidDayKey,
                              "Successful delayed practice did not update its own revisit schedule")
        }))

        tests.append(("the fifth-day challenge is cumulative, bounded to three and resume-safe across later milestones", {
            let (store, _, _) = try makeStore(catalog, content, today, withDays(4))
            try studioRequire(!store.fifthDayChallengeDue && store.startTransfer(mode: "transfer") == nil,
                              "A cumulative challenge appeared before five practice days")
            store.data = withDays(5)
            let key = store.startTransfer(mode: "transfer")!
            let first = store.data.transferSessions![key]!
            try studioRequire(first.milestone == 5 && first.scenarioIds.count == 3
                              && Set(first.scenarioIds).count == 3 && first.completedScenarioIds.isEmpty,
                              "A fifth-day challenge is unbounded, duplicated, or already complete")
            var later = withDays(10); later.transferSessions = store.data.transferSessions
            store.data = later
            try studioRequire(store.startTransfer(mode: "transfer") == key,
                              "Crossing another milestone stranded the unfinished fifth-day challenge")
            try studioRequire(store.data.transferSessions?.count == 1, "Resuming created a duplicate challenge")
            for scenarioId in first.scenarioIds { try finishScenario(store, scenarioId: scenarioId, mode: "transfer") }
            try studioRequire(store.data.transferSessions?[key]?.completedAt != nil,
                              "Finishing all frozen scenarios failed to close the challenge")
            let next = store.startTransfer(mode: "transfer")!
            try studioRequire(next != key && store.data.transferSessions?[next]?.milestone == 10,
                              "A later legitimate milestone was lost after the pending one completed")
        }))

        tests.append(("comeback practice is short, available after absence and suppressed after honest completion", {
            let (store, _, _) = try makeStore(catalog, content, today, withDays(1, ending: -4))
            try studioRequire(store.daysAway == 4 && store.comebackSuggested, "Four days away did not suggest a short comeback")
            let key = store.startTransfer(mode: "comeback")!
            let session = store.data.transferSessions![key]!
            try studioRequire((1...3).contains(session.scenarioIds.count), "Comeback reproduced the full overdue backlog")
            for scenarioId in session.scenarioIds { try finishScenario(store, scenarioId: scenarioId, mode: "comeback") }
            try studioRequire(!store.comebackSuggested && store.startTransfer(mode: "comeback") == nil,
                              "Completed comeback was suggested repeatedly on the same day")
        }))

        tests.append(("five studio-only practice days trigger transfer without inventing word or mastery credit", {
            let (store, clock, _) = try makeStore(catalog, content, today, initial())
            for offset in 0..<5 {
                clock.date = day(offset); store.refreshDay()
                let id = store.startRehearsal(scenarioId: scenario.id)!
                store.saveRehearsalResponse("We selected this option because it suits our short time window.", id: id)
                store.checkRehearsal(id)
                try studioRequire(store.finishRehearsal(id, quality: .hard), "Could not save an honest unscored studio day")
            }
            try studioRequire(store.practiceDayKeys.count == 5 && store.fifthDayChallengeDue
                              && store.startTransfer(mode: "transfer") != nil,
                              "Studio-only activity cannot reach its promised cumulative challenge")
            try studioRequire(store.data.introducedWordIds.isEmpty && store.data.progressByWordId.isEmpty
                              && store.recalledContextCount == 0 && store.producedContextCount == 0 && store.totalXP == 0,
                              "Counting studio attendance fabricated vocabulary credit")
            let (nuanceStore, nuanceClock, _) = try makeStore(catalog, content, today, initial())
            for offset in 0..<5 {
                nuanceClock.date = day(offset); nuanceStore.refreshDay()
                nuanceStore.recordNuanceRecognition(expressionId: expression.id)
            }
            try studioRequire(nuanceStore.practiceDayKeys.count == 5 && nuanceStore.fifthDayChallengeDue
                              && nuanceStore.startTransfer(mode: "transfer") != nil
                              && nuanceStore.contextHasIntroduction(wordId: word.id, roleId: finance.id)
                              && nuanceStore.recognizedContextCount == 1 && nuanceStore.recalledContextCount == 0
                              && nuanceStore.producedContextCount == 0 && nuanceStore.retainedContextCount == 0
                              && nuanceStore.totalXP == 0,
                              "Recognition-only contexts were ignored when selecting cumulative transfer")
            try studioRequire(nuanceStore.data.contextIntroducedOn?["\(word.id)::\(finance.id)"]?.timeIntervalSince1970 == 1_791_892_800,
                              "The context anchor depends on the device's timezone instead of the recorded UTC calendar date")
            nuanceClock.date = day(8); nuanceStore.refreshDay()
            try studioRequire(nuanceStore.daysAway == 4 && nuanceStore.comebackSuggested,
                              "Nuance-only attendance was ignored when calculating comeback absence")
        }))

        tests.append(("a ten-word discovery collection stays read-only and retains a small daily goal", {
            let (store, _, persistence) = try makeStore(catalog, content, today, initial())
            store.finishOnboarding(profile: profile(finance), goal: 2)
            let before = store.data; let revision = store.dataRevision; let xp = store.totalXP
            for _ in 0..<20 {
                let collection = store.discoveryWords
                try studioRequire(collection.count == 10 && Set(collection.map(\.id)).count == 10
                                  && collection.allSatisfy { $0.roles.contains(finance.id) }, "Discovery is not a ten-word role collection")
            }
            try studioRequire(store.data == before && store.dataRevision == revision && store.totalXP == xp
                              && store.data.dailyWordGoal == 2 && store.data.introducedWordIds.isEmpty,
                              "Browsing discovery changed goal, progress, evidence or XP")
            try studioRequire(try persistence.load(scope: "guest").data == before, "Read-only discovery rewrote learner storage")
        }))

        tests.append(("backup restoration unions private IDs and preserves Help against a stronger stale session", {
            let (store, _, _) = try makeStore(catalog, content, today, initial())
            try studioRequire(store.saveExpressionGap(situation: "Local fictional gap", expressionId: expression.id, style: "plain"), "Could not save local gap")
            let id = store.startRehearsal(scenarioId: scenario.id)!
            store.saveRehearsalResponse("The team needs a little more context before deciding.", id: id)
            store.checkRehearsal(id, revealWithoutAttempt: true)
            store.saveStudioDraft("Local studio draft", key: "gap-input")
            let local = store.data
            var incoming = local
            let incomingGap = ExpressionGap(id: UUID(), roleId: finance.id, expressionId: expression.id, createdAt: day(-1),
                situation: "Incoming fictional gap", selectedStyle: "precise", selectedPhrase: expression.precise,
                nextReviewOn: day(1))
            incoming.expressionGaps = (incoming.expressionGaps ?? []) + [incomingGap]
            var stale = incoming.rehearsalSessions![id.uuidString]!
            stale.modelSeen = false; stale.response = expression.precise
            incoming.rehearsalSessions = [id.uuidString: stale]
            incoming.studioDrafts = ["\(finance.id):gap-input": "Incoming studio draft"]
            incoming.contextEvidence = [evidence(0)]
            for restored in [LearningMerge.restoringBackup(local: local, incoming: incoming, restoreProfile: false),
                             LearningMerge.restoringBackup(local: incoming, incoming: local, restoreProfile: false)] {
                try studioRequire(Set(restored.expressionGaps!.map(\.id)).count == 2, "Backup lost or duplicated a saved expression ID")
                try studioRequire(restored.rehearsalSessions?[id.uuidString]?.modelSeen == true
                                  && restored.rehearsalSessions?[id.uuidString]?.checked == true,
                                  "Restoring a stale independent copy cleared persisted Help")
                let repeated = LearningMerge.restoringBackup(local: restored, incoming: incoming, restoreProfile: false)
                try studioRequire(repeated.expressionGaps?.count == 2 && repeated.contextEvidence?.count == 1,
                                  "Repeated restore duplicated gaps or UUID evidence")
            }
        }))

        tests.append(("older v2 JSON decodes without studio fields and optional opaque web data round-trips", {
            var record = initial(); record.introducedWordIds = [word.id]
            var object = try JSONSerialization.jsonObject(with: JSONEncoder().encode(record)) as! [String: Any]
            for key in ["contextEvidence", "expressionGaps", "rehearsalSessions", "transferSessions", "studioDrafts", "expressionStudio"] {
                object.removeValue(forKey: key)
            }
            let decoded = try JSONDecoder().decode(LearnerData.self, from: JSONSerialization.data(withJSONObject: object))
            try studioRequire(decoded.introducedWordIds == [word.id] && decoded.contextEvidence == nil
                              && decoded.expressionGaps == nil, "Optional metadata broke existing learner backup decoding")
            let opaque = StudioJSONValue.object(["saved": .array([.object(["id": .string("web-gap"), "completed": .bool(false)])]), "version": .number(1)])
            let roundTrip = try JSONDecoder().decode(StudioJSONValue.self, from: JSONEncoder().encode(opaque))
            try studioRequire(roundTrip == opaque, "Native cannot preserve opaque web studio data through backup")
        }))

        tests.append(("portable web companion survives an actual native export and import without becoming credit", {
            var record = initial()
            let companion = StudioJSONValue.object(["schemaVersion": .number(1), "expressionStudio": .object([
                "gaps": .array([.object(["id": .string("fictional-web-gap"), "situation": .string("Fictional web situation")])])
            ])])
            record.portableWebCompanion = companion
            let document = try LucidBackupDocument(data: record)
            let envelope = try JSONDecoder().decode(LearningPersistence.Envelope.self, from: document.content)
            try studioRequire(envelope.webLearningBackup == companion && envelope.learner.portableWebCompanion == nil,
                              "Portable data was dropped or duplicated inside native learner state")
            let (store, _, persistence) = try makeStore(catalog, content, today, initial())
            let url = persistence.directory.appendingPathComponent("fixture-portable-import.json")
            try document.content.write(to: url)
            try store.importBackup(from: url)
            try studioRequire(store.data.portableWebCompanion == companion && store.recalledContextCount == 0
                              && store.producedContextCount == 0 && store.totalXP == 0,
                              "Opaque web work was lost or interpreted as native learning proof")
            let cloud = LearningMerge.cloudRecord(store.data)
            try studioRequire(cloud.portableWebCompanion == nil, "Private imported web backup was uploaded through native sync")
            let exported = try JSONDecoder().decode(LearningPersistence.Envelope.self,
                from: LucidBackupDocument(data: store.data).content)
            try studioRequire(exported.webLearningBackup == companion, "A second export lost the web companion")
        }))

        tests.append(("a legacy backup preserves global history and today's completed plan without inventing role credit", {
            var legacy = initial()
            legacy.introducedWordIds = [word.id]
            legacy.progressByWordId[word.id] = .init(introducedOn: day(-60), intervalIndex: 4,
                nextReviewOn: day(2), lastReviewedOn: day(-3), reviewCount: 7,
                successfulReviewDates: [day(-40), day(-20), day(-3)], lapses: 1, mastered: true)
            legacy.currentLessonDate = today.lucidStartOfDay; legacy.lessonDayKey = today.lucidDayKey
            legacy.lessonRoleId = finance.id; legacy.currentWordIds = [word.id]; legacy.completedWordIdsToday = [word.id]
            legacy.sessions = [.init(id: UUID(), date: today.lucidStartOfDay, wordIds: [word.id], completedAt: today,
                                     dayKey: today.lucidDayKey)]
            legacy.activities = [
                .init(id: UUID(), kind: .practice, wordId: word.id, date: day(-7), dayKey: day(-7).lucidDayKey,
                      quality: 2, productive: false),
                .init(id: UUID(), kind: .lesson, wordId: nil, date: today, dayKey: today.lucidDayKey,
                      quality: 2, productive: true)
            ]
            legacy.favouriteWordIds = [word.id]
            let (store, _, persistence) = try makeStore(catalog, content, today, initial())
            let url = persistence.directory.appendingPathComponent("fixture-legacy-preservation.json")
            try LucidBackupDocument(data: legacy).content.write(to: url)
            try store.importBackup(from: url)
            try studioRequire(store.data.progressByWordId[word.id] == legacy.progressByWordId[word.id]
                              && store.data.introducedWordIds == legacy.introducedWordIds
                              && store.data.sessions == legacy.sessions
                              && Set(store.activities.map(\.id)) == Set(legacy.activities!.map(\.id))
                              && store.data.favouriteWordIds == legacy.favouriteWordIds,
                              "Import changed legacy review schedules, counters, event IDs, sessions or bookmarks")
            try studioRequire(store.data.currentWordIds == [word.id] && store.data.completedWordIdsToday.contains(word.id)
                              && store.isTodayComplete && !store.completeToday() && store.totalXP == 30,
                              "Legacy current-day completion was discarded or rewarded again")
            try studioRequire(store.data.contextIntroducedOn?.isEmpty != false && store.contextEvidence.isEmpty
                              && store.pathCompletedWordCount == 0 && store.recalledContextCount == 0
                              && store.producedContextCount == 0 && store.retainedContextCount == 0,
                              "Legacy global history was promoted to a new role/sense completion or mastery")
        }))

        tests.append(("invalid imported context evidence rejects the entire backup without partial mutation", {
            let (store, _, persistence) = try makeStore(catalog, content, today, initial())
            let before = store.data; let revision = store.dataRevision
            var invalid = initial(); invalid.introducedWordIds = [word.id]
            invalid.contextEvidence = [evidence(0, id: "counter-not-uuid")]
            let url = persistence.directory.appendingPathComponent("fixture-invalid-evidence.json")
            let envelope = LearningPersistence.Envelope(version: 2, learner: invalid)
            try JSONEncoder().encode(envelope).write(to: url)
            var rejected = false
            do { try store.importBackup(from: url) } catch { rejected = true }
            try studioRequire(rejected && store.data == before && store.dataRevision == revision,
                              "Malformed backup partially applied its progress before failing")
            try studioRequire(try persistence.load(scope: "guest").data == before,
                              "Rejected backup replaced the durable learner record")
            var invalidAnchor = initial()
            invalidAnchor.contextIntroducedOn = ["\(word.id)::nonexistent-role": day(-90)]
            try JSONEncoder().encode(LearningPersistence.Envelope(version: 2, learner: invalidAnchor)).write(to: url)
            rejected = false
            do { try store.importBackup(from: url) } catch { rejected = true }
            try studioRequire(rejected && store.data == before,
                              "An unsupported context-retention anchor was accepted from backup")
        }))

        tests.append(("conflicting copies of one evidence UUID cannot describe different roles or kinds in a backup", {
            let (store, _, persistence) = try makeStore(catalog, content, today, initial())
            let before = store.data
            let duplicateID = UUID().uuidString.lowercased()
            var incoming = initial()
            incoming.contextEvidence = [evidence(0, id: duplicateID),
                evidence(0, kind: .selfAssessedProduction, roleId: technology.id, id: duplicateID)]
            let url = persistence.directory.appendingPathComponent("fixture-ambiguous-evidence.json")
            try JSONEncoder().encode(LearningPersistence.Envelope(version: 2, learner: incoming)).write(to: url)
            var rejected = false
            do { try store.importBackup(from: url) } catch { rejected = true }
            try studioRequire(rejected && store.data == before, "A duplicate UUID assigned to different contexts was silently merged")
        }))

        var failures = 0
        for (name, run) in tests {
            do { try run(); print("PASS: \(name)") }
            catch { failures += 1; print("FAIL: \(name): \(error)") }
        }
        print("\(tests.count - failures)/\(tests.count) expression-studio regression groups passed")
        if failures > 0 { exit(1) }
    }
}
