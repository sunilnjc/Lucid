import Foundation

// Compile the actual native generator. All state and compiler artifacts belong to
// the Node suite's temporary directory; no accounts, notifications or network.
enum ReminderScheduler { static func cancel() {} }
struct TapParityFailure: Error, CustomStringConvertible { let description: String }
struct NativeTapParityResult: Encodable {
    let roleId: String
    let wordId: String
    let courseIndex: Int
    let kind: String
    let correctId: String
    let optionIds: [String]
    let signature: String
}

@main @MainActor struct NativeWebTapParity {
    static func main() throws {
        guard CommandLine.arguments.count == 3 else {
            throw TapParityFailure(description: "Catalogue and temporary persistence directory are required")
        }
        let catalog = try JSONDecoder().decode(ProfessionalCatalog.self,
            from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
        let directory = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
        let now = ISO8601DateFormatter().date(from: "2026-10-13T12:00:00Z")!
        let store = LearningStore(catalog: catalog,
            persistence: LearningPersistence(directory: directory), now: { now }, accountService: nil,
            sessionStorage: .init(load: { nil }, save: { _ in }, clear: {}))
        var results: [NativeTapParityResult] = []
        for role in catalog.roles {
            guard let path = catalog.learningPaths?.first(where: { $0.roleId == role.id }),
                  path.wordIds.count == 90, Set(path.wordIds).count == 90 else {
                throw TapParityFailure(description: "Expected 90 unique course positions for \(role.id)")
            }
            var learner = LearnerData()
            learner.profile = LearnerProfile(roleId: role.id, seniorityId: catalog.seniorityLevels[0].id,
                situationIds: [role.situations[0].id], goalIds: role.defaultGoalIds)
            learner.lessonDayKey = "2026-10-13"
            learner.lessonRoleId = role.id
            for (index, id) in path.wordIds.enumerated() {
                learner.currentWordIds = [id]
                guard let challenge = store.practiceChallenge(for: id, record: learner),
                      challenge == store.practiceChallenge(for: id, record: learner),
                      challenge.roleId == role.id, challenge.wordId == id,
                      challenge.options.count == 3,
                      Set(challenge.options.map(\.id)).count == 3,
                      challenge.options.filter({ $0.id == challenge.correctId }).count == 1 else {
                    throw TapParityFailure(description: "Invalid or nondeterministic native challenge: \(role.id)/\(id)")
                }
                results.append(.init(roleId: role.id, wordId: id, courseIndex: index,
                    kind: challenge.kind.rawValue, correctId: challenge.correctId,
                    optionIds: challenge.options.map(\.id), signature: challenge.signature))
            }
        }
        guard results.count == 720 else {
            throw TapParityFailure(description: "Expected 720 native course positions, got \(results.count)")
        }
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        FileHandle.standardOutput.write(try encoder.encode(results))
    }
}
