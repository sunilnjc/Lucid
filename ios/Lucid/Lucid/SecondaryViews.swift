import SwiftUI

struct ReviewView: View {
    @EnvironmentObject private var store: LearningStore

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    PageHeading(
                        eyebrow: "1 · 3 · 7 · 14 · 30 DAYS",
                        title: "Remember what you learn.",
                        description: "Retrieve each word from memory, then tell Lucid how it felt. Difficult words return sooner."
                    )

                    if store.dueWords.isEmpty {
                        EmptyState(
                            icon: "checkmark.circle.fill",
                            title: "You’re caught up",
                            message: "Your next reviews will appear here when they are due."
                        )
                    } else {
                        ForEach(store.dueWords) { word in
                            ReviewCard(word: word)
                        }
                    }
                }
                .padding(18)
                .frame(maxWidth: 760)
                .frame(maxWidth: .infinity)
            }
            .background(LucidColour.paper)
            .navigationTitle("Review")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

struct ReviewCard: View {
    @EnvironmentObject private var store: LearningStore
    let word: ProfessionalWord
    @State private var revealed = false

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text(word.mission)
                .font(.headline)
                .foregroundStyle(LucidColour.teal)
            Text(word.term)
                .font(.system(.largeTitle, design: .serif))
            if revealed {
                Text(word.meaning).font(.title3)
                Text(word.example).font(.body).foregroundStyle(LucidColour.muted)
                Text("How well did you retrieve and use it?")
                    .font(.caption.weight(.bold))
                HStack(spacing: 8) {
                    ForEach(ReviewQuality.allCases) { quality in
                        Button(quality.label) {
                            store.review(wordId: word.id, quality: quality, productive: true)
                        }
                        .buttonStyle(.bordered)
                        .frame(maxWidth: .infinity, minHeight: 44)
                    }
                }
            } else {
                Button("Reveal meaning and example") { revealed = true }
                    .buttonStyle(.borderedProminent)
                    .tint(LucidColour.teal)
                    .frame(minHeight: 44)
            }
        }
        .padding(22)
        .background(.white.opacity(0.82), in: RoundedRectangle(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(LucidColour.deepPaper))
    }
}

struct LibraryView: View {
    @EnvironmentObject private var store: LearningStore
    @State private var search = ""
    @State private var selectedScope = "For my role"

    private var words: [ProfessionalWord] {
        store.catalog.words.filter { word in
            let scopeMatches = selectedScope == "All words" || word.roles.contains(store.profile?.roleId ?? "")
            let searchMatches = search.isEmpty || word.term.localizedCaseInsensitiveContains(search) || word.meaning.localizedCaseInsensitiveContains(search)
            return scopeMatches && searchMatches
        }
    }

    var body: some View {
        NavigationStack {
            List {
                Picker("Library scope", selection: $selectedScope) {
                    Text("For my role").tag("For my role")
                    Text("All words").tag("All words")
                }
                .pickerStyle(.segmented)
                .listRowBackground(LucidColour.paper)

                ForEach(words) { word in
                    NavigationLink {
                        WordDetailView(word: word)
                    } label: {
                        HStack(spacing: 14) {
                            VStack(alignment: .leading, spacing: 5) {
                                Text(word.term).font(.system(.title3, design: .serif, weight: .semibold))
                                Text(word.meaning).font(.caption).foregroundStyle(LucidColour.muted).lineLimit(2)
                            }
                            Spacer()
                            if store.isFavourite(word.id) { Image(systemName: "bookmark.fill").foregroundStyle(LucidColour.coral) }
                            if store.data.progressByWordId[word.id]?.mastered == true { Image(systemName: "checkmark.seal.fill").foregroundStyle(LucidColour.teal) }
                        }
                        .padding(.vertical, 5)
                    }
                    .listRowBackground(Color.white.opacity(0.72))
                }
            }
            .scrollContentBackground(.hidden)
            .background(LucidColour.paper)
            .searchable(text: $search, prompt: "Search words or meanings")
            .navigationTitle("Word library")
        }
    }
}

struct WordDetailView: View {
    @EnvironmentObject private var store: LearningStore
    @StateObject private var player = SpeechPlayer()
    let word: ProfessionalWord

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 5) {
                        Text(word.term).font(.system(size: 44, weight: .regular, design: .serif))
                        Text("\(word.partOfSpeech.uppercased()) · \(word.pronunciation)").font(.caption.weight(.bold)).foregroundStyle(LucidColour.muted)
                    }
                    Spacer()
                    Button { player.speak("\(word.term). \(word.example)", rate: store.data.settings.speechRate) } label: {
                        Image(systemName: "speaker.wave.2.fill").frame(width: 44, height: 44)
                    }
                }
                Text(word.meaning).font(.title2).lineSpacing(4)
                CardDetail(label: "EXAMPLE", text: word.example)
                CardDetail(label: "NATURAL PAIRINGS", text: word.collocations.joined(separator: " · "))
                CardDetail(label: "WHEN TO USE", text: word.whenToUse)
                CardDetail(label: "AVOID", text: word.avoidOrMisuse)
                CardDetail(label: "PRACTICE MISSION", text: word.mission)
                Button { store.toggleFavourite(word.id) } label: {
                    Label(store.isFavourite(word.id) ? "Remove from favourites" : "Save to favourites", systemImage: store.isFavourite(word.id) ? "bookmark.slash" : "bookmark")
                        .frame(maxWidth: .infinity, minHeight: 48)
                }
                .buttonStyle(.bordered)
            }
            .padding(22)
            .frame(maxWidth: 720)
            .frame(maxWidth: .infinity)
        }
        .background(LucidColour.paper)
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct InsightsView: View {
    @EnvironmentObject private var store: LearningStore

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    PageHeading(
                        eyebrow: "PROGRESS THAT MEANS USE",
                        title: "Build language you can retrieve.",
                        description: "A word is mastered only after successful use on three different days, including at least one retrieval after 30 days."
                    )

                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 145), spacing: 12)], spacing: 12) {
                        MetricCard(value: "\(store.streak)", label: "day streak", colour: LucidColour.coral)
                        MetricCard(value: "\(store.learnedCount)", label: "words started", colour: LucidColour.teal)
                        MetricCard(value: "\(store.masteredCount)", label: "words mastered", colour: LucidColour.gold)
                        MetricCard(value: "\(store.data.sessions.count)", label: "lessons completed", colour: LucidColour.mint)
                    }

                    VStack(alignment: .leading, spacing: 14) {
                        Text("Your retention system").font(.title2.weight(.semibold))
                        Text("Lucid schedules successful words across 1, 3, 7, 14, and 30-day intervals. A difficult answer steps back; a forgotten answer restarts at one day.")
                            .foregroundStyle(LucidColour.muted)
                            .lineSpacing(4)
                        HStack(spacing: 5) {
                            ForEach([1, 3, 7, 14, 30], id: \.self) { day in
                                Text("\(day)d")
                                    .font(.caption.weight(.bold))
                                    .frame(maxWidth: .infinity, minHeight: 42)
                                    .background(LucidColour.teal.opacity(Double(day + 10) / 50), in: RoundedRectangle(cornerRadius: 9))
                            }
                        }
                    }
                    .padding(20)
                    .background(.white.opacity(0.72), in: RoundedRectangle(cornerRadius: 18))
                }
                .padding(18)
                .frame(maxWidth: 760)
                .frame(maxWidth: .infinity)
            }
            .background(LucidColour.paper)
            .navigationTitle("Progress")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

struct MetricCard: View {
    let value: String
    let label: String
    let colour: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text(value).font(.system(size: 38, weight: .regular, design: .serif)).monospacedDigit()
            Text(label.uppercased()).font(.caption2.weight(.bold)).tracking(0.7)
        }
        .frame(maxWidth: .infinity, minHeight: 112, alignment: .leading)
        .padding(18)
        .background(colour.opacity(0.27), in: RoundedRectangle(cornerRadius: 17))
        .accessibilityElement(children: .combine)
    }
}

struct PageHeading: View {
    let eyebrow: String
    let title: String
    let description: String

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text(eyebrow).font(.caption2.weight(.bold)).tracking(1.2).foregroundStyle(LucidColour.teal)
            Text(title).font(.system(.largeTitle, design: .serif))
            Text(description).foregroundStyle(LucidColour.muted).lineSpacing(4)
        }
        .padding(.vertical, 8)
    }
}

struct EmptyState: View {
    let icon: String
    let title: String
    let message: String

    var body: some View {
        VStack(spacing: 13) {
            Image(systemName: icon).font(.system(size: 42)).foregroundStyle(LucidColour.teal)
            Text(title).font(.title2.weight(.semibold))
            Text(message).multilineTextAlignment(.center).foregroundStyle(LucidColour.muted)
        }
        .frame(maxWidth: .infinity, minHeight: 260)
        .padding(24)
        .background(.white.opacity(0.72), in: RoundedRectangle(cornerRadius: 20))
    }
}
