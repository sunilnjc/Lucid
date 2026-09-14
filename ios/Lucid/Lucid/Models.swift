import Foundation

struct ProfessionalCatalog: Codable {
    let schemaVersion: Int
    let roles: [ProfessionalRole]
    let seniorityLevels: [SeniorityLevel]
    let goals: [CommunicationGoal]
    let words: [ProfessionalWord]
    var learningPaths: [ProfessionalLearningPath]? = nil
}

struct ProfessionalLearningPath: Codable, Identifiable {
    let id: String
    let roleId: String
    let title: String
    let description: String
    let modules: [ProfessionalPathModule]
    var lessons: [ProfessionalPathLesson] { modules.flatMap(\.lessons) }
    var wordIds: [String] { lessons.flatMap(\.wordIds) }
}

struct ProfessionalPathModule: Codable, Identifiable {
    let id: String
    let title: String
    let outcome: String
    let lessons: [ProfessionalPathLesson]
}

struct ProfessionalPathLesson: Codable, Identifiable {
    let id: String
    let title: String
    let situationId: String
    let objective: String
    let wordIds: [String]
    let challenge: String
    let exampleResponse: String
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

struct ProfessionalWordContext: Codable, Hashable {
    let meaning: String
    let collocations: [String]
    let example: String
    let whenToUse: String
    let avoidOrMisuse: String
    let mission: String
}

struct ProfessionalWord: Codable, Identifiable, Hashable {
    let id: String
    let term: String
    let partOfSpeech: String
    let pronunciation: String
    var meaning: String
    let difficulty: String
    let usefulness: String
    let learningMode: String
    let roles: [String]
    let situations: [String]
    let seniority: [String]
    let goals: [String]
    var collocations: [String]
    var example: String
    var whenToUse: String
    var avoidOrMisuse: String
    var mission: String
    var roleContexts: [String: ProfessionalWordContext]? = nil

    func contextualized(for roleId: String?) -> ProfessionalWord {
        guard let roleId, roles.contains(roleId), let context = roleContexts?[roleId] else { return self }
        var result = self
        result.meaning = context.meaning
        result.collocations = context.collocations
        result.example = context.example
        result.whenToUse = context.whenToUse
        result.avoidOrMisuse = context.avoidOrMisuse
        result.mission = context.mission
        return result
    }
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
    var dayKey: String? = nil
    var localDayKey: String { dayKey ?? date.lucidDayKey }
}

struct AppSettings: Codable, Equatable {
    var notificationsEnabled = false
    var reminderHour = 9
    var reminderMinute = 0
    var speechRate: Float = 0.46
}

struct DailyRolePlan: Codable, Equatable {
    var dayKey: String
    var wordIds: [String]
}

struct LearnerData: Codable, Equatable {
    // Optional additions keep the original on-device records decodable during migration.
    var schemaVersion: Int? = 2
    var displayName: String?
    var dailyWordGoal: Int?
    var profileUpdatedAt: Date?
    var lessonDayKey: String?
    // Device-local snapshots keep each visited role stable for the calendar day.
    var lessonRoleId: String?
    var dailyRolePlans: [String: DailyRolePlan]?
    var practiceDrafts: [String: String]?
    var reviewAttempts: [String: ReviewAttempt]?
    var activities: [LearningActivity]?
    var favouriteChanges: [String: FavouriteChange]?
    var updatedAt: Date?
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

struct ReviewAttempt: Codable, Equatable {
    let originalAttempt: String
    let independent: Bool
}

struct LearningActivity: Codable, Identifiable, Equatable {
    enum Kind: String, Codable { case practice, review, lesson }
    let id: UUID
    let kind: Kind
    let wordId: String?
    let date: Date
    let dayKey: String
    let quality: Int
    let productive: Bool
}

struct FavouriteChange: Codable, Equatable {
    let selected: Bool
    let updatedAt: Date
}

struct LearningAchievement: Identifiable {
    let id: String
    let title: String
    let detail: String
    let symbol: String
    let earned: Bool
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
    var lucidDayKey: String {
        let parts = Calendar.current.dateComponents([.year, .month, .day], from: self)
        return String(format: "%04d-%02d-%02d", parts.year ?? 2000, parts.month ?? 1, parts.day ?? 1)
    }

    var lucidStartOfDay: Date { Calendar.current.startOfDay(for: self) }

    func lucidAdding(days: Int) -> Date {
        Calendar.current.date(byAdding: .day, value: days, to: lucidStartOfDay) ?? self
    }

    func lucidIsSameDay(as other: Date) -> Bool {
        Calendar.current.isDate(self, inSameDayAs: other)
    }
}
