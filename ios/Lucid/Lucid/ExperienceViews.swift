import SwiftUI

struct PracticeStatusBanner: View {
    @AppStorage(LearningLanguage.preferenceKey) private var learningLanguageCode = "en"
    @EnvironmentObject private var store: LearningStore
    var body: some View {
        if let notice = store.storageNotice {
            VStack(alignment: .leading, spacing: 8) {
                Label(notice, systemImage: "externaldrive.badge.exclamationmark")
                if store.hasUnsavedChanges { Button(learningText("Try saving again")) { store.retryStorage() } }
            }
            .font(.subheadline).padding(16)
            .background(LucidColour.raisedSurface, in: RoundedRectangle(cornerRadius: 16))
            .foregroundStyle(LucidColour.textOnDark)
        }
    }
}

struct PracticeDashboard: View {
    @AppStorage(LearningLanguage.preferenceKey) private var learningLanguageCode = "en"
    @EnvironmentObject private var store: LearningStore
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    private var statusLayout: AnyLayout {
        dynamicTypeSize.isAccessibilitySize ? AnyLayout(VStackLayout(alignment: .leading, spacing: 8)) : AnyLayout(HStackLayout(spacing: 8))
    }
    private var footerLayout: AnyLayout {
        dynamicTypeSize.isAccessibilitySize ? AnyLayout(VStackLayout(alignment: .leading, spacing: 8)) : AnyLayout(HStackLayout(alignment: .top, spacing: 8))
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            statusLayout {
                Text(store.selectedRole.map { learningText($0.shortLabel).uppercased() } ?? learningText("YOUR DAILY PRACTICE"))
                    .font(.caption.weight(.bold)).tracking(1.1).foregroundStyle(LucidColour.mint)
                if !dynamicTypeSize.isAccessibilitySize { Spacer() }
                Label("\(store.streak)", systemImage: "flame.fill").foregroundStyle(LucidColour.coral)
                    .accessibilityLabel("\(store.streak) day streak")
                Text("\(store.totalXP) XP").foregroundStyle(LucidColour.mint)
            }.font(.subheadline.weight(.semibold))
            Text(store.isCurrentPlanComplete ? learningText("A little better, every day.") : (store.todayWords.isEmpty ? learningText("Keep your words alive.") : learningText("A few words. A little progress.")))
                .font(.system(.title2, design: .serif)).fixedSize(horizontal: false, vertical: true)
            Text(store.todayWords.isEmpty ? learningText("Explore your Library or return when a review is due.") : learningText("Quick tap challenges. No typing or microphone needed."))
                .font(.subheadline).foregroundStyle(LucidColour.secondaryOnDark)
            if !store.todayWords.isEmpty {
                ProgressView(value: store.lessonProgress).tint(LucidColour.mint)
                    .animation(reduceMotion ? nil : .easeInOut(duration: 0.3), value: store.lessonProgress)
                    .accessibilityLabel(learningText("Daily practice"))
                    .accessibilityValue("\(Int(store.lessonProgress * 100)) percent complete")
                footerLayout {
                    Text(learningFormat("{count} of {total} practised", ["count": String(store.data.completedWordIdsToday.filter(store.data.currentWordIds.contains).count), "total": String(store.todayWords.count)]))
                    if !dynamicTypeSize.isAccessibilitySize { Spacer() }
                    Text(store.isTodayComplete ? learningText("10 XP per new word · Daily bonus already earned") : learningText("10 XP per word · 20 XP for finishing"))
                        .multilineTextAlignment(dynamicTypeSize.isAccessibilitySize ? .leading : .trailing)
                }.font(.footnote).foregroundStyle(LucidColour.secondaryOnDark)
            }
        }.padding(18)
            .background(LucidColour.surface, in: RoundedRectangle(cornerRadius: 22))
            .overlay(RoundedRectangle(cornerRadius: 22).stroke(.white.opacity(0.1)))
            .foregroundStyle(LucidColour.textOnDark)
    }
}

struct WeeklyPracticeView: View {
    @AppStorage(LearningLanguage.preferenceKey) private var learningLanguageCode = "en"
    @EnvironmentObject private var store: LearningStore
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(learningText("Your last seven days")).font(.headline)
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(minimum: 0), spacing: 8), count: dynamicTypeSize.isAccessibilitySize ? 3 : 7), spacing: 12) {
                ForEach(-6...0, id: \.self) { offset in
                    let date = store.currentDate.lucidAdding(days: offset)
                    let practised = store.practiceDayKeys.contains(date.lucidDayKey)
                    VStack(spacing: 9) {
                        Image(systemName: practised ? "checkmark" : (offset == 0 ? "circle.dashed" : "minus"))
                            .font(.subheadline.weight(.bold))
                            .frame(maxWidth: .infinity, minHeight: 36)
                            .foregroundStyle(practised ? LucidColour.midnight : LucidColour.secondaryOnDark)
                            .background(practised ? LucidColour.mint : LucidColour.midnight, in: RoundedRectangle(cornerRadius: 12))
                        Text(date.formatted(.dateTime.weekday(.narrow))).font(.caption)
                    }
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(date.formatted(.dateTime.weekday(.wide).day().month()))
                    .accessibilityValue(practised ? learningText("Practised") : learningText("No practice"))
                }
            }
            Text(learningText("A review day counts too. Return when you can; your learning is still here."))
                .font(.subheadline).foregroundStyle(LucidColour.secondaryOnDark)
        }
        .padding(20).foregroundStyle(LucidColour.textOnDark)
        .background(LucidColour.surface, in: RoundedRectangle(cornerRadius: 22))
    }
}

struct LessonCelebrationView: View {
    @AppStorage(LearningLanguage.preferenceKey) private var learningLanguageCode = "en"
    @EnvironmentObject private var store: LearningStore
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var appeared = false
    var body: some View {
        ScrollView {
        VStack(spacing: 24) {
            Image(systemName: "checkmark.seal.fill")
                .font(.system(.largeTitle).weight(.bold))
                .foregroundStyle(LucidColour.mint).padding(24)
                .background(LucidColour.mint.opacity(0.12), in: Circle())
                .scaleEffect(appeared ? 1 : 0.9)
            Text(learningText("You showed up.")).font(.system(.largeTitle, design: .serif))
            Text(learningText("+20 XP")).font(.title2.monospacedDigit().bold()).foregroundStyle(LucidColour.mint)
            Text(learningText("Try one of today’s words in a real conversation. Lucid will bring it back when it’s time to review."))
                .multilineTextAlignment(.center).foregroundStyle(LucidColour.secondaryOnDark)
            WeeklyPracticeView()
            Button(store.currentRoleDueWords.isEmpty ? learningText("Enjoy the rest of your day") : "Review \(store.currentRoleDueWords.count) words for your role") {
                if !store.currentRoleDueWords.isEmpty { store.openReview() }
                dismiss()
            }
            .buttonStyle(.borderedProminent).tint(LucidColour.mint).foregroundStyle(LucidColour.midnight)
            .frame(minHeight: 48)
        }
        .padding(26).frame(maxWidth: .infinity)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .foregroundStyle(LucidColour.textOnDark).lucidBackground()
        .onAppear { withAnimation(reduceMotion ? nil : .spring(response: 0.4, dampingFraction: 0.8)) { appeared = true } }
        .presentationDragIndicator(.visible)
        .preferredColorScheme(.dark)
    }
}
