/**
 * Pure, deterministic learning rules. Dates are UTC calendar dates in YYYY-MM-DD
 * form; callers must supply them explicitly so replaying an event gives the same
 * result.
 */

export type DateKey = string;

export type Seniority =
  | "entry"
  | "mid"
  | "senior"
  | "lead"
  | "executive";

export interface LearnerProfile {
  role: string;
  seniority: Seniority;
  situations: readonly string[];
  goals: readonly string[];
}

export interface TaggedWord {
  id: string;
  active?: boolean;
  /** Terms describing roles for which the word is especially useful. */
  roles?: readonly string[];
  /** Situations such as presentations, feedback, or stakeholder meetings. */
  situations?: readonly string[];
  /** Learning goals served by the word. */
  goals?: readonly string[];
  /** Editorial usefulness rating on a 0-5 scale. */
  usefulness: number;
  /** Editorial difficulty rating on a 1-5 scale. */
  difficulty: number;
}

export const SRS_INTERVAL_DAYS = [1, 3, 7, 14, 30] as const;

export type ReviewQuality = 0 | 1 | 2 | 3;

export interface WordMastery {
  wordId: string;
  introducedOn: DateKey;
  intervalIndex: number;
  intervalDays: (typeof SRS_INTERVAL_DAYS)[number];
  nextReviewOn: DateKey;
  lastReviewedOn?: DateKey;
  lastQuality?: ReviewQuality;
  reviewCount: number;
  successfulReviewCount: number;
  lapses: number;
  productiveSuccessDates: readonly DateKey[];
  retainedAfter30Days: boolean;
  mastered: boolean;
  /** Historical first attainment; a later lapse can make `mastered` false. */
  masteredOn?: DateKey;
}

export interface ReviewAttempt {
  reviewedOn: DateKey;
  quality: ReviewQuality;
  /** True only when the learner had to produce the word, not recognise it. */
  productive: boolean;
}

export interface RankedNewWord<T extends TaggedWord> {
  word: T;
  relevanceScore: number;
  reasons: readonly string[];
}

export interface DueReview<T extends TaggedWord> {
  word: T;
  mastery: WordMastery;
  overdueDays: number;
}

export interface DailyPlan<T extends TaggedWord> {
  date: DateKey;
  activeNewWords: readonly RankedNewWord<T>[];
  dueReviews: readonly DueReview<T>[];
}

export interface DailyPlanInput<T extends TaggedWord> {
  date: DateKey;
  profile: LearnerProfile;
  words: readonly T[];
  introducedWordIds?: readonly string[];
  masteryByWordId?: Readonly<Record<string, WordMastery | undefined>>;
  /** Defaults to three; fewer are returned only when the active pool is exhausted. */
  newWordCount?: number;
}

const DAY_MS = 86_400_000;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function dateToUtcMilliseconds(date: DateKey): number {
  const match = DATE_PATTERN.exec(date);
  if (!match) {
    throw new Error(`Invalid date "${date}"; expected YYYY-MM-DD.`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const milliseconds = Date.UTC(year, month - 1, day);
  const roundTrip = new Date(milliseconds).toISOString().slice(0, 10);

  if (roundTrip !== date) {
    throw new Error(`Invalid calendar date "${date}".`);
  }

  return milliseconds;
}

export function addCalendarDays(date: DateKey, days: number): DateKey {
  if (!Number.isInteger(days)) {
    throw new Error("Calendar day offsets must be integers.");
  }

  return new Date(dateToUtcMilliseconds(date) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

export function calendarDaysBetween(from: DateKey, to: DateKey): number {
  return (dateToUtcMilliseconds(to) - dateToUtcMilliseconds(from)) / DAY_MS;
}

export function createWordMastery(
  wordId: string,
  introducedOn: DateKey,
): WordMastery {
  if (!wordId.trim()) {
    throw new Error("A mastery state requires a word ID.");
  }
  dateToUtcMilliseconds(introducedOn);

  return {
    wordId,
    introducedOn,
    intervalIndex: 0,
    intervalDays: SRS_INTERVAL_DAYS[0],
    nextReviewOn: addCalendarDays(introducedOn, SRS_INTERVAL_DAYS[0]),
    reviewCount: 0,
    successfulReviewCount: 0,
    lapses: 0,
    productiveSuccessDates: [],
    retainedAfter30Days: false,
    mastered: false,
  };
}

function nextIntervalIndex(current: number, quality: ReviewQuality): number {
  const lastIndex = SRS_INTERVAL_DAYS.length - 1;

  switch (quality) {
    case 0:
      return 0;
    case 1:
      return Math.max(0, current - 1);
    case 2:
      return Math.min(lastIndex, current + 1);
    case 3:
      return Math.min(lastIndex, current + 2);
  }
}

/**
 * Applies an SRS result without mutation. Quality 0 is a lapse and resets to one
 * day; 1 steps back; 2 advances one interval; 3 advances two intervals.
 */
export function reviewWord(
  state: WordMastery,
  attempt: ReviewAttempt,
): WordMastery {
  dateToUtcMilliseconds(attempt.reviewedOn);
  if (![0, 1, 2, 3].includes(attempt.quality)) {
    throw new Error("Review quality must be an integer from 0 to 3.");
  }

  const chronologicalFloor = state.lastReviewedOn ?? state.introducedOn;
  if (calendarDaysBetween(chronologicalFloor, attempt.reviewedOn) < 0) {
    throw new Error("A review cannot precede the word's prior learning event.");
  }

  const intervalIndex = nextIntervalIndex(
    Math.max(0, Math.min(SRS_INTERVAL_DAYS.length - 1, state.intervalIndex)),
    attempt.quality,
  );
  const intervalDays = SRS_INTERVAL_DAYS[intervalIndex];
  const successful = attempt.quality >= 2;
  const productiveSuccess = successful && attempt.productive;
  const productiveSuccessDates = productiveSuccess
    ? [...new Set([...state.productiveSuccessDates, attempt.reviewedOn])].sort()
    : [...state.productiveSuccessDates];
  const retainedAfter30Days = productiveSuccessDates.some(
    (date) => calendarDaysBetween(state.introducedOn, date) >= 30,
  );
  const hasMasteryEvidence =
    productiveSuccessDates.length >= 3 && retainedAfter30Days;
  // A weak answer after attaining mastery suspends current mastery until a
  // subsequent successful retrieval, while keeping the historical evidence.
  const mastered = hasMasteryEvidence && successful;

  return {
    ...state,
    intervalIndex,
    intervalDays,
    nextReviewOn: addCalendarDays(attempt.reviewedOn, intervalDays),
    lastReviewedOn: attempt.reviewedOn,
    lastQuality: attempt.quality,
    reviewCount: state.reviewCount + 1,
    successfulReviewCount: state.successfulReviewCount + (successful ? 1 : 0),
    lapses: state.lapses + (attempt.quality === 0 ? 1 : 0),
    productiveSuccessDates,
    retainedAfter30Days,
    mastered,
    masteredOn:
      state.masteredOn ?? (mastered ? attempt.reviewedOn : undefined),
  };
}

export function isWordMastered(state: WordMastery): boolean {
  const productiveSuccessDates = [...new Set(state.productiveSuccessDates)];
  const hasThirtyDayRetention = productiveSuccessDates.some(
    (date) => calendarDaysBetween(state.introducedOn, date) >= 30,
  );
  return (
    productiveSuccessDates.length >= 3 &&
    hasThirtyDayRetention &&
    (state.lastQuality ?? 0) >= 2
  );
}

const TARGET_DIFFICULTY: Record<Seniority, number> = {
  entry: 2,
  mid: 3,
  senior: 4,
  lead: 4,
  executive: 4,
};

const MATCH_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "for",
  "in",
  "of",
  "on",
  "the",
  "to",
  "with",
]);

function normalize(value: string): string {
  return value
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function significantTokens(value: string): Set<string> {
  return new Set(
    normalize(value)
      .split(" ")
      .filter((token) => token.length > 1 && !MATCH_STOP_WORDS.has(token)),
  );
}

function phrasesMatch(left: string, right: string): boolean {
  const normalizedLeft = normalize(left);
  const normalizedRight = normalize(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (
    normalizedLeft === normalizedRight ||
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  ) {
    return true;
  }

  const leftTokens = significantTokens(left);
  const rightTokens = significantTokens(right);
  return [...leftTokens].some((token) => rightTokens.has(token));
}

function matchRatio(
  learnerTerms: readonly string[],
  wordTerms: readonly string[] | undefined,
): number {
  if (learnerTerms.length === 0 || !wordTerms?.length) return 0;
  const matched = learnerTerms.filter((term) =>
    wordTerms.some((wordTerm) => phrasesMatch(term, wordTerm)),
  ).length;
  return matched / learnerTerms.length;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function stableHash(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function rankNewWord<T extends TaggedWord>(
  word: T,
  profile: LearnerProfile,
): Omit<RankedNewWord<T>, "word"> {
  const roleFit = matchRatio([profile.role], word.roles);
  const situationFit = matchRatio(profile.situations, word.situations);
  const goalFit = matchRatio(profile.goals, word.goals);
  const usefulness = clamp(word.usefulness, 0, 5) / 5;
  const difficultyFit =
    1 - Math.abs(clamp(word.difficulty, 1, 5) - TARGET_DIFFICULTY[profile.seniority]) / 4;
  const relevanceScore = Math.round(
    (roleFit * 28 +
      situationFit * 24 +
      goalFit * 18 +
      usefulness * 20 +
      difficultyFit * 10) *
      10,
  ) / 10;
  const reasons: string[] = [];
  if (roleFit > 0) reasons.push(`Relevant to ${profile.role}`);
  if (situationFit > 0) reasons.push("Matches a selected situation");
  if (goalFit > 0) reasons.push("Supports a selected goal");
  if (usefulness >= 0.8) reasons.push("High practical usefulness");
  if (difficultyFit >= 0.75) reasons.push("Suitable difficulty");

  return { relevanceScore, reasons };
}

/** Selects all due reviews and, by default, exactly three unseen active words. */
export function createDailyPlan<T extends TaggedWord>(
  input: DailyPlanInput<T>,
): DailyPlan<T> {
  dateToUtcMilliseconds(input.date);
  const newWordCount = input.newWordCount ?? 3;
  if (!Number.isInteger(newWordCount) || newWordCount < 0) {
    throw new Error("newWordCount must be a non-negative integer.");
  }

  const masteryByWordId = input.masteryByWordId ?? {};
  const introducedIds = new Set([
    ...(input.introducedWordIds ?? []),
    ...Object.keys(masteryByWordId),
  ]);
  const seenWordIds = new Set<string>();
  const activeWords = input.words.filter((word) => {
    if (!word.id.trim()) throw new Error("Every learning word requires an ID.");
    if (!Number.isFinite(word.usefulness) || !Number.isFinite(word.difficulty)) {
      throw new Error(`Word "${word.id}" requires numeric usefulness and difficulty ratings.`);
    }
    if (word.active === false || seenWordIds.has(word.id)) return false;
    seenWordIds.add(word.id);
    return true;
  });
  const activeNewWords = activeWords
    .filter((word) => !introducedIds.has(word.id))
    .map((word) => ({ word, ...rankNewWord(word, input.profile) }))
    .sort(
      (left, right) =>
        right.relevanceScore - left.relevanceScore ||
        stableHash(`${input.date}:${left.word.id}`) -
          stableHash(`${input.date}:${right.word.id}`) ||
        left.word.id.localeCompare(right.word.id),
    )
    .slice(0, newWordCount);

  const dueReviews = activeWords
    .flatMap((word): DueReview<T>[] => {
      const mastery = masteryByWordId[word.id];
      if (!mastery || calendarDaysBetween(mastery.nextReviewOn, input.date) < 0) {
        return [];
      }
      return [
        {
          word,
          mastery,
          overdueDays: calendarDaysBetween(mastery.nextReviewOn, input.date),
        },
      ];
    })
    .sort(
      (left, right) =>
        right.overdueDays - left.overdueDays ||
        right.mastery.lapses - left.mastery.lapses ||
        left.mastery.nextReviewOn.localeCompare(right.mastery.nextReviewOn) ||
        left.word.id.localeCompare(right.word.id),
    );

  return { date: input.date, activeNewWords, dueReviews };
}

export type UsageFeedbackDimension =
  | "meaningContext"
  | "grammarForm"
  | "collocation"
  | "professionalTone";

export interface UsageDimensionFeedback {
  score: number;
  confidence: "low" | "medium" | "high";
  evidence: readonly string[];
  suggestions: readonly string[];
}

export interface UsageFeedbackInput {
  sentence: string;
  targetWord: string;
  partOfSpeech?: "noun" | "adjective" | "verb" | "adverb";
  /** Inflections or spelling variants that should count as the target word. */
  allowedForms?: readonly string[];
  meaning?: string;
  meaningKeywords?: readonly string[];
  /** Expected phrases, optionally using `{word}` as a placeholder. */
  expectedCollocations?: readonly string[];
}

export interface UsageFeedback {
  method: "local-rule-based-heuristics";
  limitation: string;
  targetFound: boolean;
  overallScore: number;
  dimensions: Readonly<
    Record<UsageFeedbackDimension, UsageDimensionFeedback>
  >;
  suggestions: readonly string[];
}

const MEANING_STOP_WORDS = new Set([
  ...MATCH_STOP_WORDS,
  "able",
  "being",
  "especially",
  "something",
  "someone",
  "that",
  "this",
  "very",
  "when",
  "which",
  "while",
]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsPhrase(text: string, phrase: string): boolean {
  const normalizedPhrase = normalize(phrase);
  return normalizedPhrase.length > 0 && normalize(text).includes(normalizedPhrase);
}

function deriveMeaningKeywords(input: UsageFeedbackInput): string[] {
  if (input.meaningKeywords?.length) {
    return input.meaningKeywords.filter((keyword) => normalize(keyword).length > 0);
  }
  if (!input.meaning) return [];
  return normalize(input.meaning)
    .split(" ")
    .filter((token) => token.length > 3 && !MEANING_STOP_WORDS.has(token))
    .slice(0, 8);
}

function assessMeaning(
  input: UsageFeedbackInput,
  targetFound: boolean,
): UsageDimensionFeedback {
  if (!targetFound) {
    return {
      score: 0,
      confidence: "high",
      evidence: ["The target word or an allowed form was not found."],
      suggestions: [`Use “${input.targetWord}” explicitly in the sentence.`],
    };
  }

  const tokens = normalize(input.sentence).split(" ").filter(Boolean);
  const keywords = deriveMeaningKeywords(input);
  if (tokens.length < 5) {
    return {
      score: 35,
      confidence: "medium",
      evidence: ["The sentence provides very little surrounding context."],
      suggestions: [
        "Add a concrete cause, decision, action, or consequence that shows the intended meaning.",
      ],
    };
  }
  if (keywords.length === 0) {
    return {
      score: 70,
      confidence: "low",
      evidence: ["The target appears in a complete context."],
      suggestions: [
        "Make the intended meaning unmistakable with a specific workplace detail.",
      ],
    };
  }

  const matches = keywords.filter((keyword) =>
    containsPhrase(input.sentence, keyword),
  );
  const score = matches.length === 0 ? 45 : Math.min(100, 65 + matches.length * 15);
  return {
    score,
    confidence: matches.length >= 2 ? "medium" : "low",
    evidence:
      matches.length > 0
        ? [`Context includes meaning signals: ${matches.join(", ")}.`]
        : ["No supplied meaning signals were found in the surrounding context."],
    suggestions:
      matches.length > 0
        ? []
        : [
            `Add context connected to ${keywords.slice(0, 3).join(", ")}.`,
          ],
  };
}

function assessGrammar(
  input: UsageFeedbackInput,
  targetFound: boolean,
): UsageDimensionFeedback {
  if (!targetFound) {
    return {
      score: 0,
      confidence: "high",
      evidence: ["The requested word form is absent."],
      suggestions: [
        `Use “${input.targetWord}”${input.partOfSpeech ? ` as a ${input.partOfSpeech}` : ""}.`,
      ],
    };
  }

  let score = 100;
  const evidence: string[] = ["The target appears as a separate word or allowed form."];
  const suggestions: string[] = [];
  const trimmed = input.sentence.trim();
  if (trimmed && /^[a-z]/.test(trimmed)) {
    score -= 10;
    suggestions.push("Start the sentence with a capital letter.");
  }
  if (trimmed && !/[.!?]$/.test(trimmed)) {
    score -= 5;
    suggestions.push("Finish the sentence with appropriate punctuation.");
  }
  if (normalize(trimmed).split(" ").filter(Boolean).length < 4) {
    score -= 20;
    suggestions.push("Use a full clause so the word's grammatical role is clear.");
  }
  if (input.partOfSpeech) {
    evidence.push(
      `The requested part of speech is ${input.partOfSpeech}; this local check cannot parse syntax reliably.`,
    );
  }

  return {
    score: clamp(score, 0, 100),
    confidence: input.partOfSpeech ? "low" : "medium",
    evidence,
    suggestions,
  };
}

function assessCollocation(
  input: UsageFeedbackInput,
  targetFound: boolean,
): UsageDimensionFeedback {
  if (!targetFound) {
    return {
      score: 0,
      confidence: "high",
      evidence: ["A collocation cannot be checked without the target word."],
      suggestions: [`Add “${input.targetWord}” in a natural phrase.`],
    };
  }

  const collocations = (input.expectedCollocations ?? []).map((phrase) =>
    phrase.replaceAll("{word}", input.targetWord),
  ).filter((phrase) => normalize(phrase).length > 0);
  if (collocations.length === 0) {
    return {
      score: 65,
      confidence: "low",
      evidence: ["No reference collocations were supplied for comparison."],
      suggestions: [
        "Check the words immediately before and after the target against a trusted dictionary example.",
      ],
    };
  }

  const matches = collocations.filter((phrase) =>
    containsPhrase(input.sentence, phrase),
  );
  return matches.length > 0
    ? {
        score: 100,
        confidence: "high",
        evidence: [`Matched the reference phrase “${matches[0]}”.`],
        suggestions: [],
      }
    : {
        score: 45,
        confidence: "medium",
        evidence: ["The target appears, but no reference collocation matched."],
        suggestions: [
          `Try a reference pattern such as “${collocations[0]}”.`,
        ],
      };
}

const INFORMAL_OR_BLUNT_PATTERNS: readonly [RegExp, string][] = [
  [/\b(?:gonna|wanna|kinda|sorta)\b/i, "Replace conversational shorthand with a complete form."],
  [/\b(?:whatever|stupid|ridiculous)\b/i, "Replace dismissive wording with a neutral description of the issue."],
  [/\b(?:you failed|your fault)\b/i, "Describe the outcome and next action instead of assigning personal blame."],
];

function assessProfessionalTone(sentence: string): UsageDimensionFeedback {
  let score = 100;
  const evidence: string[] = [];
  const suggestions: string[] = [];
  const exclamations = sentence.match(/!/g)?.length ?? 0;
  if (exclamations > 1) {
    score -= 15;
    suggestions.push("Use at most one exclamation mark in professional writing.");
  }
  if (/\b[A-Z]{4,}\b/.test(sentence)) {
    score -= 15;
    suggestions.push("Replace all-capital emphasis with precise wording.");
  }
  if (/[\u{1F300}-\u{1FAFF}]/u.test(sentence)) {
    score -= 10;
    suggestions.push("Remove emoji when the audience or channel is formal.");
  }
  for (const [pattern, suggestion] of INFORMAL_OR_BLUNT_PATTERNS) {
    if (pattern.test(sentence)) {
      score -= 20;
      suggestions.push(suggestion);
    }
  }
  if (suggestions.length === 0) {
    evidence.push("No configured shorthand, blame language, or excessive emphasis was found.");
  } else {
    evidence.push("One or more configured tone-risk patterns were found.");
  }

  return {
    score: clamp(score, 0, 100),
    confidence: "medium",
    evidence,
    suggestions,
  };
}

/**
 * Gives transparent local feedback. It uses literal matches and surface rules,
 * not semantic understanding, so its limitation is always returned to callers.
 */
export function evaluateUsage(input: UsageFeedbackInput): UsageFeedback {
  const sentence = input.sentence.trim();
  const forms = [input.targetWord, ...(input.allowedForms ?? [])]
    .map((form) => form.trim())
    .filter(Boolean);
  if (!sentence) throw new Error("A sentence is required for usage feedback.");
  if (forms.length === 0) throw new Error("A target word is required.");

  const targetPattern = new RegExp(
    `\\b(?:${forms.map(escapeRegExp).join("|")})\\b`,
    "i",
  );
  const targetFound = targetPattern.test(sentence);
  const dimensions = {
    meaningContext: assessMeaning(input, targetFound),
    grammarForm: assessGrammar(input, targetFound),
    collocation: assessCollocation(input, targetFound),
    professionalTone: assessProfessionalTone(sentence),
  } satisfies Record<UsageFeedbackDimension, UsageDimensionFeedback>;
  const overallScore = Math.round(
    Object.values(dimensions).reduce((sum, item) => sum + item.score, 0) / 4,
  );
  const suggestions = [
    ...new Set(
      Object.values(dimensions).flatMap((dimension) => dimension.suggestions),
    ),
  ];

  return {
    method: "local-rule-based-heuristics",
    limitation:
      "This is a transparent rule-based check of surface signals. It cannot reliably verify nuanced meaning, grammar, or naturalness.",
    targetFound,
    overallScore,
    dimensions,
    suggestions,
  };
}
