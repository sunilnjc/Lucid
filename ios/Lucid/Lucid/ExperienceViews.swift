import SwiftUI

struct PracticeStatusBanner: View {
    @EnvironmentObject private var store: LearningStore
    var body: some View {
        if let notice = store.storageNotice {
            VStack(alignment: .leading, spacing: 8) {
                Label(notice, systemImage: "externaldrive.badge.exclamationmark")
                if store.hasUnsavedChanges { Button("Try saving again") { store.retryStorage() } }
            }
            .font(.subheadline).padding(16)
            .background(LucidColour.raisedSurface, in: RoundedRectangle(cornerRadius: 16))
            .foregroundStyle(LucidColour.textOnDark)
        }
    }
}

struct PracticeDashboard: View {
    @EnvironmentObject private var store: LearningStore
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(store.selectedRole?.shortLabel.uppercased() ?? "YOUR DAILY PRACTICE")
                    .font(.caption.weight(.bold)).tracking(1.1).foregroundStyle(LucidColour.mint)
                Spacer()
                Label("\(store.streak)", systemImage: "flame.fill").foregroundStyle(LucidColour.coral)
                    .accessibilityLabel("\(store.streak) day streak")
                Text("\(store.totalXP) XP").foregroundStyle(LucidColour.mint)
            }.font(.subheadline.weight(.semibold))
            Text(store.isCurrentPlanComplete ? "A little better, every day." : (store.todayWords.isEmpty ? "Keep your words alive." : "A few words. A little progress."))
                .font(.system(.title2, design: .serif)).fixedSize(horizontal: false, vertical: true)
            Text(store.todayWords.isEmpty ? "Explore your Library or return when a review is due." : "Quick tap challenges. No typing or microphone needed.")
                .font(.subheadline).foregroundStyle(LucidColour.secondaryOnDark)
            if !store.todayWords.isEmpty {
                ProgressView(value: store.lessonProgress).tint(LucidColour.mint)
                    .animation(reduceMotion ? nil : .easeInOut(duration: 0.3), value: store.lessonProgress)
                    .accessibilityLabel("Daily practice")
                    .accessibilityValue("\(Int(store.lessonProgress * 100)) percent complete")
                HStack(alignment: .top) {
                    Text("\(store.data.completedWordIdsToday.filter(store.data.currentWordIds.contains).count) of \(store.todayWords.count) practised")
                    Spacer()
                    Text(store.isTodayComplete ? "10 XP per new word · Daily bonus already earned" : "10 XP per word · 20 XP for finishing")
                        .multilineTextAlignment(.trailing)
                }.font(.footnote).foregroundStyle(LucidColour.secondaryOnDark)
            }
        }.padding(18)
            .background(LucidColour.surface, in: RoundedRectangle(cornerRadius: 22))
            .overlay(RoundedRectangle(cornerRadius: 22).stroke(.white.opacity(0.1)))
            .foregroundStyle(LucidColour.textOnDark)
    }
}

struct WeeklyPracticeView: View {
    @EnvironmentObject private var store: LearningStore
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Your last seven days").font(.headline)
            HStack(spacing: 8) {
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
                    .accessibilityValue(practised ? "Practised" : "No practice")
                }
            }
            Text("A review day counts too. Return when you can; your learning is still here.")
                .font(.subheadline).foregroundStyle(LucidColour.secondaryOnDark)
        }
        .padding(20).foregroundStyle(LucidColour.textOnDark)
        .background(LucidColour.surface, in: RoundedRectangle(cornerRadius: 22))
    }
}

struct LessonCelebrationView: View {
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
            Text("You showed up.").font(.system(.largeTitle, design: .serif))
            Text("+20 XP").font(.title2.monospacedDigit().bold()).foregroundStyle(LucidColour.mint)
            Text("Try one of today’s words in a real conversation. Lucid will bring it back when it’s time to review.")
                .multilineTextAlignment(.center).foregroundStyle(LucidColour.secondaryOnDark)
            WeeklyPracticeView()
            Button(store.currentRoleDueWords.isEmpty ? "Enjoy the rest of your day" : "Review \(store.currentRoleDueWords.count) words for your role") {
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
