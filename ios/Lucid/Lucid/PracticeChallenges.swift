import Foundation

struct PracticeChoice: Codable, Equatable, Identifiable {
    let id: String
    let text: String
    let explanation: String
}

struct PracticeChallenge: Codable, Equatable, Identifiable {
    enum Kind: String, Codable { case chooseWord, completeSentence, spotMistake }
    let key: String
    let accountToken: String
    let wordId: String
    let roleId: String
    let dayKey: String
    let kind: Kind
    let prompt: String
    let context: String
    let options: [PracticeChoice]
    let correctId: String
    let explanation: String
    var signature: String {
        // Deliberately exclude the ephemeral account token from disk identity.
        let content = [wordId, roleId, kind.rawValue, prompt, context, correctId, explanation]
            + options.flatMap { [$0.id, $0.text, $0.explanation] }
        let bytes = (try? JSONEncoder().encode(content)) ?? Data()
        return String(Self.stableHash(bytes), radix: 16)
    }
    var id: String { accountToken + "|" + key + "|" + signature }
    static func stableHash(_ bytes: Data) -> UInt64 {
        bytes.reduce(UInt64(14_695_981_039_346_656_037)) { ($0 ^ UInt64($1)) &* 1_099_511_628_211 }
    }
}

@MainActor
extension LearningStore {
    var practiceAccountToken: String { scope + ":" + accountGeneration.uuidString }

    func practiceChallenge(for wordId: String, record: LearnerData? = nil) -> PracticeChallenge? {
        let learner = record ?? data
        guard let roleId = learner.profile?.roleId, let index = learner.currentWordIds.firstIndex(of: wordId),
              let raw = catalog.words.first(where: { $0.id == wordId }), raw.roles.contains(roleId), let day = learner.lessonDayKey else { return nil }
        let target = raw.contextualized(for: roleId)
        let path = catalog.learningPaths?.first { $0.roleId == roleId }
        let seed = PracticeChallenge.stableHash(Data((roleId + ":" + wordId).utf8))
        let courseIndex = path?.wordIds.firstIndex(of: wordId) ?? index
        // Same-role, distinct meanings. Prefer a different lesson to avoid near-synonym choices.
        let lessonWords = Set(path?.lessons.first { $0.wordIds.contains(wordId) }?.wordIds ?? [])
        let confusionSets: [Set<String>] = [
            ["outstanding", "unresolved"], ["verify", "validate", "corroborate", "substantiate", "confirm"],
            ["accountability", "ownership", "responsibility"], ["clarify", "elucidate", "explain"],
            ["discrepancy", "variance", "deviation"], ["mitigate", "alleviate", "reduce"],
            ["contingency", "fallback", "contingency plan"], ["prioritize", "prioritise", "triage"],
            ["constraint", "limitation", "bottleneck"], ["assumption", "hypothesis", "premise"],
            ["service level", "service-level objective", "benchmark"], ["course-correct", "iterate", "recalibrate"],
            ["migration path", "roadmap"], ["tailored support", "coaching"]
        ]
        let excluded = confusionSets.filter { $0.contains(target.term.lowercased()) }.reduce(Set<String>()) { $0.union($1) }
        let candidates = catalog.words.filter {
            $0.id != wordId && $0.learningMode == "active" && $0.roles.contains(roleId)
        }.map { $0.contextualized(for: roleId) }.filter {
            $0.meaning != target.meaning && $0.term.lowercased() != target.term.lowercased() && !excluded.contains($0.term.lowercased())
                && !$0.meaning.localizedCaseInsensitiveContains(target.term)
                && !target.meaning.localizedCaseInsensitiveContains($0.term)
        }.sorted {
            let left = lessonWords.contains($0.id) ? 1 : 0, right = lessonWords.contains($1.id) ? 1 : 0
            if left != right { return left < right }
            return PracticeChallenge.stableHash(Data((wordId + $0.id).utf8)) < PracticeChallenge.stableHash(Data((wordId + $1.id).utf8))
        }
        guard candidates.count >= 2 else { return nil }
        let distractors = Array(candidates.prefix(2))
        var kind: PracticeChallenge.Kind = .chooseWord
        var prompt = "Which word fits?"
        var context = target.whenToUse + "\n\n" + target.meaning
        var correctId = target.id
        var explanation = "“\(target.term)” means: \(target.meaning)\n\nAt work: \(target.example)"
        var choices = ([target] + distractors).map {
            PracticeChoice(id: $0.id, text: $0.term, explanation: "“\($0.term)” means: \($0.meaning)")
        }
        if courseIndex % 3 == 1 {
            // Only blank a complete exact term. Inflected/hyphenated cases use the meaning question.
            let pattern = "(?<![\\p{L}\\p{N}])" + NSRegularExpression.escapedPattern(for: target.term) + "(?![\\p{L}\\p{N}])"
            let grammarGroup: (ProfessionalWord) -> String = { entry in
                if entry.partOfSpeech.contains("noun") { return "noun" }
                if entry.partOfSpeech.contains("verb") && !entry.partOfSpeech.contains("adverb") { return "verb" }
                return entry.partOfSpeech
            }
            let grammaticalDistractors = candidates.filter { grammarGroup($0) == grammarGroup(target) }
            if target.example.range(of: pattern, options: [.regularExpression, .caseInsensitive]) != nil,
               grammaticalDistractors.count >= 2 {
                kind = .completeSentence
                prompt = "Complete the workplace sentence"
                context = target.example.replacingOccurrences(of: pattern, with: "______", options: [.regularExpression, .caseInsensitive])
                    + "\n\nMeaning needed: " + target.meaning
                explanation = target.example + "\n\n" + target.meaning
                choices = ([target] + Array(grammaticalDistractors.prefix(2))).map {
                    PracticeChoice(id: $0.id, text: $0.term, explanation: "“\($0.term)” means: \($0.meaning)")
                }
            }
        } else if courseIndex % 3 == 2 {
            kind = .spotMistake
            prompt = "Spot the incorrect guidance for “\(target.term)”"
            context = "Two notes fit this word. Tap the one that gives it the wrong meaning."
            correctId = "mistake:" + distractors[0].id
            choices = [
                PracticeChoice(id: "meaning:" + target.id, text: "Meaning: " + target.meaning,
                               explanation: "This is the correct meaning. Look for the note that describes a different word."),
                PracticeChoice(id: "usage:" + target.id, text: "When it helps: " + target.whenToUse,
                               explanation: "This is useful guidance for this word. The incorrect note gives it another word’s meaning."),
                PracticeChoice(id: correctId, text: "Meaning: " + distractors[0].meaning,
                               explanation: "That meaning belongs to “\(distractors[0].term)”, not “\(target.term)”.")
            ]
            explanation = "That note describes “\(distractors[0].term)”.\n\n“\(target.term)” means: \(target.meaning)\n\nWatch out: \(target.avoidOrMisuse)"
        }
        if kind == .chooseWord,
           target.whenToUse.range(of: "(?<![\\p{L}\\p{N}])" + NSRegularExpression.escapedPattern(for: target.term) + "(?![\\p{L}\\p{N}])", options: [.regularExpression, .caseInsensitive]) != nil {
            context = target.meaning
        }
        let offset = Int(seed % UInt64(choices.count))
        choices = Array(choices.dropFirst(offset)) + Array(choices.prefix(offset))
        return PracticeChallenge(key: "\(day):\(roleId):\(wordId)", accountToken: practiceAccountToken,
                                 wordId: wordId, roleId: roleId, dayKey: day, kind: kind, prompt: prompt,
                                 context: context, options: choices, correctId: correctId, explanation: explanation)
    }

    func tapAttempt(for challenge: PracticeChallenge) -> TapPracticeAttempt? {
        guard let attempt = data.tapPracticeAttempts?[challenge.key], attempt.signature == challenge.signature, attempt.choices.count <= 12,
              attempt.choices.allSatisfy({ id in challenge.options.contains { $0.id == id } }) else { return nil }
        return attempt
    }

    func challengeWasUpdated(_ challenge: PracticeChallenge) -> Bool {
        data.tapPracticeAttempts?[challenge.key] != nil && tapAttempt(for: challenge) == nil
    }

    private func isCurrentChallenge(_ challenge: PracticeChallenge) -> Bool {
        !storageBlocked && !(cloudRestorePending && profile == nil) && !accountBusy && challenge.accountToken == practiceAccountToken
            && challenge.dayKey == clock().lucidDayKey && data.lessonRoleId == challenge.roleId
            && practiceChallenge(for: challenge.wordId)?.id == challenge.id
    }

    @discardableResult
    func answerPractice(_ challenge: PracticeChallenge, choiceId: String) -> Bool {
        guard isCurrentChallenge(challenge), !hasUnsavedChanges,
              !data.completedWordIdsToday.contains(challenge.wordId),
              challenge.options.contains(where: { $0.id == choiceId }) else { return false }
        var attempt = tapAttempt(for: challenge) ?? TapPracticeAttempt(signature: challenge.signature)
        guard !attempt.revealed, !attempt.choices.contains(challenge.correctId), attempt.choices.last != choiceId else { return false }
        attempt.choices = Array((attempt.choices + [choiceId]).suffix(12))
        var next = data
        var attempts = next.tapPracticeAttempts ?? [:]; attempts[challenge.key] = attempt
        next.tapPracticeAttempts = attempts
        if choiceId == challenge.correctId { introduceGuidedWord(challenge.wordId, in: &next) }
        data = next
        return !hasUnsavedChanges
    }

    @discardableResult
    func revealPractice(_ challenge: PracticeChallenge) -> Bool {
        guard isCurrentChallenge(challenge), !hasUnsavedChanges, !data.completedWordIdsToday.contains(challenge.wordId) else { return false }
        var attempt = tapAttempt(for: challenge) ?? TapPracticeAttempt(signature: challenge.signature)
        guard !attempt.revealed else { return false }
        attempt.revealed = true
        var attempts = data.tapPracticeAttempts ?? [:]; attempts[challenge.key] = attempt
        data.tapPracticeAttempts = attempts
        // Revealing alone does not award credit. Continue explicitly completes guided learning.
        return !hasUnsavedChanges
    }

    @discardableResult
    func continuePractice(_ challenge: PracticeChallenge) -> Bool {
        guard isCurrentChallenge(challenge), !hasUnsavedChanges else { return false }
        if data.completedWordIdsToday.contains(challenge.wordId) { return true }
        guard tapAttempt(for: challenge)?.revealed == true else { return false }
        var next = data
        introduceGuidedWord(challenge.wordId, in: &next)
        data = next
        return !hasUnsavedChanges
    }

    private func introduceGuidedWord(_ wordId: String, in next: inout LearnerData) {
        guard !next.completedWordIdsToday.contains(wordId) else { return }
        let now = clock()
        if !next.introducedWordIds.contains(wordId) { next.introducedWordIds.append(wordId) }
        next.progressByWordId[wordId] = next.progressByWordId[wordId]
            ?? WordProgress(introducedOn: now, nextReviewOn: now.lucidAdding(days: 1))
        next.completedWordIdsToday.append(wordId)
        next.activities = (next.activities ?? []) + [LearningActivity(id: UUID(), kind: .practice, wordId: wordId,
                          date: now, dayKey: now.lucidDayKey, quality: 2, productive: false)]
    }

    var practiceResumeWordId: String? {
        if let role = profile?.roleId, let cursor = data.practiceCursors?[role], cursor.dayKey == data.lessonDayKey,
           data.currentWordIds.contains(cursor.wordId), !data.completedWordIdsToday.contains(cursor.wordId) { return cursor.wordId }
        return data.currentWordIds.first { !data.completedWordIdsToday.contains($0) } ?? data.currentWordIds.first
    }

    @discardableResult
    func focusPracticeWord(_ wordId: String) -> Bool {
        guard !storageBlocked, !hasUnsavedChanges, !accountBusy, !(cloudRestorePending && profile == nil), data.lessonDayKey == clock().lucidDayKey,
              let role = profile?.roleId, data.currentWordIds.contains(wordId) else { return false }
        let cursor = PracticeCursor(dayKey: clock().lucidDayKey, wordId: wordId)
        if data.practiceCursors?[role] == cursor { return true }
        var cursors = data.practiceCursors ?? [:]; cursors[role] = cursor
        data.practiceCursors = cursors
        return !hasUnsavedChanges
    }

    func hasTapWorkToday(roleId: String) -> Bool {
        data.tapPracticeAttempts?.keys.contains { $0.hasPrefix("\(clock().lucidDayKey):\(roleId):") } == true
            || data.practiceCursors?[roleId]?.dayKey == clock().lucidDayKey
    }
}
