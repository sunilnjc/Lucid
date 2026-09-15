import SwiftUI

struct LearningPathSummary: View {
    @EnvironmentObject private var store: LearningStore
    var body: some View {
        if let path = store.learningPath {
            NavigationLink {
                LearningPathView(path: path)
            } label: {
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Label("YOUR PROFESSIONAL PATH", systemImage: "point.topleft.down.to.point.bottomright.curvepath")
                            .font(.caption.weight(.bold)).tracking(0.8)
                        Spacer()
                        Image(systemName: "chevron.right")
                    }.foregroundStyle(LucidColour.mint)
                    Text(path.title).font(.title3.bold()).foregroundStyle(LucidColour.textOnDark)
                    ProgressView(value: store.pathProgress).tint(LucidColour.mint)
                        .accessibilityLabel("Learning path progress")
                        .accessibilityValue("\(store.pathCompletedWordCount) of \(path.wordIds.count) words started")
                    Text("\(store.pathCompletedWordCount)/\(path.wordIds.count) words started · \(path.modules.count) chapters · \(path.lessons.count) lessons")
                        .font(.subheadline).foregroundStyle(LucidColour.secondaryOnDark)
                    Text(store.nextPathLesson.map { "Next: \($0.title)" } ?? "All words introduced. Keep them active with recall and workplace challenges.")
                        .font(.subheadline).foregroundStyle(LucidColour.textOnDark)
                }
                .padding(20)
                .background(LucidColour.raisedSurface, in: RoundedRectangle(cornerRadius: 22))
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityHint("Opens your chapters, lessons, and workplace challenges")
            if !store.startingCheckQuestions.isEmpty { CourseStartingPointCard(path: path) }
        } else if let role = store.selectedRole {
            let words = store.catalog.words.filter { $0.learningMode == "active" && $0.roles.contains(role.id) }
            let started = words.filter { store.data.introducedWordIds.contains($0.id) }.count
            VStack(alignment: .leading, spacing: 10) {
                Text("YOUR ROLE COLLECTION").font(.caption.bold()).tracking(0.8).foregroundStyle(LucidColour.mint)
                Text(role.label).font(.title3.bold()).foregroundStyle(LucidColour.textOnDark)
                Text("\(words.count) words available · \(started) started")
                    .font(.subheadline).foregroundStyle(LucidColour.textOnDark)
                Text("Today picks words from this starter collection at your chosen pace. A chapter-by-chapter course is not available for this role yet.")
                    .font(.subheadline).foregroundStyle(LucidColour.secondaryOnDark)
            }
            .padding(20).frame(maxWidth: .infinity, alignment: .leading)
            .background(LucidColour.raisedSurface, in: RoundedRectangle(cornerRadius: 22))
        }
    }
}

struct LearningPathView: View {
    @EnvironmentObject private var store: LearningStore
    let path: ProfessionalLearningPath

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                PageHeading(eyebrow: "YOUR PATH, YOUR PACE", title: path.title, description: path.description)
                Text("\(path.wordIds.count) words across \(path.lessons.count) lessons. Today follows your chosen starting point at your daily pace. A lesson can take more than one day.")
                    .foregroundStyle(LucidColour.secondaryOnDark)
                Text("Path progress records words you’ve started. Lasting mastery is measured separately through spaced review.")
                    .font(.footnote).foregroundStyle(LucidColour.secondaryOnDark)
                if !store.startingCheckQuestions.isEmpty { CourseStartingPointCard(path: path) }
                ForEach(Array(path.modules.enumerated()), id: \.element.id) { index, module in
                    VStack(alignment: .leading, spacing: 16) {
                        Text("CHAPTER \(index + 1)").font(.caption.bold()).tracking(1).foregroundStyle(LucidColour.mint)
                        Text(module.title).font(.system(.title2, design: .serif)).fixedSize(horizontal: false, vertical: true)
                        Text(module.outcome).foregroundStyle(LucidColour.secondaryOnDark)
                        ForEach(module.lessons) { lesson in
                            let count = lesson.wordIds.filter(store.data.introducedWordIds.contains).count
                            let isNext = store.nextPathLesson?.id == lesson.id
                            NavigationLink {
                                PathLessonView(lesson: lesson)
                            } label: {
                                HStack(alignment: .top, spacing: 12) {
                                    Image(systemName: count == lesson.wordIds.count ? "checkmark.circle.fill" : (isNext ? "play.circle.fill" : "circle"))
                                        .font(.title3).foregroundStyle(LucidColour.mint)
                                    VStack(alignment: .leading, spacing: 5) {
                                        Text(lesson.title).font(.headline).foregroundStyle(LucidColour.textOnDark)
                                        Text(lesson.wordIds.compactMap { store.word(id: $0)?.term }.joined(separator: " · "))
                                            .font(.subheadline).foregroundStyle(LucidColour.secondaryOnDark)
                                        Text("\(count)/\(lesson.wordIds.count) words started\(isNext ? " · Next in your path" : "")")
                                            .font(.caption).foregroundStyle(LucidColour.mint)
                                    }
                                    Spacer(minLength: 0)
                                    Image(systemName: "chevron.right").font(.caption).foregroundStyle(LucidColour.secondaryOnDark)
                                }
                                .padding(16)
                                .background(isNext ? LucidColour.raisedSurface : LucidColour.midnight, in: RoundedRectangle(cornerRadius: 16))
                            }.buttonStyle(.plain)
                        }
                    }
                    .padding(20).background(LucidColour.surface, in: RoundedRectangle(cornerRadius: 24))
                }
                Text("Use fictional details in practice. This course teaches workplace communication, not clinical, legal, accounting or operational instructions. Follow qualified advice and your organisation’s approved procedures for real decisions.")
                    .font(.footnote).foregroundStyle(LucidColour.secondaryOnDark)
            }.padding(18).frame(maxWidth: 760).frame(maxWidth: .infinity)
        }
        .foregroundStyle(LucidColour.textOnDark).lucidBackground()
        .navigationTitle("Learning path").navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(LucidColour.midnight, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar).toolbarColorScheme(.dark, for: .navigationBar)
    }
}

struct CourseStartingPointCard: View {
    @EnvironmentObject private var store: LearningStore
    let path: ProfessionalLearningPath
    @State private var showCheck = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("FIND YOUR STARTING POINT", systemImage: "signpost.right")
                .font(.caption.bold()).tracking(0.8).foregroundStyle(LucidColour.mint)
            Text(store.courseStartingModule.map { "Your starting chapter: \($0.title)" } ?? "Already familiar with some of these words?")
                .font(.headline)
            Text("Six workplace-language questions suggest where to begin. This is separate from your career stage, and is not an English proficiency test.")
                .font(.subheadline).foregroundStyle(LucidColour.secondaryOnDark)
            if store.courseStartingModule != nil {
                Text("Earlier chapters remain available and return later in your sequence. Existing daily cards and reviews keep their progress.")
                    .font(.footnote).foregroundStyle(LucidColour.secondaryOnDark)
            }
            Button { showCheck = true } label: {
                Label(store.startingCheckAnswers.isEmpty ? "Find my starting point" : (store.startingCheckScore == nil ? "Resume my starting check" : "Review my starting point"), systemImage: "arrow.right")
                    .font(.headline).frame(maxWidth: .infinity, minHeight: 48)
            }.buttonStyle(.bordered).tint(LucidColour.mint)
                .accessibilityIdentifier("course.starting-check")
            Text("Optional · No words are marked mastered by this check.")
                .font(.footnote).foregroundStyle(LucidColour.secondaryOnDark)
        }
        .padding(20).foregroundStyle(LucidColour.textOnDark)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(LucidColour.surface, in: RoundedRectangle(cornerRadius: 22))
        .sheet(isPresented: $showCheck) {
            NavigationStack { CourseStartingCheckView(path: path) }
                .id("\(store.scope):\(path.id)")
        }
    }
}

struct CourseStartingCheckView: View {
    @EnvironmentObject private var store: LearningStore
    @Environment(\.dismiss) private var dismiss
    let path: ProfessionalLearningPath
    @State private var selection: Int?
    @State private var saveError: String?
    @AccessibilityFocusState private var questionFocused: Bool

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                PracticeStatusBanner()
                if store.learningPath?.id != path.id || store.startingCheckQuestions.isEmpty {
                    Text("This course has changed. Close this check and open your current learning path.")
                } else if let score = store.startingCheckScore, let index = store.suggestedStartingModuleIndex {
                    result(score: score, index: index)
                } else {
                    question
                }
                if let saveError { Text(saveError).foregroundStyle(LucidColour.coral).accessibilityIdentifier("course.save-error") }
            }.padding(22).frame(maxWidth: 680).frame(maxWidth: .infinity)
        }
        .foregroundStyle(LucidColour.textOnDark).lucidBackground().preferredColorScheme(.dark)
        .navigationTitle("Starting-point check").navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } } }
        .toolbarBackground(LucidColour.midnight, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar).toolbarColorScheme(.dark, for: .navigationBar)
        .onChange(of: store.startingCheckAnswers.count) { _, _ in selection = nil; questionFocused = true }
        .onChange(of: store.profile?.roleId) { _, _ in dismiss() }
        .onChange(of: store.scope) { _, _ in dismiss() }
    }

    private var question: some View {
        let questions = store.startingCheckQuestions
        let number = store.startingCheckAnswers.count
        let current = questions[number]
        return VStack(alignment: .leading, spacing: 18) {
            Text("\(path.title)").font(.subheadline).foregroundStyle(LucidColour.secondaryOnDark)
            if store.startingCheckWasUpdated {
                Text("These questions have been updated. Please start this short check again; your chosen starting point and learning history are unchanged.")
                    .font(.subheadline).foregroundStyle(LucidColour.mint)
            }
            ProgressView(value: Double(number), total: Double(questions.count)).tint(LucidColour.mint)
                .accessibilityLabel("Starting check progress").accessibilityValue("\(number) of \(questions.count) answered")
            Text("QUESTION \(number + 1) OF \(questions.count)").font(.caption.bold()).foregroundStyle(LucidColour.mint)
            Text(current.prompt).font(.title3.weight(.semibold)).fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader).accessibilityFocused($questionFocused)
            ForEach(Array(current.options.enumerated()), id: \.offset) { index, option in
                Button { selection = index } label: {
                    HStack(alignment: .top, spacing: 12) {
                        Image(systemName: selection == index ? "checkmark.circle.fill" : "circle")
                            .foregroundStyle(LucidColour.mint)
                        Text(option).multilineTextAlignment(.leading).frame(maxWidth: .infinity, alignment: .leading)
                    }.padding(18).frame(minHeight: 52)
                        .background(selection == index ? LucidColour.raisedSurface : LucidColour.surface, in: RoundedRectangle(cornerRadius: 16))
                        .contentShape(Rectangle())
                }.buttonStyle(.plain).accessibilityAddTraits(selection == index ? .isSelected : [])
                    .accessibilityIdentifier("course.option.\(index)")
            }
            Button { selection = -1 } label: {
                Text(selection == -1 ? "Not sure — selected" : "I’m not sure")
                    .frame(minHeight: 44).contentShape(Rectangle())
            }.tint(LucidColour.mint).accessibilityIdentifier("course.unsure")
            Button {
                guard let selection else { return }
                let saved = store.answerStartingCheck(pathId: path.id, questionId: current.id, choice: selection)
                saveError = saved ? nil : (store.storageNotice ?? "Your answer could not be saved. Retry storage before continuing.")
            } label: {
                Text(number == questions.count - 1 ? "See my suggested start" : "Next question")
                    .font(.headline).frame(maxWidth: .infinity, minHeight: 52)
            }.buttonStyle(.borderedProminent).tint(LucidColour.mint).foregroundStyle(LucidColour.midnight)
                .disabled(selection == nil || store.storageBlocked || store.hasUnsavedChanges)
                .accessibilityIdentifier("course.next")
            Text(store.hasUnsavedChanges ? "Waiting to save — see the storage notice above." : "Submitted answers are saved on this device. You can close and resume later. Explanations appear at the end.")
                .font(.footnote).foregroundStyle(LucidColour.secondaryOnDark)
        }
    }

    private func result(score: Int, index: Int) -> some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("A starting point, not a label.").font(.system(.largeTitle, design: .serif))
            Text("You recognised the intended usage in \(score) of 6 situations. This small check does not assess speaking, grammar or independent recall.")
                .foregroundStyle(LucidColour.secondaryOnDark)
            Text("SUGGESTED · CHAPTER \(index + 1)").font(.caption.bold()).foregroundStyle(LucidColour.mint)
            Text(path.modules[index].title).font(.title2.bold())
            Text(path.modules[index].outcome)
            Text("Earlier chapters stay available and return after the later chapters. Choosing a starting point does not introduce words, earn XP or mark them mastered.")
                .font(.subheadline).foregroundStyle(LucidColour.secondaryOnDark)
            Text(store.startingCheckCanReplaceToday ? "Your untouched daily cards will update when you apply this choice." : "Your current cards and saved work will stay. This choice applies to the next new daily plan.")
                .font(.subheadline).foregroundStyle(LucidColour.mint)
            Button { apply(useSuggested: true) } label: {
                Text("Start from chapter \(index + 1)").font(.headline).frame(maxWidth: .infinity, minHeight: 52)
            }.buttonStyle(.borderedProminent).tint(LucidColour.mint).foregroundStyle(LucidColour.midnight)
                .disabled(store.storageBlocked || store.hasUnsavedChanges).accessibilityIdentifier("course.apply")
            if index != 0 {
                Button("I’d prefer to begin at chapter 1") { apply(useSuggested: false) }.frame(minHeight: 44).tint(LucidColour.mint)
                    .disabled(store.storageBlocked || store.hasUnsavedChanges)
            }
            DisclosureGroup("Review answers and explanations") {
                ForEach(Array(store.startingCheckQuestions.enumerated()), id: \.element.id) { offset, item in
                    VStack(alignment: .leading, spacing: 8) {
                        Text("\(offset + 1). \(item.prompt)").font(.headline)
                        let answer = store.startingCheckAnswers[offset]
                        Text("Your answer: \(answer == -1 ? "Not sure" : item.options[answer])")
                            .font(.subheadline).foregroundStyle(LucidColour.secondaryOnDark)
                        Text("Best fit: \(item.options[item.correctIndex])").foregroundStyle(LucidColour.mint)
                        Text(item.explanation).foregroundStyle(LucidColour.secondaryOnDark)
                    }.padding(.vertical, 10)
                }
            }.tint(LucidColour.mint)
            Button("Retake the check") { store.restartStartingCheck(pathId: path.id); selection = nil; saveError = nil }
                .frame(minHeight: 44).tint(LucidColour.mint).disabled(store.storageBlocked || store.hasUnsavedChanges)
        }
    }

    private func apply(useSuggested: Bool) {
        if store.applyStartingPoint(pathId: path.id, useSuggested: useSuggested) { dismiss() }
        else { saveError = store.storageNotice ?? "Your starting point could not be saved. Please retry." }
    }
}

struct PathLessonView: View {
    @EnvironmentObject private var store: LearningStore
    let lesson: ProfessionalPathLesson
    @State private var showExample = false
    private var answer: Binding<String> {
        Binding(get: { store.pathDraft(for: lesson.id) }, set: { store.savePathDraft($0, lessonId: lesson.id) })
    }
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                PracticeStatusBanner()
                PageHeading(eyebrow: "PUT YOUR WORDS TO WORK", title: lesson.title, description: lesson.objective)
                ForEach(lesson.wordIds.compactMap { store.word(id: $0) }) { word in
                    NavigationLink {
                        WordDetailView(word: word)
                    } label: {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text(word.term).font(.system(.title2, design: .serif))
                                Spacer()
                                Image(systemName: "chevron.right").font(.caption)
                            }
                            Text(word.meaning).font(.body).foregroundStyle(LucidColour.secondaryOnDark)
                        }.padding(18).frame(maxWidth: .infinity, alignment: .leading)
                            .background(LucidColour.surface, in: RoundedRectangle(cornerRadius: 18))
                            .contentShape(Rectangle())
                    }.buttonStyle(.plain)
                }
                VStack(alignment: .leading, spacing: 16) {
                    Label("Your workplace challenge", systemImage: "text.bubble").font(.headline).foregroundStyle(LucidColour.mint)
                    Text(lesson.challenge).lineSpacing(4)
                    TextEditor(text: answer)
                        .frame(minHeight: 160).padding(10).scrollContentBackground(.hidden)
                        .background(LucidColour.midnight, in: RoundedRectangle(cornerRadius: 12))
                        .accessibilityLabel("Your workplace challenge response")
                    Text("\(store.hasUnsavedChanges ? "Waiting to save — see the storage notice" : "Saved on this device") · \(answer.wrappedValue.count)/4,000 characters. Keep workplace details fictional.")
                        .font(.caption).foregroundStyle(LucidColour.secondaryOnDark)
                    DisclosureGroup("Compare with one possible response", isExpanded: $showExample) {
                        Text(lesson.exampleResponse).font(.body).padding(.top, 12).lineSpacing(4)
                    }.tint(LucidColour.mint)
                    Text("Self-check: Is the meaning accurate? Is your point clear? Have you given the reader a useful next step? There is no automatic correctness score for this task.")
                        .font(.subheadline).foregroundStyle(LucidColour.secondaryOnDark)
                }.padding(20).background(LucidColour.surface, in: RoundedRectangle(cornerRadius: 22))
                Text("Opening a lesson or reading its example does not award XP or mark the words learned. Practise your scheduled words in Today and return for recall in Review.")
                    .font(.footnote).foregroundStyle(LucidColour.secondaryOnDark)
                Button(action: store.openToday) {
                    Label("Go to today’s practice", systemImage: "arrow.right")
                        .font(.headline).frame(maxWidth: .infinity, minHeight: 52)
                }.buttonStyle(.borderedProminent).tint(LucidColour.mint).foregroundStyle(LucidColour.midnight)
            }.padding(18).frame(maxWidth: 760).frame(maxWidth: .infinity)
        }
        .foregroundStyle(LucidColour.textOnDark).lucidBackground()
        .navigationTitle("Workplace lesson").navigationBarTitleDisplayMode(.inline)
        .lucidKeyboardDismissal()
        .toolbarBackground(LucidColour.midnight, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar).toolbarColorScheme(.dark, for: .navigationBar)
    }
}
