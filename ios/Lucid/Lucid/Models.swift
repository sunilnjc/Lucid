import Foundation

struct ProfessionalCatalog: Codable {
    let schemaVersion: Int
    let roles: [ProfessionalRole]
    let seniorityLevels: [SeniorityLevel]
    let goals: [CommunicationGoal]
    let words: [ProfessionalWord]
}

struct ProfessionalRole: Codable, Identifiable, Hashable {
    let id: String
    let label: String
    let shortLabel: String
    let description: String
    let situations: [ProfessionalSituation]
    let defaultGoalIds: [String]
}

struct ProfessionalSituation: Codable, Identifiable, Hashable {
    let id: String
    let roleId: String
    let label: String
    let description: String
    let goalIds: [String]
}

struct SeniorityLevel: Codable, Identifiable, Hashable {
    let id: String
    let label: String
    let description: String
    let communicationFocus: String
}

struct CommunicationGoal: Codable, Identifiable, Hashable {
    let id: String
    let label: String
    let outcome: String
    let coachingPrompt: String
}

struct ProfessionalWord: Codable, Identifiable, Hashable {
    let id: String
    let term: String
    let partOfSpeech: String
    let pronunciation: String
    let meaning: String
    let difficulty: String
    let usefulness: String
    let learningMode: String
    let roles: [String]
    let situations: [String]
    let seniority: [String]
    let goals: [String]
    let collocations: [String]
    let example: String
    let whenToUse: String
    let avoidOrMisuse: String
    let mission: String
}

struct LearnerProfile: Codable, Equatable {
    var roleId: String
    var seniorityId: String
    var situationIds: [String]
    var goalIds: [String]
}

struct WordProgress: Codable, Equatable {
    var introducedOn: Date
    var intervalIndex: Int = 0
    var nextReviewOn: Date
    var lastReviewedOn: Date?
    var reviewCount: Int = 0
    var successfulReviewDates: [Date] = []
    var lapses: Int = 0
    var mastered: Bool = false
}

struct DailySession: Codable, Identifiable, Equatable {
    let id: UUID
    let date: Date
    let wordIds: [String]
    let completedAt: Date
}

struct AppSettings: Codable, Equatable {
    var notificationsEnabled = false
    var reminderHour = 9
    var reminderMinute = 0
    var speechRate: Float = 0.46
}

struct LearnerData: Codable, Equatable {
    var profile: LearnerProfile?
    var introducedWordIds: [String] = []
    var currentLessonDate: Date?
    var currentWordIds: [String] = []
    var progressByWordId: [String: WordProgress] = [:]
    var sessions: [DailySession] = []
    var favouriteWordIds: [String] = []
    var completedWordIdsToday: [String] = []
    var settings = AppSettings()
    var reviewPromptMilestone: Int = 0
}

struct UsageResult: Equatable {
    let score: Int
    let title: String
    let evidence: [String]
    let suggestions: [String]
}

enum ReviewQuality: Int, CaseIterable, Identifiable {
    case again = 0
    case hard = 1
    case good = 2
    case strong = 3

    var id: Int { rawValue }

    var label: String {
        switch self {
        case .again: "Again"
        case .hard: "Hard"
        case .good: "Good"
        case .strong: "Strong"
        }
    }
}

extension Date {
    var lucidStartOfDay: Date { Calendar.current.startOfDay(for: self) }

    func lucidAdding(days: Int) -> Date {
        Calendar.current.date(byAdding: .day, value: days, to: lucidStartOfDay) ?? self
    }

    func lucidIsSameDay(as other: Date) -> Bool {
        Calendar.current.isDate(self, inSameDayAs: other)
    }
}
