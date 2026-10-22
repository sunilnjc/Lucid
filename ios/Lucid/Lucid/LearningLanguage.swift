import Foundation

/// Device-level display preference. This never changes a learner record or a learning schedule.
enum LearningLanguage: String, CaseIterable, Codable {
    case en, ko
    static let preferenceKey = "lucid.learning-language"
    init(preference: String?) { self = LearningLanguage(rawValue: preference ?? "") ?? .en }
    var label: String { self == .ko ? "한국어" : "English" }
    var locale: Locale { Locale(identifier: self == .ko ? "ko_KR" : "en_GB") }
}

struct KoreanWordSupport: Codable, Equatable {
    let meaning: String
    var usage: String?
}
struct KoreanIdiomSupport: Codable, Equatable {
    let meaning: String
    let register: String
    let context: String
    let plainEnglish: String
    var avoid: String?
}

/// The generated resource is shared with web; unknown keys and unsupported locales fall back to English.
struct LearningLocalization: Codable {
    let schemaVersion: Int
    let locales: [String]
    let koreanUI: [String: String]
    let koreanWords: [String: [String: KoreanWordSupport]]
    let koreanIdioms: [String: KoreanIdiomSupport]

    static let empty = LearningLocalization(schemaVersion: 1, locales: ["en"], koreanUI: [:], koreanWords: [:], koreanIdioms: [:])
    static let shared: LearningLocalization = {
        guard let url = Bundle.main.url(forResource: "learning-locales", withExtension: "json"),
              let resource = try? load(url: url) else { return .empty }
        return resource
    }()
    static func load(url: URL) throws -> LearningLocalization {
        let result = try JSONDecoder().decode(LearningLocalization.self, from: Data(contentsOf: url))
        guard result.schemaVersion == 1 else { throw LocalizationError.unsupportedSchema }
        return result
    }
    enum LocalizationError: Error { case unsupportedSchema }
    func text(_ key: String, language: LearningLanguage) -> String {
        guard language == .ko, let value = koreanUI[key], !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return key }
        // A malformed translation must not display unresolved or missing placeholders.
        guard Self.placeholders(key) == Self.placeholders(value) else { return key }
        return value
    }
    func format(_ key: String, values: [String: String], language: LearningLanguage) -> String {
        let pattern = text(key, language: language)
        return values.reduce(pattern) { result, item in result.replacingOccurrences(of: "{" + item.key + "}", with: item.value) }
    }
    func word(id: String, roleID: String, language: LearningLanguage) -> KoreanWordSupport? {
        guard language == .ko else { return nil }
        guard let support = koreanWords[roleID]?[id], !support.meaning.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }
        return support
    }
    func idiom(id: String, language: LearningLanguage) -> KoreanIdiomSupport? {
        guard language == .ko else { return nil }
        guard let support = koreanIdioms[id], [support.meaning, support.register, support.context, support.plainEnglish].allSatisfy({ !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }) else { return nil }
        return support
    }
    static func placeholders(_ text: String) -> Set<String> {
        guard let regex = try? NSRegularExpression(pattern: "\\{[a-zA-Z][a-zA-Z0-9_]*\\}") else { return [] }
        let range = NSRange(text.startIndex..<text.endIndex, in: text)
        return Set(regex.matches(in: text, range: range).compactMap { Range($0.range, in: text).map { String(text[$0]) } })
    }
}

func learningLanguage(defaults: UserDefaults = .standard) -> LearningLanguage {
    LearningLanguage(preference: defaults.string(forKey: LearningLanguage.preferenceKey))
}
func learningText(_ key: String) -> String {
    LearningLocalization.shared.text(key, language: learningLanguage())
}
func learningFormat(_ key: String, _ values: [String: String]) -> String {
    LearningLocalization.shared.format(key, values: values, language: learningLanguage())
}
