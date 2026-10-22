import SwiftUI

struct ExpressionStudioView: View {
    @EnvironmentObject private var store: LearningStore
    @State private var selectedGoal = "clarify"
    @State private var selectedTheme = "all"
    @State private var activeRehearsal: UUID?
    @State private var activeTransfer: String?
    @State private var notice: String?
    @State private var comparisonsVisible = false
    @State private var discoveryVisible = false
    @State private var notebookVisible = false
    private var situation: Binding<String> { Binding(get: { store.studioDraft("gap") }, set: { store.saveStudioDraft($0, key: "gap") }) }
    private var matches: [StudioExpression] { store.expressionMatches(text: situation.wrappedValue, goalId: selectedGoal).filter { selectedTheme == "all" || $0.theme == selectedTheme } }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                PracticeStatusBanner()
                PageHeading(eyebrow: "FROM INTENTION TO EXPRESSION", title: "Find words for your next conversation.", description: "Capture what you wanted to say, choose natural phrasing, and try it again in a different situation.")
                Text("Selected authored phrasing and practice checkpoints sync with your verified account. Lucid stores personal situations and responses on this device. Native speech uses Apple’s existing speech service. Alternatives match keywords and your selected goal; the local phrase check cannot assess meaning, grammar or naturalness.")
                    .font(.subheadline).foregroundStyle(LucidColour.secondaryOnDark)
                if let notice { Text(notice).foregroundStyle(LucidColour.mint).accessibilityIdentifier("studio.notice") }
                if store.expressionContent == nil {
                    EmptyState(icon: "books.vertical", title: "Expression practice is unavailable", message: "The authored practice collection could not be opened. Your existing lessons and saved progress remain available.")
                } else {
                    comebackCard
                    transferCard
                    notebookCard
                    if !store.dueExpressionGaps.isEmpty {
                        VStack(alignment: .leading, spacing: 14) {
                            Text("A different situation, without a hint").font(.title2.bold())
                            Text("Up to three saved expressions are ready to revisit. Start with the new situation; your chosen phrase stays hidden until you check.").foregroundStyle(LucidColour.secondaryOnDark)
                            ForEach(Array(store.dueExpressionGaps.prefix(3))) { gap in
                                if let scenario = store.studioScenarios.first(where: { $0.expressionId == gap.expressionId }) {
                                    Button("Try a new situation · \(store.studioExpressions.first(where: { $0.id == gap.expressionId })?.title ?? "Saved expression")") {
                                        activeRehearsal = store.startRehearsal(scenarioId: scenario.id, mode: "delayed", gapId: gap.id)
                                    }.buttonStyle(.bordered).frame(minHeight: 44)
                                }
                            }
                        }.studioPanel()
                    }
                    rehearsalCard
                    let completedHistory = (store.data.rehearsalSessions ?? [:]).values.filter { $0.roleId == store.profile?.roleId && $0.completedAt != nil }.sorted { $0.completedAt! > $1.completedAt! }
                    if !completedHistory.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Practice history").font(.title2.bold())
                            Text("Checkpoints follow your account. Responses remain on the device where you wrote them.").foregroundStyle(LucidColour.secondaryOnDark)
                            ForEach(Array(completedHistory.prefix(20))) { session in
                                Button {
                                    activeRehearsal = session.id
                                } label: {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(store.rehearsalScenario(session)?.focus ?? "Saved practice").font(.headline)
                                        Text(session.completedAt!, style: .date).font(.caption)
                                    }.frame(maxWidth: .infinity, alignment: .leading)
                                }.buttonStyle(.bordered).accessibilityIdentifier("studio.history.\(session.id.uuidString.lowercased())")
                            }
                        }.studioPanel()
                    }
                    VStack(alignment: .leading, spacing: 14) {
                        Text("Choose the wording that fits").font(.title2.bold())
                        Text("Practise nearby meanings, collocations and register. A sophisticated term is useful only when it makes your meaning clearer.").foregroundStyle(LucidColour.secondaryOnDark)
                        ForEach(Array(store.studioExpressions.filter { !$0.contrasts.isEmpty }.prefix(12))) { expression in
                            NavigationLink(expression.title) { NuancePracticeView(expression: expression) }.frame(minHeight: 44)
                        }
                    }.studioPanel()
                    VStack(alignment: .leading, spacing: 14) {
                        Text("Ten-word discovery collection").font(.title2.bold())
                        Text("Browse at your own pace. Discovery does not introduce a word, complete a lesson or award recall credit. Your daily learning goal remains \(store.dailyGoal).")
                            .foregroundStyle(LucidColour.secondaryOnDark)
                        Button(discoveryVisible ? "Hide discovery collection" : "Browse ten words") {
                        discoveryVisible.toggle()
                        if discoveryVisible { store.markContextExposures(wordIds: store.discoveryWords.map(\.id)) }
                    }.buttonStyle(.bordered)
                    if discoveryVisible { ForEach(store.discoveryWords) { word in
                            NavigationLink { WordDetailView(word: word) } label: {
                                VStack(alignment: .leading, spacing: 4) { Text(word.term).font(.headline); Text(word.meaning).font(.subheadline).foregroundStyle(LucidColour.secondaryOnDark) }.frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 6)
                            }.buttonStyle(.plain)
                        }
                    } }.studioPanel()
                    if !store.expressionGaps.isEmpty {
                        VStack(alignment: .leading, spacing: 14) {
                            Text("What I wanted to say").font(.title2.bold())
                            Button(notebookVisible ? "Hide saved phrasing" : "Read saved phrasing") {
                                notebookVisible.toggle()
                                if notebookVisible { store.markContextExposures(wordIds: store.expressionGaps.compactMap { gap in store.studioExpressions.first(where: { $0.id == gap.expressionId })?.wordId }) }
                            }.buttonStyle(.bordered).accessibilityIdentifier("studio.notebook")
                            if notebookVisible { ForEach(store.expressionGaps) { gap in
                                VStack(alignment: .leading, spacing: 8) {
                                    Text(gap.situation.isEmpty ? "Personal situation stays on its original device." : gap.situation).font(.subheadline).foregroundStyle(LucidColour.secondaryOnDark)
                                    Text(gap.selectedPhrase).font(.headline).accessibilityIdentifier("studio.notebook.\(gap.id.uuidString.lowercased())")
                                    Text("Next practice: \(gap.nextReviewOn, style: .date)").font(.caption)
                                }.padding(.vertical, 8)
                            } }
                        }.studioPanel()
                    }
                }
            }.padding(22).frame(maxWidth: 720).frame(maxWidth: .infinity)
        }
        .background(LucidNightBackground().ignoresSafeArea())
        .lucidKeyboardDismissal()
        .navigationTitle("Expression studio").navigationBarTitleDisplayMode(.inline)
        .navigationDestination(item: $activeRehearsal) { id in RehearsalWorkspaceView(sessionId: id) }
        .navigationDestination(item: $activeTransfer) { id in TransferWorkspaceView(sessionId: id) }
        .onChange(of: store.practiceAccountToken) { _, _ in activeRehearsal = nil; activeTransfer = nil; notice = nil; comparisonsVisible = false; discoveryVisible = false; notebookVisible = false }
        .onChange(of: store.profile?.roleId) { _, _ in activeRehearsal = nil; activeTransfer = nil; comparisonsVisible = false; discoveryVisible = false; notebookVisible = false }
        .onChange(of: situation.wrappedValue) { _, _ in comparisonsVisible = false }
        .onChange(of: selectedGoal) { _, _ in comparisonsVisible = false }
        .onChange(of: selectedTheme) { _, _ in comparisonsVisible = false }
    }
    private var notebookCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("What I wanted to say").font(.title2.bold())
            Text("Describe an expression gap or situation. Compare examples and choose the phrasing that fits your audience.").foregroundStyle(LucidColour.secondaryOnDark)
            TextEditor(text: situation).frame(minHeight: 110).padding(8).scrollContentBackground(.hidden)
                .background(LucidColour.midnight, in: RoundedRectangle(cornerRadius: 12))
                .accessibilityLabel("The situation or idea I wanted to express").accessibilityIdentifier("studio.gap")
            Picker("Communication goal", selection: $selectedGoal) {
                ForEach(store.expressionContent?.goals ?? []) { goal in Text(goal.label).tag(goal.id) }
            }
            Picker("Theme", selection: $selectedTheme) {
                Text("All themes").tag("all"); Text("Emotions").tag("emotions"); Text("Intellectual").tag("intellectual"); Text("Leadership").tag("leadership")
            }
            if matches.isEmpty {
                Text("No authored comparison matches this goal or wording for your role yet. Try another goal or browse the scenarios below. Lucid has not generated a personalised rewrite.").font(.subheadline).foregroundStyle(LucidColour.secondaryOnDark)
            }
            Button("Compare authored alternatives") {
                comparisonsVisible = true
                store.markContextExposures(wordIds: Array(matches.prefix(3)).map(\.wordId))
            }.buttonStyle(.bordered).disabled(matches.isEmpty)
            if comparisonsVisible { ForEach(Array(matches.prefix(3))) { expression in
                VStack(alignment: .leading, spacing: 12) {
                    Text(expression.title).font(.headline)
                    CardDetail(label: "PLAIN", text: expression.plain)
                    Button("Save the plain phrasing") { save(expression, style: "plain") }.buttonStyle(.bordered).disabled(situation.wrappedValue.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    CardDetail(label: "MORE PRECISE", text: expression.precise)
                    Button("Save the precise phrasing") { save(expression, style: "precise") }.buttonStyle(.bordered).disabled(situation.wrappedValue.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    CardDetail(label: "DIPLOMATIC", text: expression.diplomatic)
                    Button("Save the diplomatic phrasing") { save(expression, style: "diplomatic") }.buttonStyle(.bordered).disabled(situation.wrappedValue.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    Text(expression.register).font(.subheadline).foregroundStyle(LucidColour.secondaryOnDark)
                }.padding(.vertical, 8)
            } }
        }.studioPanel()
    }
    private func save(_ expression: StudioExpression, style: String) {
        if store.saveExpressionGap(situation: situation.wrappedValue, expressionId: expression.id, style: style) { notice = "Authored phrasing saved. Your personal situation stays on this device. Revisit the phrase tomorrow." }
        else { notice = "The phrase could not be saved yet. Check the storage notice and try again." }
    }
    private var rehearsalCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Rehearse tomorrow").font(.title2.bold())
            Text("Try a meeting, interview or disagreement before seeing the target phrase. Compare a focused example, then retry. The retry is guided practice.").foregroundStyle(LucidColour.secondaryOnDark)
            ForEach(["meeting", "interview", "disagreement"], id: \.self) { kind in
                Text(kind.capitalized).font(.headline)
                ForEach(Array(store.studioScenarios.filter { $0.kind == kind }.prefix(3))) { scenario in
                    Button(scenario.focus) { activeRehearsal = store.startRehearsal(scenarioId: scenario.id) }.buttonStyle(.bordered).frame(minHeight: 44)
                }
            }
        }.studioPanel()
    }
    @ViewBuilder private var transferCard: some View {
        if store.fifthDayChallengeDue {
            VStack(alignment: .leading, spacing: 12) {
                Text("Your fifth-day transfer challenge").font(.title2.bold())
                Text("Revisit up to three familiar expressions in unfamiliar situations. No new words or mastery awards from checking a phrase.").foregroundStyle(LucidColour.secondaryOnDark)
                Button("Start the cumulative challenge") { activeTransfer = store.startTransfer(mode: "transfer") }.buttonStyle(.borderedProminent).tint(LucidColour.mint).foregroundStyle(LucidColour.midnight)
            }.studioPanel()
        }
    }
    @ViewBuilder private var comebackCard: some View {
        if store.comebackSuggested {
            VStack(alignment: .leading, spacing: 12) {
                Text("A small restart").font(.title2.bold())
                Text("Welcome back. Try up to three familiar situations, then choose your next step. Your existing reviews remain available.").foregroundStyle(LucidColour.secondaryOnDark)
                Button("Try a short comeback session") { activeTransfer = store.startTransfer(mode: "comeback") }.buttonStyle(.bordered)
            }.studioPanel()
        }
    }
}

struct RehearsalWorkspaceView: View {
    @EnvironmentObject private var store: LearningStore
    let sessionId: UUID
    @State private var saveNotice: String?
    private func response(_ retry: Bool = false) -> Binding<String> { Binding(get: { retry ? store.rehearsal(sessionId)?.retry ?? "" : store.rehearsal(sessionId)?.response ?? "" }, set: { store.saveRehearsalResponse($0, id: sessionId, retry: retry) }) }
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                PracticeStatusBanner()
                if let session = store.rehearsal(sessionId), let expression = store.rehearsalExpression(session) {
                    Text(session.mode == "rehearsal" ? "REHEARSE TOMORROW" : "TRANSFER TO A NEW SITUATION").font(.caption.bold()).foregroundStyle(LucidColour.mint)
                    Text(store.rehearsalPrompt(session)).font(.title2).accessibilityIdentifier("studio.scenario")
                    if session.completedAt != nil {
                        Text(session.receivedFromSync == true && session.response.isEmpty ? "Practice checkpoint synced." : "Practice saved. Your original response and retry remain on this device.").font(.headline).foregroundStyle(LucidColour.mint)
                        if session.receivedFromSync == true && session.response.isEmpty { Text("Completed on another device. Its private response stays there.").foregroundStyle(LucidColour.secondaryOnDark) }
                        else { CardDetail(label: "YOUR ORIGINAL RESPONSE", text: session.response) }
                        if !session.retry.isEmpty { CardDetail(label: "YOUR GUIDED RETRY", text: session.retry) }
                        Text("This is practice evidence and your own assessment, not verified semantic mastery.").foregroundStyle(LucidColour.secondaryOnDark)
                    } else if !session.checked {
                        if session.receivedFromSync == true { Text("The scenario checkpoint was synced. Continue here; the earlier private response stays on its original device.").foregroundStyle(LucidColour.secondaryOnDark) }
                        Text("Respond without a target-word hint. Plain phrasing is welcome. Write at least four words before checking.").foregroundStyle(LucidColour.secondaryOnDark)
                        TextEditor(text: response()).frame(minHeight: 160).padding(8).scrollContentBackground(.hidden).background(LucidColour.midnight, in: RoundedRectangle(cornerRadius: 12)).accessibilityLabel("Unhinted response to the situation").accessibilityIdentifier("studio.response")
                        Button("Check and compare") { store.checkRehearsal(sessionId) }.buttonStyle(.borderedProminent).disabled(session.response.split(whereSeparator: \.isWhitespace).count < 4)
                        Button("I need a hint") { store.checkRehearsal(sessionId, revealWithoutAttempt: true) }.buttonStyle(.bordered)
                    } else {
                        CardDetail(label: "YOUR ORIGINAL RESPONSE", text: session.response)
                        Text(store.studioCheck(session).message).foregroundStyle(LucidColour.secondaryOnDark)
                        CardDetail(label: "ONE FOCUS", text: expression.collocations.first.map { "Compare the construction “\($0)”." } ?? expression.register)
                        CardDetail(label: "AUTHORED EXAMPLE", text: store.rehearsalExample(session))
                        CardDetail(label: "REGISTER", text: expression.register)
                        CardDetail(label: "WATCH OUT", text: expression.misuse)
                        Text("Try one focused correction. This retry follows the example and does not count as independent use.").foregroundStyle(LucidColour.secondaryOnDark)
                        TextEditor(text: response(true)).frame(minHeight: 120).padding(8).scrollContentBackground(.hidden).background(LucidColour.midnight, in: RoundedRectangle(cornerRadius: 12)).accessibilityLabel("Guided retry").accessibilityIdentifier("studio.retry")
                        if !session.retry.isEmpty { Text(store.studioCheck(session, retry: true).message).font(.subheadline) }
                        Toggle("My original response fits the meaning", isOn: Binding(get: { store.rehearsal(sessionId)?.meaningConfirmed ?? false }, set: { store.setRehearsalAssessment(sessionId, meaning: $0, naturalness: session.naturalnessConfirmed) }))
                        Toggle("My original response fits the audience naturally", isOn: Binding(get: { store.rehearsal(sessionId)?.naturalnessConfirmed ?? false }, set: { store.setRehearsalAssessment(sessionId, meaning: session.meaningConfirmed, naturalness: $0) }))
                        Text("These are your assessments. Word presence is not evidence of correct meaning or register. A plain response can communicate well without earning target-term credit.").font(.subheadline).foregroundStyle(LucidColour.secondaryOnDark)
                        if !store.rehearsalOriginalIsFresh(session) { Text("This original response was saved on an earlier learning day. Save Again or Hard as supported practice, or start a fresh scenario for independent use today.").foregroundStyle(LucidColour.secondaryOnDark) }
                        ForEach(ReviewQuality.allCases) { quality in
                            Button(quality.rawValue >= 2 ? "Save \(quality.label.lowercased()) · self-assessed original" : "Save \(quality.label.lowercased()) · useful practice") {
                                if store.finishRehearsal(sessionId, quality: quality) { saveNotice = "Practice saved." } else { saveNotice = "To claim independent target-term use, compare the original meaning and audience, with a fresh response today and no hint. Otherwise save Again or Hard." }
                            }.buttonStyle(.bordered).disabled(quality.rawValue >= 2 && (session.modelSeen || !store.rehearsalOriginalIsFresh(session) || !store.studioCheck(session).termFound || !session.meaningConfirmed || !session.naturalnessConfirmed))
                        }
                    }
                    if let saveNotice { Text(saveNotice).foregroundStyle(LucidColour.mint) }
                } else { EmptyState(icon: "text.bubble", title: "Open your current practice", message: "This response belongs to another role or account. Return to Expression studio to continue the current collection.") }
            }.padding(22).frame(maxWidth: 720).frame(maxWidth: .infinity)
        }.background(LucidNightBackground().ignoresSafeArea()).foregroundStyle(LucidColour.textOnDark).lucidKeyboardDismissal().navigationTitle("Rehearsal").navigationBarTitleDisplayMode(.inline)
    }
}

struct TransferWorkspaceView: View {
    @EnvironmentObject private var store: LearningStore
    let sessionId: String
    @State private var activeRehearsal: UUID?
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                if let session = store.data.transferSessions?[sessionId], session.roleId == store.profile?.roleId {
                    Text(session.mode == "comeback" ? "A small restart" : "Cumulative transfer challenge").font(.title.bold())
                    Text("\(session.completedScenarioIds.count) of \(session.scenarioIds.count) situations completed. The target phrasing stays hidden until your response. These are unfamiliar prompts for familiar language.").foregroundStyle(LucidColour.secondaryOnDark)
                    ForEach(session.scenarioIds, id: \.self) { id in
                        if let scenario = store.studioScenarios.first(where: { $0.id == id }) {
                            Button(session.completedScenarioIds.contains(id) ? "Completed · \(scenario.kind) situation" : "Try \(scenario.kind) situation") {
                                activeRehearsal = store.startRehearsal(scenarioId: id, mode: session.mode)
                            }.buttonStyle(.bordered).disabled(session.completedScenarioIds.contains(id))
                        }
                    }
                    if session.completedAt != nil { Text("Session complete. Your reviews and small daily goal are ready when you choose.").foregroundStyle(LucidColour.mint) }
                } else { Text("Return to the studio for your current collection.") }
            }.padding(22)
        }.background(LucidNightBackground().ignoresSafeArea()).foregroundStyle(LucidColour.textOnDark)
            .navigationDestination(item: $activeRehearsal) { id in RehearsalWorkspaceView(sessionId: id) }
    }
}

struct NuancePracticeView: View {
    @EnvironmentObject private var store: LearningStore
    let expression: StudioExpression
    @State private var choices: [Int: Bool] = [:]
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text(expression.title).font(.title.bold())
                CardDetail(label: "PLAIN", text: expression.plain)
                CardDetail(label: "MORE PRECISE", text: expression.precise)
                CardDetail(label: "REGISTER", text: expression.register)
                CardDetail(label: "COLLOCATIONS", text: expression.collocations.joined(separator: " · "))
                CardDetail(label: "SENSE AND MISUSE", text: expression.misuse)
                ForEach(Array(expression.contrasts.enumerated()), id: \.offset) { index, contrast in
                    VStack(alignment: .leading, spacing: 12) {
                        Text("\(expression.term) and \(contrast.nearby)").font(.headline)
                        Text(contrast.distinction)
                        Text("Which example fits this meaning?").font(.headline)
                        Button(contrast.awkward) { choices[index] = false }.buttonStyle(.bordered)
                        Button(contrast.fitting) { if choices[index] != true { store.recordNuanceRecognition(expressionId: expression.id) }; choices[index] = true }.buttonStyle(.bordered)
                        if let fitting = choices[index] { Text(fitting ? "This fits the authored distinction. \(contrast.explanation)" : "Compare the distinction again. \(contrast.explanation)").foregroundStyle(LucidColour.mint) }
                    }.studioPanel()
                }
                Text("Choose plain English when it is clearer or warmer. This comparison is recognition practice; it does not award unaided recall or production credit.").foregroundStyle(LucidColour.secondaryOnDark)
            }.padding(22).frame(maxWidth: 720).frame(maxWidth: .infinity)
        }.background(LucidNightBackground().ignoresSafeArea()).foregroundStyle(LucidColour.textOnDark).navigationTitle("Nuance").navigationBarTitleDisplayMode(.inline)
            .onAppear { store.markContextExposure(wordId: expression.wordId) }
    }
}

private extension View {
    func studioPanel() -> some View { padding(20).frame(maxWidth: .infinity, alignment: .leading).foregroundStyle(LucidColour.textOnDark).background(LucidColour.surface, in: RoundedRectangle(cornerRadius: 22)) }
}
