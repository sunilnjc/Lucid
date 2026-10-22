/** Authored alternatives and local practice rules. No text is sent to a provider. */
import type { RoleId, ProfessionalWord } from "./professional-content";

export type ExpressionTheme = "emotions" | "intellectual" | "leadership";
export type ExpressionGoal = "clarify" | "align" | "influence" | "recommend" | "negotiate" | "challenge-diplomatically" | "coach" | "reassure";
export type ScenarioKind = "meeting" | "interview" | "disagreement";
export type ExpressionContrast = { nearby: string; distinction: string; fitting: string; awkward: string; explanation: string };
export type ExpressionEntry = {
  id: string; wordId: string; term: string; roleIds: RoleId[]; senseId: string;
  title: string; theme: ExpressionTheme; goalIds: ExpressionGoal[]; intentKeywords: string[];
  plain: string; precise: string; diplomatic: string; register: string; collocations: string[];
  misuse: string; contrasts: ExpressionContrast[];
};
export type ExpressionScenario = {
  id: string; expressionId: string; roleIds: RoleId[]; kind: ScenarioKind; wordIds: string[];
  prompt: string; focus: string; exampleResponse: string; freshPrompt: string; freshExampleResponse: string;
};

const expressions: ExpressionEntry[] = [
  {
    id: "explain-the-reason", wordId: "finance-rationale", term: "rationale", senseId: "reason-for-choice",
    roleIds: ["finance-accounting", "project-product", "sales-business-development", "technology-engineering", "people-human-resources", "healthcare", "consulting-strategy"],
    title: "Explain why you chose an approach", theme: "intellectual", goalIds: ["clarify", "recommend", "influence"],
    intentKeywords: ["reason", "why", "explain", "choice", "decision", "approach"],
    plain: "We chose this approach because it reduces the risk of rework.",
    precise: "The rationale for this approach is to reduce the risk of rework.",
    diplomatic: "Could I explain the reasoning behind this approach before we decide?",
    register: "Rationale suits a considered explanation in a meeting or written recommendation. Reason is often warmer and clearer in an everyday conversation.",
    collocations: ["rationale for", "explain the rationale", "underlying rationale"],
    misuse: "A rationale explains a choice; it is not evidence that the choice is correct.",
    contrasts: [{ nearby: "justification", distinction: "Rationale explains the reasoning; justification defends whether a choice is acceptable.", fitting: "The rationale for the pilot is to learn before committing.", awkward: "The rationale proves the pilot will succeed.", explanation: "An explanation of a decision is not proof of its outcome." }],
  },
  {
    id: "evidence-to-decision", wordId: "finance-substantiate", term: "substantiate", senseId: "evidence-support",
    roleIds: ["finance-accounting", "consulting-strategy", "sales-business-development", "operations-supply-chain", "technology-engineering", "people-human-resources"],
    title: "Ask what supports a claim", theme: "intellectual", goalIds: ["clarify", "challenge-diplomatically", "recommend"],
    intentKeywords: ["evidence", "proof", "support", "estimate", "claim", "assumption", "data"],
    plain: "What evidence supports that estimate?", precise: "What evidence would substantiate that estimate?",
    diplomatic: "Could we examine the evidence behind that estimate before committing?",
    register: "Substantiate is formal and useful when a claim needs evidence. In a quick conversation, support is usually enough.",
    collocations: ["substantiate a claim", "substantiate the estimate", "evidence to substantiate"],
    misuse: "Explaining a claim does not substantiate it. Avoid demanding impossible proof before listening to someone's experience.",
    contrasts: [{ nearby: "corroborate", distinction: "Substantiate supplies supporting evidence; corroborate adds confirming evidence to an existing account.", fitting: "The records substantiate the estimate; a second source corroborates the dates.", awkward: "I substantiate the estimate because I feel confident.", explanation: "Confidence alone is not supporting evidence." }],
  },
  {
    id: "name-the-choice", wordId: "project-trade-off", term: "trade-off", senseId: "competing-benefits",
    roleIds: ["project-product", "technology-engineering", "consulting-strategy", "sales-business-development", "operations-supply-chain", "people-human-resources"],
    title: "Make competing priorities clear", theme: "intellectual", goalIds: ["recommend", "negotiate", "align"],
    intentKeywords: ["balance", "speed", "cost", "priority", "priorities", "compromise", "benefit", "risk"],
    plain: "We can finish sooner, but we will have less time to check the result.",
    precise: "The trade-off is faster delivery versus more time for verification.",
    diplomatic: "Could we agree which matters more here: timing or additional verification?",
    register: "Trade-off is natural in professional discussion when you name both sides. Explain the actual consequence instead of hiding it behind jargon.",
    collocations: ["trade-off between", "the trade-off is", "weigh the trade-offs"],
    misuse: "Do not call every inconvenience a trade-off. Name what improves and what is given up.",
    contrasts: [{ nearby: "compromise", distinction: "A trade-off is a relationship between benefits and costs; a compromise is a negotiated middle position.", fitting: "We discussed the trade-off, then agreed a compromise on scope.", awkward: "The trade-off is that everything gets better with no cost.", explanation: "A trade-off requires something to be given up." }],
  },
  {
    id: "bridge-the-difference", wordId: "finance-reconcile", term: "reconcile", senseId: "resolve-difference",
    roleIds: ["finance-accounting", "sales-business-development", "healthcare", "consulting-strategy"],
    title: "Bring conflicting accounts together", theme: "intellectual", goalIds: ["clarify", "align", "negotiate"],
    intentKeywords: ["different", "difference", "conflict", "conflicting", "match", "records", "figures", "inconsistent"],
    plain: "Let's compare the two accounts and explain the differences.",
    precise: "Let's reconcile the two accounts before making a decision.",
    diplomatic: "Could we work through the differences so we have a shared picture?",
    register: "Reconcile is precise for checking differences or making ideas compatible. With people, describe the disagreement rather than making the conversation sound like an accounting exercise.",
    collocations: ["reconcile the differences", "reconcile the records", "reconcile two accounts"],
    misuse: "Reconciliation involves explaining or resolving differences, not just changing one number to match another.",
    contrasts: [{ nearby: "align", distinction: "Reconcile addresses a difference; align establishes a shared direction or understanding.", fitting: "We reconciled the figures, then aligned on the next action.", awkward: "I reconciled the discrepancy by ignoring the missing record.", explanation: "Ignoring a difference does not explain or resolve it." }],
  },
  {
    id: "hear-before-answering", wordId: "sales-business-development-acknowledge", term: "acknowledge", senseId: "recognise-perspective",
    roleIds: ["sales-business-development", "people-human-resources", "healthcare", "consulting-strategy"],
    title: "Show you heard the concern", theme: "emotions", goalIds: ["reassure", "challenge-diplomatically", "coach"],
    intentKeywords: ["hear", "heard", "listen", "concern", "frustrated", "understand", "dismissed"],
    plain: "I hear your concern about the extra workload.",
    precise: "I acknowledge your concern about the extra workload.",
    diplomatic: "I can see why the workload worries you. Let's look at what could change.",
    register: "I hear your concern often sounds warmer than I acknowledge your concern. Choose the wording that fits the relationship.",
    collocations: ["acknowledge the concern", "acknowledge your concern", "acknowledge the impact"],
    misuse: "Acknowledging a concern does not mean agreeing with every claim or promising an outcome.",
    contrasts: [{ nearby: "agree", distinction: "Acknowledge recognises that a perspective exists or matters; agree accepts its substance.", fitting: "I acknowledge the concern, although I see the proposed solution differently.", awkward: "I acknowledge you, so your conclusion must be correct.", explanation: "Recognition and agreement are different commitments." }],
  },
  {
    id: "name-what-is-unknown", wordId: "people-human-resources-uncertainty", term: "uncertainty", senseId: "limits-of-knowledge",
    roleIds: ["people-human-resources", "healthcare", "consulting-strategy"],
    title: "Be honest about what you do not know", theme: "emotions", goalIds: ["reassure", "clarify", "recommend"],
    intentKeywords: ["unsure", "unknown", "uncertain", "worry", "worried", "change", "promise", "nervous"],
    plain: "We do not know the final timing yet. I will share an update on Friday.",
    precise: "There is uncertainty about the timing; our next update is on Friday.",
    diplomatic: "I understand that waiting is difficult. Here is what we know and when we will update you.",
    register: "Uncertainty is neutral. Pair it with what is known and a concrete next step; avoid using it as a vague reason to withhold information.",
    collocations: ["uncertainty about", "reduce uncertainty", "remaining uncertainty"],
    misuse: "Uncertainty means limited knowledge; it is not a guarantee that the worst or best outcome will occur.",
    contrasts: [{ nearby: "ambiguity", distinction: "Uncertainty is not knowing an outcome; ambiguity is having more than one plausible meaning.", fitting: "The date is uncertain, while the phrase 'soon' is ambiguous.", awkward: "The date has uncertainty, so it definitely will be delayed.", explanation: "Lack of knowledge does not establish a particular outcome." }],
  },
  {
    id: "recognise-the-feeling", wordId: "healthcare-empathy", term: "empathy", senseId: "understand-perspective",
    roleIds: ["healthcare"], title: "Respond to a difficult feeling", theme: "emotions", goalIds: ["reassure", "coach"],
    intentKeywords: ["sad", "upset", "feel", "feeling", "fear", "scared", "distressed", "emotional"],
    plain: "That sounds difficult. What is worrying you most?",
    precise: "Empathy starts with understanding what feels difficult from your perspective.",
    diplomatic: "I want to understand what this has been like for you. Would you like to tell me more?",
    register: "Showing empathy usually matters more than saying the word empathy. Plain, attentive questions often fit better than formal labels.",
    collocations: ["show empathy", "empathy for", "respond with empathy"],
    misuse: "Do not say you know exactly how someone feels or use empathy to promise reassurance you cannot support.",
    contrasts: [{ nearby: "sympathy", distinction: "Empathy seeks to understand another perspective; sympathy expresses concern for someone's difficulty.", fitting: "I want to respond with empathy by listening to what matters to you.", awkward: "My empathy guarantees that you will feel better.", explanation: "Understanding a feeling does not guarantee an outcome." }],
  },
  {
    id: "voice-the-concern", wordId: "healthcare-concern", term: "concern", senseId: "specific-worry",
    roleIds: ["healthcare"], title: "Raise a specific worry calmly", theme: "emotions", goalIds: ["clarify", "challenge-diplomatically", "reassure"],
    intentKeywords: ["worried", "safety", "worry", "issue", "concern", "risk"],
    plain: "I'm worried that an important detail may be missed during the handover.",
    precise: "My concern is that the handover may omit an important detail.",
    diplomatic: "Could we check the handover detail together? I am worried something may be missing.",
    register: "Concern is calm and useful when you explain what worries you and what should happen next. This exercise practices communication, not clinical decisions.",
    collocations: ["raise a concern", "my concern is", "concern about"],
    misuse: "Do not use concern as a vague label that replaces the observation or exaggerates what you know.",
    contrasts: [{ nearby: "certainty", distinction: "A concern flags a possible problem; it does not establish that a problem has occurred.", fitting: "My concern is that a detail may be missing; let's check.", awkward: "I have a concern, therefore a mistake definitely happened.", explanation: "A concern calls for attention without overstating certainty." }],
  },
  {
    id: "clear-ownership", wordId: "project-product-accountable", term: "accountable", senseId: "answer-for-outcome",
    roleIds: ["project-product", "operations-supply-chain"], title: "Make ownership clear", theme: "leadership", goalIds: ["align", "coach"],
    intentKeywords: ["owner", "ownership", "responsible", "responsibility", "deliver", "follow", "action"],
    plain: "Mina owns the outcome and will update us on Friday.",
    precise: "Mina is accountable for the outcome and will update us on Friday.",
    diplomatic: "Could we confirm who owns the outcome and when we will review progress?",
    register: "Accountable fits governance and ownership conversations. Name support and authority as well as expectations.",
    collocations: ["accountable for", "held accountable", "accountable to"],
    misuse: "Use accountable for an outcome and accountable to a person. Accountability does not mean blame or doing every task yourself.",
    contrasts: [{ nearby: "responsible", distinction: "Responsible can describe carrying out work; accountable emphasises answering for the outcome. Local team conventions can differ.", fitting: "Mina is accountable for delivery and responsible for the final review.", awkward: "Mina is accountable with the delivery.", explanation: "The usual construction for an outcome is accountable for." }],
  },
  {
    id: "challenge-with-care", wordId: "project-product-constructive-dissent", term: "constructive dissent", senseId: "challenge-to-improve",
    roleIds: ["project-product", "consulting-strategy"], title: "Disagree while improving the decision", theme: "leadership", goalIds: ["challenge-diplomatically", "recommend", "align"],
    intentKeywords: ["disagree", "dissent", "challenge", "pushback", "objection", "respectful", "alternative"],
    plain: "I see the goal differently. Could we compare another option?",
    precise: "I want to offer constructive dissent: a smaller pilot may reduce our exposure.",
    diplomatic: "I support the aim. Could we test whether a smaller pilot would address the risk?",
    register: "In a live meeting, make the useful challenge directly. Constructive dissent is often better as a label for the behaviour than as an introduction to every disagreement.",
    collocations: ["encourage constructive dissent", "offer constructive dissent", "space for constructive dissent"],
    misuse: "Constructive dissent includes reasons or a useful alternative. Calling an insult constructive does not make it helpful.",
    contrasts: [{ nearby: "obstruction", distinction: "Constructive dissent aims to improve the decision; obstruction prevents progress without helping resolve the issue.", fitting: "We encourage constructive dissent that tests assumptions and offers alternatives.", awkward: "My constructive dissent is that your idea is stupid.", explanation: "A personal insult supplies neither a reason nor a useful alternative." }],
  },
  {
    id: "direct-and-respectful", wordId: "healthcare-assertive", term: "assertive", senseId: "clear-respectful-expression",
    roleIds: ["healthcare"], title: "Speak directly without hostility", theme: "leadership", goalIds: ["challenge-diplomatically", "align"],
    intentKeywords: ["direct", "firm", "boundary", "confident", "respectful", "speak", "interrupt"],
    plain: "I need to finish this point, then I would like to hear your view.",
    precise: "An assertive response states the concern clearly while respecting the other person.",
    diplomatic: "May I finish the point so the concern is clear? Then let's discuss your perspective.",
    register: "Assertive describes a communication style. You rarely need to announce that you are being assertive; let the clear request do the work.",
    collocations: ["assertive communication", "an assertive response", "remain assertive"],
    misuse: "Assertive does not mean aggressive, dismissive or unwilling to listen.",
    contrasts: [{ nearby: "aggressive", distinction: "Assertive states a need while respecting others; aggressive communication threatens or attacks.", fitting: "An assertive response makes the request clear and invites a reply.", awkward: "I stayed assertive by humiliating the person who disagreed.", explanation: "Humiliation undermines respect and is not assertiveness." }],
  },
  {
    id: "feedback-that-helps", wordId: "finance-constructive", term: "constructive", senseId: "helpful-improvement",
    roleIds: ["finance-accounting", "healthcare"], title: "Give feedback someone can act on", theme: "leadership", goalIds: ["coach", "challenge-diplomatically"],
    intentKeywords: ["feedback", "improve", "help", "mistake", "review", "criticism"],
    plain: "Adding the missing context would make this update easier to follow.",
    precise: "My constructive feedback is to add the missing context before the recommendation.",
    diplomatic: "The recommendation is clear. Could you add the context so the reader can follow the reasoning?",
    register: "Specific feedback is more useful than announcing that feedback is constructive. Describe the change and why it helps.",
    collocations: ["constructive feedback", "constructive discussion", "a constructive approach"],
    misuse: "Constructive feedback can be direct; it should offer a useful path forward, not merely soften a vague judgement.",
    contrasts: [{ nearby: "critical", distinction: "Critical identifies faults or evaluates carefully; constructive also helps improve the result.", fitting: "Constructive feedback names the missing information and suggests where to add it.", awkward: "My constructive feedback is that everything is bad.", explanation: "The judgement gives no specific change the recipient can make." }],
  },
];

const scenarioRows: Array<[string, ScenarioKind, string, string, string, string]> = [
  ["explain-the-reason", "interview", "An interviewer asks why you tested a small version before committing to a larger rollout. Explain your choice in two sentences.", "The rationale for testing a small version was to identify problems before committing more resources. We used the feedback to change the rollout plan.", "A colleague asks why you gathered a second opinion before making a recommendation. Explain the choice and the benefit.", "The rationale for seeking a second opinion was to challenge our assumptions. It helped us make a more balanced recommendation."],
  ["evidence-to-decision", "interview", "In an interview, you describe checking a supplier's claimed time saving before recommending a trial. Explain what information you looked for and what you would still need to know.", "I looked for records that could substantiate the claimed time saving. Before recommending a trial, I would check whether the comparison covered similar work and conditions.", "An interviewer asks how you would evaluate a proposal based on a single positive report. Explain how you would test its reliability without dismissing the source.", "I would seek information that could substantiate the report, including how it was collected and what it leaves out. I would compare it with a second source before committing."],
  ["evidence-to-decision", "disagreement", "A teammate says a plan must work because they feel certain. You are unconvinced. Respond respectfully and ask for one concrete way to test the claim.", "Confidence is useful, but what evidence would substantiate that claim? Could we agree on a small test before making the commitment?", "Someone thinks an outside example settles a disagreement about your team's plan. Ask how to check whether that example applies to your situation, while acknowledging what it contributes.", "That example is helpful context. To substantiate the claim for our team, could we compare the conditions and gather information from a small trial?"],
  ["name-the-choice", "interview", "During an interview, you are asked about a time you had to choose between speed and depth of checking. Describe the competing outcomes and explain your decision using fictional details.", "The trade-off was delivery speed versus a more thorough check. I chose a smaller verified release, then planned the remaining work.", "An interviewer asks how you would choose between a familiar process and a more tailored but slower option. Explain what you would consider before deciding.", "I would make the trade-off between immediate consistency and extra tailoring explicit. Then I would check which needs are essential and test the simplest option that meets them."],
  ["evidence-to-decision", "meeting", "A colleague predicts a large improvement but has only one early observation. Ask a respectful question before the team commits.", "Could we examine the evidence that would substantiate that estimate? One observation is a starting point, but we need to understand how representative it is.", "A different team claims a new approach saves time. Ask what information would make that claim credible.", "What records could substantiate the claim that the approach saves time? Could we compare similar work before and after the change?"],
  ["name-the-choice", "meeting", "You can deliver a smaller change this week or a broader change later. Explain both sides and recommend a next step.", "The trade-off is earlier value versus a broader solution. I recommend the smaller change first, with a review before adding more scope.", "A team can use a standard solution quickly or customise it with more effort. Explain the choice without promising both advantages.", "The trade-off is speed versus customisation. Let's identify which requirements truly need a custom approach before deciding."],
  ["bridge-the-difference", "disagreement", "Two colleagues describe the same event differently. Invite them to compare their accounts without choosing a winner.", "Could we reconcile the differences between these accounts before reaching a conclusion? Let's identify what each person observed and what remains unclear.", "Two written summaries give different dates for the same milestone. Propose a calm next step.", "Let's reconcile the records by checking the source of each date. We can then explain the difference and confirm the milestone together."],
  ["hear-before-answering", "disagreement", "A colleague says a change adds work and feels their concern was dismissed. Respond before defending the change.", "I acknowledge your concern about the extra workload. Could we look at the tasks that have changed and what support would help?", "Someone worries that a decision was made without hearing their view. Recognise the concern without claiming you agree with every point.", "I acknowledge your concern about how the decision was made. Let's hear the perspective we missed and identify what can still be reconsidered."],
  ["name-what-is-unknown", "meeting", "People ask for a final date that has not been confirmed. State the limit of what you know and offer a concrete update.", "There is uncertainty about the final date. We can confirm the next step today, and I will share the remaining timing information on Friday.", "A colleague asks whether a planned change will affect their work. You do not yet know the full details. Answer honestly.", "There is uncertainty about the impact on each role. I will share what we know now and arrange a further update when the remaining questions are answered."],
  ["recognise-the-feeling", "interview", "In a fictional healthcare communication interview, explain how you would respond to someone who is distressed without promising an outcome.", "I would respond with empathy by listening to what worries the person most. I would check my understanding before explaining what support is available.", "A fictional colleague asks how you would speak with someone who feels ignored. Describe your communication approach.", "I would show empathy by asking what the experience has been like and listening without rushing to reassure. Then I would check which concern matters most to them."],
  ["voice-the-concern", "meeting", "In a fictional handover, an important piece of information seems absent. Raise the issue and suggest checking it. Do not make a clinical recommendation.", "My concern is that an important detail may be missing from the handover. Could we check the source together before completing it?", "In a fictional team update, two summaries contain inconsistent details. Raise the possible issue without claiming you know which is wrong.", "My concern is that the summaries may give different impressions. Could we compare the details and confirm the intended message?"],
  ["clear-ownership", "meeting", "A shared action has no named owner. Ask who will answer for the outcome and when progress will be reviewed.", "Who will be accountable for the outcome? Let's confirm the owner, available support and the date for our next progress review.", "Several people contribute to an improvement, but nobody knows who should provide the final update. Clarify ownership without assigning blame.", "Could we confirm who is accountable for the final outcome and who will provide the update? Each contributor should also know which part they own."],
  ["challenge-with-care", "disagreement", "The group wants to commit immediately, but you see a reason to test a smaller option first. Challenge the decision respectfully.", "I want to offer constructive dissent: a smaller test could reveal problems before we commit. Could we compare that option against the immediate rollout?", "A team repeats an approach that did not work last time. Invite a different option while respecting the shared aim.", "Could we make space for constructive dissent about the approach? I support the aim, but a different sequence may address the problem we saw last time."],
  ["direct-and-respectful", "interview", "In a fictional healthcare communication interview, explain how you would raise a concern when a more senior colleague interrupts you.", "I would remain assertive by stating the concern clearly and respectfully. I would ask to finish the point, then invite the colleague's perspective.", "In a fictional discussion, someone repeatedly talks over a colleague. Explain a respectful way to protect their opportunity to speak.", "An assertive response could be: let's hear the end of their point before responding. That protects the discussion without attacking anyone."],
  ["feedback-that-helps", "disagreement", "A colleague's update lacks the context needed to understand its recommendation. Offer one useful improvement.", "My constructive feedback is to add the missing context before the recommendation. That would help the reader understand why the next step makes sense.", "A colleague's summary contains useful detail but its next step is unclear. Give specific feedback with a reason.", "A constructive suggestion is to finish with one explicit next step. That would help the reader know what action is being requested."],
];
const scenarios: ExpressionScenario[] = scenarioRows.map(([expressionId, kind, prompt, exampleResponse, freshPrompt, freshExampleResponse]) => {
  const expression = expressions.find((entry) => entry.id === expressionId)!;
  return { id: `${expressionId}-${kind}`, expressionId, kind, roleIds: [...expression.roleIds], wordIds: [expression.wordId], prompt, focus: expression.title, exampleResponse, freshPrompt, freshExampleResponse };
});

export const expressionContent = {
  schemaVersion: 1,
  goals: [
    { id: "clarify", label: "Explain clearly" }, { id: "align", label: "Agree a next step" },
    { id: "influence", label: "Make a case" }, { id: "recommend", label: "Recommend an option" },
    { id: "negotiate", label: "Balance priorities" }, { id: "challenge-diplomatically", label: "Disagree respectfully" },
    { id: "coach", label: "Give useful feedback" }, { id: "reassure", label: "Respond with care" },
  ] as Array<{ id: ExpressionGoal; label: string }>,
  expressions, scenarios,
};

function normalise(text: string): string { return text.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim(); }
function containsPhrase(text: string, phrase: string): boolean { return (` ${normalise(text)} `).includes(` ${normalise(phrase)} `); }
export function getExpressionsForRole(roleId: RoleId): ExpressionEntry[] { return expressions.filter((entry) => entry.roleIds.includes(roleId)); }
export function getScenariosForRole(roleId: RoleId): ExpressionScenario[] { return scenarios.filter((entry) => entry.roleIds.includes(roleId)); }
export function getPracticeExpression(expressionId: string, catalogueWords: readonly ProfessionalWord[] = []): ExpressionEntry | undefined {
  const curated = expressions.find((entry) => entry.id === expressionId);
  if (curated) return curated;
  const [, roleId, wordId] = expressionId.split(":");
  if (!expressionId.startsWith("catalogue:") || !roleId || !wordId) return undefined;
  const word = catalogueWords.find((entry) => entry.id === wordId && entry.roles.includes(roleId as RoleId));
  if (!word) return undefined;
  const context = word.roleContexts?.[roleId as RoleId] ?? word;
  return { id: expressionId, wordId, term: word.term, roleIds: [roleId as RoleId], senseId: `${wordId}::${roleId}`, title: "A familiar role situation", theme: "intellectual", goalIds: [...word.goals], intentKeywords: [], plain: "Use your own words to communicate the intent.", precise: context.example, diplomatic: "Choose wording that respects the audience and the situation.", register: context.whenToUse, collocations: [...context.collocations], misuse: context.avoidOrMisuse, contrasts: [] };
}
export function getLearnedExpressionScenarios(roleId: RoleId, learnedWordIds: readonly string[], catalogueWords: readonly ProfessionalWord[] = []): ExpressionScenario[] {
  const learned = new Set(learnedWordIds);
  const curated = getScenariosForRole(roleId).filter((scenario) => scenario.wordIds.some((id) => learned.has(id)));
  const covered = new Set(curated.flatMap((scenario) => scenario.wordIds));
  const fallback = catalogueWords.filter((word) => learned.has(word.id) && !covered.has(word.id) && word.roles.includes(roleId) && word.learningMode === "active").map((word): ExpressionScenario => {
    const context = word.roleContexts?.[roleId] ?? word;
    // Both prompts withhold the target. The alternate frame is authored locally;
    // its comparison example remains the existing catalogue reference.
    const escaped = word.term.split(/[-\s]+/).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[-\\s]+");
    const prompt = context.mission.replace(new RegExp(escaped, "gi"), "a suitable expression");
    const meaningCue = context.meaning.replace(new RegExp(escaped, "gi"), "this idea");
    const preferredFrame = alternateFrames[word.goals[0] ?? "clarify"];
    const frame = containsPhrase(preferredFrame, word.term) ? Object.values(alternateFrames).find((candidate) => !containsPhrase(candidate, word.term))! : preferredFrame;
    const freshPrompt = `${frame} Communicate this idea without seeing a suggested phrase: ${meaningCue} Use a concrete fictional detail and say what should happen afterwards.`;
    return { id: `catalogue-${roleId}-${word.id}`, expressionId: `catalogue:${roleId}:${word.id}`, roleIds: [roleId], kind: "meeting", wordIds: [word.id], prompt, focus: "A familiar role situation", exampleResponse: context.example, freshPrompt, freshExampleResponse: context.example };
  });
  return [...curated, ...fallback];
}
const alternateFrames: Record<ExpressionGoal, string> = {
  clarify: "At a handover, a new teammate has missed the background. Explain what matters to their next action.",
  align: "Two teams are preparing a joint update and have different expectations. Help them agree a next step.",
  influence: "A colleague is sceptical about your recommendation. Make a measured case without overstating what you know.",
  recommend: "An unfamiliar stakeholder asks what they should do next. Offer a reasoned next step and its limit.",
  negotiate: "A partner asks for a change you cannot fully accept. Explain your position and invite a workable option.",
  "challenge-diplomatically": "In a new team discussion, you see a problem in a proposed decision. Raise it respectfully and suggest how to check it.",
  coach: "A colleague asks for feedback on a fictional piece of work. Name a useful improvement and explain why it matters.",
  reassure: "A colleague is worried about a change. Explain what is known, acknowledge the limit and offer a concrete next step.",
};
export function getTenWordDiscovery(input: { roleId: RoleId; query?: string; goalId?: ExpressionGoal; catalogueWords?: readonly ProfessionalWord[] }) {
  const query = normalise(input.query ?? "");
  return (input.catalogueWords ?? []).filter((word) => word.roles.includes(input.roleId) && (!input.goalId || word.goals.includes(input.goalId)) && (!query || normalise(`${word.term} ${word.meaning} ${word.roleContexts?.[input.roleId]?.meaning ?? ""}`).includes(query))).slice(0, 10).map((word) => ({ wordId: word.id, term: word.term, ...(word.roleContexts?.[input.roleId] ?? word), learningCredit: false as const }));
}
export function expressionEvidenceSenseId(wordId: string, roleId: RoleId): string { return `${wordId}::${roleId}`; }

/** Matches authored keywords and the selected goal, not arbitrary semantic meaning. */
export function findExpressionMatches(input: { text: string; goalId?: ExpressionGoal; roleId: RoleId }) {
  return getExpressionsForRole(input.roleId).map((expression) => {
    const matchedKeywords = expression.intentKeywords.filter((keyword) => containsPhrase(input.text, keyword));
    const goalMatch = Boolean(input.goalId && expression.goalIds.includes(input.goalId));
    return { expression, matchedKeywords, score: matchedKeywords.length * 3 + (goalMatch ? 2 : 0), reason: matchedKeywords.length ? "keywords" as const : "selected-goal" as const };
  }).filter((match) => match.score > 0).sort((a, b) => b.score - a.score || a.expression.id.localeCompare(b.expression.id));
}

/** A focused phrase check, never a semantic, register or factual grade. */
export function checkExpressionResponse(expressionId: string, response: string, catalogueWords: readonly ProfessionalWord[] = []) {
  const expression = getPracticeExpression(expressionId, catalogueWords);
  if (!expression) throw new Error("Unknown expression.");
  const wordCount = normalise(response).split(/\s+/).filter(Boolean).length;
  const termFound = containsPhrase(response, expression.term);
  const collocationFound = expression.collocations.some((phrase) => containsPhrase(response, phrase));
  const enoughContext = wordCount >= 4;
  return { termFound, collocationFound, enoughContext, wordCount, message: !enoughContext ? "Add enough context to compare your meaning with the example." : termFound ? collocationFound ? "The focus term and a listed pattern are present. Check the meaning and naturalness yourself using the comparison." : `The focus term is present, but no listed pattern was detected. Try “${expression.collocations[0] ?? expression.term}” if it fits your idea, then check the meaning and naturalness yourself. Other wording can also be valid.` : "The focus term is absent. A plain alternative may still communicate well; this check cannot assess its meaning." };
}
export type ExpressionEvidence = {
  wordId: string; roleId: RoleId; senseId: string; kind: "recognition" | "self-assessed-production";
  quality: 0 | 1 | 2 | 3; independent: boolean; response: string; date?: string;
  assisted: boolean; modelSeen: boolean; meaningAttested: boolean; naturalnessAttested: boolean; attemptId?: string; capturedAtISO?: string;
};
export function buildExpressionEvidence(input: {
  expressionId: string; roleId: RoleId; response: string; modelSeen: boolean;
  meaningConfirmed: boolean; naturalnessConfirmed: boolean; quality: 0 | 1 | 2 | 3; independent: boolean; catalogueWords?: readonly ProfessionalWord[]; date?: string; attemptId?: string; capturedAtISO?: string;
}): ExpressionEvidence | null {
  const expression = getPracticeExpression(input.expressionId, input.catalogueWords);
  if (!expression || !expression.roleIds.includes(input.roleId) || ![0, 1, 2, 3].includes(input.quality)) return null;
  const check = checkExpressionResponse(input.expressionId, input.response, input.catalogueWords);
  if (!check.termFound || !check.enoughContext || !input.meaningConfirmed || !input.naturalnessConfirmed) return null;
  return { wordId: expression.wordId, roleId: input.roleId, senseId: expressionEvidenceSenseId(expression.wordId, input.roleId), kind: "self-assessed-production", quality: input.quality, independent: input.independent && !input.modelSeen, response: input.response.trim(), date: input.date, assisted: input.modelSeen || !input.independent, modelSeen: input.modelSeen, meaningAttested: input.meaningConfirmed, naturalnessAttested: input.naturalnessConfirmed, attemptId: input.attemptId, ...(input.capturedAtISO ? { capturedAtISO: input.capturedAtISO } : {}) };
}

export type NuanceChoice = "fitting" | "awkward";
export type NuanceAnswer = { choice: NuanceChoice; recognizedOn?: string; attemptId?: string };
export function expressionNuanceKey(expressionId: string, contrastIndex: number): string { return `${expressionId}::contrast:${contrastIndex}`; }
/** Authored comparison only: a correct choice earns recognition, never retrieval. */
export function buildNuanceChoice(input: {
  expressionId: string; roleId: RoleId; contrastIndex: number; choice: NuanceChoice;
  date: string; attemptId: string; previous?: NuanceAnswer; catalogueWords?: readonly ProfessionalWord[];
}): { key: string; answer: NuanceAnswer; evidence?: ExpressionEvidence; explanation: string; correct: boolean } | null {
  const expression = getPracticeExpression(input.expressionId, input.catalogueWords);
  if (!expression || !expression.roleIds.includes(input.roleId) || !Number.isInteger(input.contrastIndex) || input.contrastIndex < 0 || !["fitting", "awkward"].includes(input.choice)) return null;
  const contrast = expression.contrasts[input.contrastIndex];
  if (!contrast) return null;
  try { dateNumber(input.date); } catch { return null; }
  const correct = input.choice === "fitting";
  let recognized = false;
  try { if (input.previous?.recognizedOn) { dateNumber(input.previous.recognizedOn); recognized = true; } } catch { /* Invalid older private metadata earns no recognition credit. */ }
  const answer: NuanceAnswer = { choice: input.choice, ...(recognized ? { recognizedOn: input.previous!.recognizedOn, attemptId: input.previous!.attemptId } : {}), ...(correct && !recognized ? { recognizedOn: input.date, attemptId: input.attemptId } : {}) };
  const evidence: ExpressionEvidence | undefined = correct && !recognized ? {
    wordId: expression.wordId, roleId: input.roleId, senseId: expressionEvidenceSenseId(expression.wordId, input.roleId),
    kind: "recognition", quality: 2, independent: false, response: "", date: input.date,
    assisted: true, modelSeen: true, meaningAttested: false, naturalnessAttested: false, attemptId: input.attemptId,
  } : undefined;
  return { key: expressionNuanceKey(input.expressionId, input.contrastIndex), answer, evidence, correct, explanation: contrast.explanation };
}

function dateNumber(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Expected YYYY-MM-DD.");
  const value = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(value) || new Date(value).toISOString().slice(0, 10) !== date) throw new Error("Invalid date.");
  return value;
}
export function expressionDaysBetween(from: string, to: string): number { return (dateNumber(to) - dateNumber(from)) / 86_400_000; }
export function expressionNextDay(date: string): string { return new Date(dateNumber(date) + 86_400_000).toISOString().slice(0, 10); }
export function getFifthDayChallenge(input: { date: string; activeDates: readonly string[]; roleId: RoleId; learnedWordIds: readonly string[]; catalogueWords?: readonly ProfessionalWord[]; completedChallengeCounts?: readonly number[] }) {
  dateNumber(input.date);
  const dates = [...new Set(input.activeDates.filter((date) => { try { return dateNumber(date) <= dateNumber(input.date); } catch { return false; } }))].sort();
  const count = dates.length;
  const eligible = getLearnedExpressionScenarios(input.roleId, input.learnedWordIds, input.catalogueWords);
  const completed = new Set(input.completedChallengeCounts ?? []);
  const challengeCount = Array.from({ length: Math.floor(count / 5) }, (_, index) => (index + 1) * 5).find((checkpoint) => !completed.has(checkpoint)) ?? Math.floor(count / 5) * 5;
  return { activeDayCount: count, challengeCount, due: challengeCount >= 5 && !input.completedChallengeCounts?.includes(challengeCount) && eligible.length > 0, scenarios: eligible.slice(0, 3), newWordCount: 0, label: "Every fifth active day: revisit words you have already learned" };
}
export function buildComebackPlan(input: { date: string; lastActiveDate?: string; roleId: RoleId; learnedWordIds: readonly string[]; catalogueWords?: readonly ProfessionalWord[] }) {
  dateNumber(input.date);
  let awayDays = 0;
  try { awayDays = input.lastActiveDate ? Math.max(0, expressionDaysBetween(input.lastActiveDate, input.date)) : 0; } catch { awayDays = 0; }
  const eligible = getLearnedExpressionScenarios(input.roleId, input.learnedWordIds, input.catalogueWords);
  return { awayDays, suggested: awayDays >= 3 && eligible.length > 0, scenarios: eligible.slice(0, 3), newWordCount: 0, label: "A small restart: try up to three familiar situations, then choose your next step" };
}
export function getDiscoveryEntries(input: { roleId: RoleId; theme?: ExpressionTheme; query?: string }) {
  const query = normalise(input.query ?? "");
  return getExpressionsForRole(input.roleId).filter((entry) => (!input.theme || entry.theme === input.theme) && (!query || normalise(`${entry.title} ${entry.term} ${entry.plain} ${entry.precise} ${entry.intentKeywords.join(" ")}`).includes(query)));
}


/** Exposure is role/sense scoped, and never awards introduction or mastery. */
export function expressionIndependentAllowed(wordId: string, roleId: RoleId, date: string, exposedOn: Readonly<Record<string, string>>): boolean {
  dateNumber(date);
  return exposedOn[expressionEvidenceSenseId(wordId, roleId)] !== date;
}
export type ExpressionCommitGate = { busy: boolean; completed: Set<string> };
export function createExpressionCommitGate(): ExpressionCommitGate { return { busy: false, completed: new Set() }; }
/** One callback owns both the draft transition and evidence. Failed saves can retry. */
export function commitExpressionTransaction<T>(input: {
  gate: ExpressionCommitGate; next: T; evidence?: ExpressionEvidence; exposedContextIds?: readonly string[];
  transactionId?: string; onCommit: (draft: string, evidence?: ExpressionEvidence, exposedContextIds?: readonly string[]) => boolean;
  onApply: (next: T) => void;
}): boolean {
  if (input.gate.busy || (input.transactionId && input.gate.completed.has(input.transactionId))) return false;
  input.gate.busy = true;
  try {
    if (!input.onCommit(JSON.stringify(input.next), input.evidence, input.exposedContextIds)) return false;
    if (input.transactionId) input.gate.completed.add(input.transactionId);
    input.onApply(input.next);
    return true;
  } finally { input.gate.busy = false; }
}


/** Native receives the same role-scoped fallback situations without runtime TS imports. */
export function getExpressionPracticeContent(catalogueWords: readonly ProfessionalWord[]) {
  const roleIds = [...new Set(catalogueWords.flatMap((word) => word.roles))];
  const allScenarios = new Map(scenarios.map((scenario) => [scenario.id, scenario]));
  const allExpressions = new Map(expressions.map((expression) => [expression.id, expression]));
  for (const roleId of roleIds) {
    for (const scenario of getLearnedExpressionScenarios(roleId, catalogueWords.map((word) => word.id), catalogueWords)) {
      allScenarios.set(scenario.id, scenario);
      const expression = getPracticeExpression(scenario.expressionId, catalogueWords);
      if (expression) allExpressions.set(expression.id, expression);
    }
  }
  return { ...expressionContent, expressions: [...allExpressions.values()], scenarios: [...allScenarios.values()] };
}
