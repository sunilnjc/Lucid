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
            }
            .buttonStyle(.plain)
            .accessibilityHint("Opens your chapters, lessons, and workplace challenges")
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
                Text("\(path.wordIds.count) words across \(path.lessons.count) lessons. Today’s words follow this sequence at your chosen pace. A lesson can take more than one day.")
                    .foregroundStyle(LucidColour.secondaryOnDark)
                Text("Path progress records words you’ve started. Lasting mastery is measured separately through spaced review.")
                    .font(.footnote).foregroundStyle(LucidColour.secondaryOnDark)
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
                Text("Use fictional details in practice. This path teaches professional English; it is not accounting policy or financial advice.")
                    .font(.footnote).foregroundStyle(LucidColour.secondaryOnDark)
            }.padding(18).frame(maxWidth: 760).frame(maxWidth: .infinity)
        }
        .foregroundStyle(LucidColour.textOnDark).lucidBackground()
        .navigationTitle("Learning path").navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(LucidColour.midnight, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar).toolbarColorScheme(.dark, for: .navigationBar)
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
