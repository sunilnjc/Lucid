export type DailyIdiom = {
  readonly id: string;
  readonly phrase: string;
  readonly meaning: string;
  readonly example: string;
  readonly register: string;
  readonly context: string;
  readonly plainEnglish: string;
  readonly avoid?: string;
};

// Original learning copy. These are useful expressions, not proficiency levels.
// IDs and order form the v1 daily rotation contract; do not reorder existing entries.
// Viewing an idiom does not create word mastery or successful recall evidence.
export const dailyIdioms: readonly DailyIdiom[] = Object.freeze([
  {
    id: "same-page",
    phrase: "on the same page",
    meaning: "Sharing an understanding of the plan or agreeing about what should happen.",
    example: "Before we send the proposal, let's check that we are on the same page about the deadline.",
    register: "Conversational; useful in team discussions.",
    context: "Check shared understanding before people act on a plan.",
    plainEnglish: "We agree about the plan.",
    avoid: "In a formal record, state exactly what people agreed to rather than assuming agreement.",
  },
  {
    id: "get-ball-rolling",
    phrase: "get the ball rolling",
    meaning: "Take the first action that helps an activity begin.",
    example: "I'll get the ball rolling by drafting the agenda for our planning session.",
    register: "Conversational; suitable for an informal work message.",
    context: "Offer a concrete first step when starting a project or discussion.",
    plainEnglish: "Start the process.",
  },
  {
    id: "keep-in-loop",
    phrase: "keep someone in the loop",
    meaning: "Continue giving someone the updates they need to follow what is happening.",
    example: "Please keep Priya in the loop if the delivery date changes.",
    register: "Conversational; common in workplace messages.",
    context: "Ask colleagues to include someone in relevant updates.",
    plainEnglish: "Keep someone informed.",
    avoid: "Being informed does not necessarily mean having authority to approve a decision.",
  },
  {
    id: "ballpark-figure",
    phrase: "a ballpark figure",
    meaning: "An approximate amount used before an exact calculation is available.",
    example: "Could you give us a ballpark figure for the workshop costs before we choose a venue?",
    register: "Conversational; useful in early planning.",
    context: "Discuss an initial estimate while making its uncertainty clear.",
    plainEnglish: "An approximate estimate.",
    avoid: "Do not present a ballpark figure as an approved budget or a precise quotation.",
  },
  {
    id: "on-fence",
    phrase: "on the fence",
    meaning: "Still undecided between options or unwilling to choose a side.",
    example: "I'm on the fence about the new supplier until we compare the support terms.",
    register: "Conversational; suitable for informal discussion.",
    context: "Describe your own uncertainty and explain what would help you decide.",
    plainEnglish: "Still undecided.",
    avoid: "Calling another person on the fence can sound critical; ask what information they need instead.",
  },
  {
    id: "up-in-air",
    phrase: "up in the air",
    meaning: "Not decided or confirmed yet, so the outcome remains uncertain.",
    example: "The training date is still up in the air because the venue has not confirmed availability.",
    register: "Conversational; useful for informal status updates.",
    context: "Explain that a plan is unsettled, ideally naming the missing decision.",
    plainEnglish: "Not confirmed yet.",
    avoid: "Use a specific status and next step when others need a reliable commitment.",
  },
  {
    id: "cut-corners",
    phrase: "cut corners",
    meaning: "Save time, effort or money by leaving out steps, often reducing quality.",
    example: "We can simplify the report, but we should not cut corners on checking the figures.",
    register: "Conversational; often carries criticism.",
    context: "Warn about shortcuts that compromise the work rather than describing an ordinary efficiency improvement.",
    plainEnglish: "Skip needed steps to save effort.",
    avoid: "It can imply poor standards. Describe the specific omitted step before accusing someone of cutting corners.",
  },
  {
    id: "raise-bar",
    phrase: "raise the bar",
    meaning: "Make the expected level of quality or performance more demanding.",
    example: "The new accessibility checklist will raise the bar for every release.",
    register: "Conversational; also used in professional discussion.",
    context: "Describe a higher standard and explain what meeting it requires.",
    plainEnglish: "Set a higher standard.",
    avoid: "A higher standard still needs clear criteria; the idiom alone does not define success.",
  },
  {
    id: "back-square-one",
    phrase: "back to square one",
    meaning: "Needing to begin again after an attempt or plan has failed.",
    example: "When the venue cancelled our booking, we were back to square one with the event plan.",
    register: "Conversational; can sound discouraged.",
    context: "Describe a genuine restart after a setback.",
    plainEnglish: "We need to start again.",
    avoid: "Do not dismiss useful work or lessons if only part of the plan needs to change.",
  },
  {
    id: "big-picture",
    phrase: "the big picture",
    meaning: "The overall situation and how its parts connect, beyond one detail.",
    example: "The big picture is that faster delivery must still leave enough time for quality checks.",
    register: "Conversational; useful in planning discussions.",
    context: "Connect a detailed decision to the wider goal or its consequences.",
    plainEnglish: "The overall situation.",
    avoid: "Asking someone to see the big picture can sound dismissive if you ignore their specific concern.",
  },
  {
    id: "read-between-lines",
    phrase: "read between the lines",
    meaning: "Infer a message that is suggested but not stated openly.",
    example: "Reading between the lines, I think they need a longer deadline, so I'll ask them directly.",
    register: "Conversational; useful when discussing possible implications.",
    context: "Describe an interpretation while acknowledging that it may need confirmation.",
    plainEnglish: "Infer what is implied.",
    avoid: "An inference is not a fact. Confirm important intentions instead of treating your interpretation as certain.",
  },
  {
    id: "touch-base",
    phrase: "touch base",
    meaning: "Make brief contact with someone, usually to exchange updates.",
    example: "Let's touch base on Thursday to check whether the draft is ready for review.",
    register: "Conversational; workplace shorthand.",
    context: "Arrange a short follow-up with a clear purpose and time.",
    plainEnglish: "Check in briefly.",
    avoid: "A vague request to touch base can hide the purpose; say what you want to discuss.",
  },
  {
    id: "break-ice",
    phrase: "break the ice",
    meaning: "Help a conversation begin and make people feel less awkward at first.",
    example: "A quick round of introductions helped break the ice before the workshop.",
    register: "Conversational; suitable for social and team settings.",
    context: "Describe an easy opening when people are meeting for the first time.",
    plainEnglish: "Help people start talking comfortably.",
    avoid: "Do not pressure people to share personal details or use jokes at someone else's expense.",
  },
  {
    id: "learn-ropes",
    phrase: "learn the ropes",
    meaning: "Become familiar with the practical steps and routines of a new activity.",
    example: "During my first week, a colleague helped me learn the ropes of the monthly reporting process.",
    register: "Conversational; useful in everyday work discussion.",
    context: "Describe getting used to a new role, process or responsibility.",
    plainEnglish: "Learn how the work is done.",
    avoid: "It describes getting familiar with the work, not proof that someone can do it independently.",
  },
].map((idiom) => Object.freeze(idiom)));

/**
 * Sense-check references reviewed on 15 October 2026. Definitions, examples,
 * context and register guidance above are original editorial learning copy.
 * No dictionary request is made at runtime, and there is no proficiency claim.
 */
export const dailyIdiomEditorialSources = Object.freeze([
  { id: "same-page", url: "https://www.merriam-webster.com/dictionary/on%20the%20same%20page" },
  { id: "get-ball-rolling", url: "https://www.merriam-webster.com/dictionary/get%20the%20ball%20rolling" },
  { id: "keep-in-loop", url: "https://www.merriam-webster.com/dictionary/in%20the%20loop" },
  { id: "ballpark-figure", url: "https://www.merriam-webster.com/dictionary/ballpark" },
  { id: "on-fence", url: "https://www.merriam-webster.com/dictionary/on%20the%20fence" },
  { id: "up-in-air", url: "https://www.merriam-webster.com/dictionary/up%20in%20the%20air" },
  { id: "cut-corners", url: "https://www.merriam-webster.com/dictionary/cut%20corners" },
  { id: "raise-bar", url: "https://www.merriam-webster.com/dictionary/raise%20the%20bar" },
  { id: "back-square-one", url: "https://www.merriam-webster.com/dictionary/square%20one" },
  { id: "big-picture", url: "https://www.merriam-webster.com/dictionary/the%20big%20picture" },
  { id: "read-between-lines", url: "https://www.merriam-webster.com/dictionary/read%20between%20the%20lines" },
  { id: "touch-base", url: "https://www.merriam-webster.com/dictionary/touch%20base" },
  { id: "break-ice", url: "https://www.merriam-webster.com/dictionary/break%20the%20ice" },
  { id: "learn-ropes", url: "https://www.merriam-webster.com/dictionary/the%20ropes" },
].map((source) => Object.freeze(source)));

/** One deterministic idiom for the learner's already-resolved calendar day. */
export function dailyIdiomForDay(day: string): DailyIdiom {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new RangeError("Expected a valid calendar day in YYYY-MM-DD format.");
  }
  const midnight = new Date(`${day}T00:00:00.000Z`);
  if (!Number.isFinite(midnight.getTime()) || midnight.toISOString().slice(0, 10) !== day) {
    throw new RangeError("Expected a valid calendar day in YYYY-MM-DD format.");
  }
  const ordinal = Math.floor(midnight.getTime() / 86_400_000);
  const index = ((ordinal % dailyIdioms.length) + dailyIdioms.length) % dailyIdioms.length;
  return dailyIdioms[index];
}
