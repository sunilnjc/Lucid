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
    var startingCheck: [CourseCheckQuestion]? = nil
    var lessons: [ProfessionalPathLesson] { modules.flatMap(\.lessons) }
    var wordIds: [String] { lessons.flatMap(\.wordIds) }
}

struct CourseCheckQuestion: Codable, Identifiable {
    let id: String
    let prompt: String
    let options: [String]
    let correctIndex: Int
    let explanation: String
}

/// A tentative course preference, not a proficiency certificate or mastery event.
struct PathPlacement: Codable, Equatable {
    let pathId: String
    let startingModuleId: String
    let checkedAt: Date
    let correctAnswers: Int
    let questionCount: Int
}

struct CourseCheckDraft: Codable, Equatable {
    let pathId: String
    var answers: [Int]
    var questionSignature: String? = nil

    static func signature(for questions: [CourseCheckQuestion]) -> String {
        // Stable cache identity only, not a security digest.
        let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]
        let bytes = (try? encoder.encode(questions)) ?? Data()
        let hash = bytes.reduce(UInt64(14_695_981_039_346_656_037)) { ($0 ^ UInt64($1)) &* 1_099_511_628_211 }
        return String(hash, radix: 16)
    }

    func matches(_ path: ProfessionalLearningPath) -> Bool {
        guard pathId == path.id, let questions = path.startingCheck, questions.count == 6,
              questionSignature == Self.signature(for: questions), answers.count <= questions.count else { return false }
        return answers.enumerated().allSatisfy { index, answer in answer == -1 || questions[index].options.indices.contains(answer) }
    }
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
    var partOfSpeech: String? = nil
    var pronunciation: String? = nil
    var difficulty: String? = nil
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
    var partOfSpeech: String
    var pronunciation: String
    var meaning: String
    var difficulty: String
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
        result.partOfSpeech = context.partOfSpeech ?? partOfSpeech
        result.pronunciation = context.pronunciation ?? pronunciation
        result.difficulty = context.difficulty ?? difficulty
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
    var pathPlacements: [String: PathPlacement]?
    // Unfinished checks stay on this device; only the chosen starting point syncs.
    var courseCheckDrafts: [String: CourseCheckDraft]?
    // Tap answers and the current card are private, device-local resumable state.
    var tapPracticeAttempts: [String: TapPracticeAttempt]?
    var practiceCursors: [String: PracticeCursor]?
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

struct TapPracticeAttempt: Codable, Equatable {
    let signature: String
    var choices: [String] = []
    var revealed = false
}

struct PracticeCursor: Codable, Equatable {
    let dayKey: String
    let wordId: String
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
