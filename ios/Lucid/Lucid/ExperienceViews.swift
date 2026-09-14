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
        VStack(alignment: .leading, spacing: 22) {
            HStack {
                Text(store.selectedRole?.shortLabel.uppercased() ?? "YOUR DAILY PRACTICE")
                    .font(.caption.weight(.bold)).tracking(1.1).foregroundStyle(LucidColour.mint)
                Spacer()
                Text(store.currentDate.formatted(.dateTime.month(.abbreviated).day()))
                    .font(.subheadline).foregroundStyle(LucidColour.secondaryOnDark)
            }
            Text(store.isCurrentPlanComplete ? "A little better, every day." : (store.todayWords.isEmpty ? "Keep your words alive." : "Make these words yours."))
                .font(.system(.largeTitle, design: .serif)).fixedSize(horizontal: false, vertical: true)
            Text(store.isCurrentPlanComplete ? "This role’s practice is complete. Take what you practised into your next conversation." : (store.todayWords.isEmpty ? "You’ve explored the current collection for your role. Review what you know and put it to work." : (store.isTodayComplete ? "Your daily bonus is already earned. Explore this role’s words at your own pace; each new word still earns practice XP." : "\(store.todayWords.count) useful \(store.todayWords.count == 1 ? "word" : "words"). One real sentence for each. A few minutes for you.")))
                .font(.body).foregroundStyle(LucidColour.secondaryOnDark).lineSpacing(3)
            if !store.todayWords.isEmpty {
                HStack(spacing: 18) {
                    ZStack {
                        Circle().stroke(.white.opacity(0.12), lineWidth: 7)
                        Circle().trim(from: 0, to: store.lessonProgress)
                            .stroke(LucidColour.mint, style: StrokeStyle(lineWidth: 7, lineCap: .round))
                            .rotationEffect(.degrees(-90))
                            .animation(reduceMotion ? nil : .easeInOut(duration: 0.4), value: store.lessonProgress)
                        Text("\(store.data.completedWordIdsToday.filter(store.data.currentWordIds.contains).count)/\(store.todayWords.count)")
                            .font(.headline.monospacedDigit())
                    }
                    .frame(width: 66, height: 66)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("Daily practice")
                    .accessibilityValue("\(Int(store.lessonProgress * 100)) percent complete")
                    VStack(alignment: .leading, spacing: 6) {
                        Text(store.isCurrentPlanComplete ? "Current practice complete" : (store.isTodayComplete ? "Current role practice" : "Your daily goal")).font(.headline)
                        Text(store.isTodayComplete ? "10 XP per new word · Daily bonus already earned" : "10 XP per word · 20 XP for finishing")
                            .font(.subheadline).foregroundStyle(LucidColour.secondaryOnDark)
                    }
                }
            }
            HStack {
                Label("\(store.streak) \(store.streak == 1 ? "day" : "days")", systemImage: "flame.fill").foregroundStyle(LucidColour.coral)
                Spacer()
                Label("\(store.totalXP) XP", systemImage: "sparkle").foregroundStyle(LucidColour.mint)
            }
            .font(.subheadline.weight(.semibold))
        }
        .padding(22)
        .background(LucidColour.surface, in: RoundedRectangle(cornerRadius: 26))
        .overlay(RoundedRectangle(cornerRadius: 26).stroke(.white.opacity(0.1)))
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
