export type Category = "emotions" | "intellectual" | "leadership";

export type VocabularyWord = {
  id: string;
  day: number;
  word: string;
  partOfSpeech: "noun" | "adjective" | "verb" | "adverb";
  category: Category;
  pronunciation: string;
  ipa?: string;
  meaning: string;
  example: string;
};

const word = (
  day: number,
  category: Category,
  value: string,
  partOfSpeech: VocabularyWord["partOfSpeech"],
  pronunciation: string,
  meaning: string,
  example: string,
  ipa?: string,
): VocabularyWord => ({
  id: `day-${day}-${value.toLowerCase().replace(/[^a-z]+/g, "-")}`,
  day,
  word: value,
  partOfSpeech,
  category,
  pronunciation,
  meaning,
  example,
  ipa,
});

export const seedWords: VocabularyWord[] = [
  word(1, "emotions", "Equanimity", "noun", "ee-kwuh-NIM-uh-tee", "The ability to remain calm and emotionally balanced, especially under pressure.", "She handled the unexpected criticism with remarkable equanimity."),
  word(1, "emotions", "Apprehensive", "adjective", "ap-ri-HEN-siv", "Anxious that something unpleasant may happen.", "I felt apprehensive before raising the sensitive issue with my manager."),
  word(1, "emotions", "Disillusioned", "adjective", "dis-ih-LOO-zhund", "Disappointed after discovering that something is less good than you believed.", "He became disillusioned when the role offered little of the creative freedom he had expected."),
  word(1, "emotions", "Exasperated", "adjective", "ig-ZAS-puh-ray-tid", "Extremely annoyed, especially by a repeated problem.", "She sounded exasperated after explaining the same requirement for the third time."),
  word(1, "intellectual", "Nuanced", "adjective", "NOO-ahnst", "Showing subtle differences or careful distinctions.", "The architect gave a nuanced assessment rather than calling either option simply good or bad."),
  word(1, "intellectual", "Cogent", "adjective", "KOH-juhnt", "Clear, logical, and convincing.", "His cogent explanation helped the stakeholders understand the trade-off."),
  word(1, "intellectual", "Conjecture", "noun", "kuhn-JEK-chuh", "An opinion formed without enough evidence to be certain.", "Until we inspect the logs, any explanation of the outage is only conjecture."),
  word(1, "leadership", "Resolute", "adjective", "REZ-uh-loot", "Firmly determined and unwilling to give up.", "She remained resolute when the recovery plan met early resistance."),
  word(1, "leadership", "Pragmatic", "adjective", "prag-MAT-ik", "Focused on practical results rather than theory alone.", "The team took a pragmatic approach and fixed the highest-risk issue first."),
  word(1, "leadership", "Galvanize", "verb", "GAL-vuh-nyze", "To inspire people to take energetic action.", "Her calm briefing galvanised the volunteers into action."),

  word(2, "emotions", "Ambivalent", "adjective", "am-BIV-uh-luhnt", "Having mixed or conflicting feelings about something.", "I felt ambivalent about the promotion because it meant less time for hands-on work."),
  word(2, "emotions", "Indignant", "adjective", "in-DIG-nuhnt", "Angry because something seems unfair or insulting.", "He was indignant when his colleague received blame for a decision she had not made."),
  word(2, "emotions", "Introspective", "adjective", "in-truh-SPEK-tiv", "Thoughtfully examining your own feelings and motives.", "After the difficult conversation, she became introspective about how her tone had affected the team."),
  word(2, "emotions", "Vulnerable", "adjective", "VUL-nuh-ruh-buhl", "Open to emotional hurt, criticism, or harm.", "Admitting that I needed help made me feel vulnerable but also brought us closer."),
  word(2, "intellectual", "Articulate", "verb", "ar-TIK-yuh-layt", "To express an idea clearly and effectively.", "Can you articulate why this constraint matters to the customer?"),
  word(2, "intellectual", "Discern", "verb", "dih-SURN", "To recognise or understand something that is not obvious.", "It was difficult to discern a clear pattern in the limited data."),
  word(2, "intellectual", "Premise", "noun", "PREM-iss", "A starting idea on which an argument is based.", "The proposal rests on the premise that demand will remain steady."),
  word(2, "leadership", "Decisive", "adjective", "dih-SY-siv", "Able to make clear decisions quickly and confidently.", "During the incident, her decisive leadership prevented further disruption."),
  word(2, "leadership", "Accountable", "adjective", "uh-KOWN-tuh-buhl", "Responsible for decisions and expected to explain their results.", "Each lead is accountable for the risks within their area."),
  word(2, "leadership", "Delegate", "verb", "DEL-ih-gayt", "To give responsibility or authority for a task to someone else.", "A strong manager delegates meaningful work without abandoning support."),

  word(3, "emotions", "Despondent", "adjective", "dih-SPON-duhnt", "Feeling deeply discouraged and without hope.", "He felt despondent after months of applications produced no interviews."),
  word(3, "emotions", "Perturbed", "adjective", "per-TURBD", "Worried or unsettled by something unexpected.", "I was perturbed by the sudden change in her usually warm manner."),
  word(3, "emotions", "Resentful", "adjective", "ri-ZENT-fuhl", "Bitter or angry about unfair treatment.", "She grew resentful when her extra effort was repeatedly taken for granted."),
  word(3, "emotions", "Composed", "adjective", "kuhm-POHZD", "Calm and in control of your feelings.", "Although the interview was demanding, he remained composed throughout."),
  word(3, "intellectual", "Elucidate", "verb", "ih-LOO-sih-dayt", "To make a difficult idea clear by explaining it.", "The diagram helped elucidate how data moves between the services."),
  word(3, "intellectual", "Substantiate", "verb", "suhb-STAN-shee-ayt", "To support a claim with evidence.", "We need customer data to substantiate the assumption behind this feature."),
  word(3, "intellectual", "Fallacious", "adjective", "fuh-LAY-shuhs", "Based on a mistaken belief or invalid reasoning.", "The argument is fallacious because correlation alone does not prove cause."),
  word(3, "leadership", "Judicious", "adjective", "joo-DISH-uhs", "Showing careful thought and sound judgement.", "She made judicious use of the team’s limited time."),
  word(3, "leadership", "Empower", "verb", "em-POW-uh", "To give someone the authority and confidence to act.", "Clear guardrails empower engineers to make decisions independently."),
  word(3, "leadership", "Forthright", "adjective", "FOR-thryte", "Direct and honest while remaining respectful.", "He was forthright about the delivery risk without becoming confrontational."),

  word(4, "emotions", "Remorseful", "adjective", "ri-MORS-fuhl", "Feeling deep regret for something wrong you have done.", "She was genuinely remorseful after realising how her comment had landed."),
  word(4, "emotions", "Elated", "adjective", "ih-LAY-tid", "Extremely happy and excited.", "The team was elated when their months of work finally reached customers."),
  word(4, "emotions", "Stoic", "adjective", "STOH-ik", "Enduring pain or difficulty without showing much emotion.", "He remained stoic during the setback, though his close friends knew he was disappointed."),
  word(4, "emotions", "Disconcerted", "adjective", "dis-kuhn-SUR-tid", "Unsettled or confused by something unexpected.", "I was disconcerted by the interviewer’s abrupt change of subject."),
  word(4, "intellectual", "Infer", "verb", "in-FUR", "To reach a conclusion from evidence rather than a direct statement.", "From the repeated timeouts, we can infer that the downstream service is overloaded."),
  word(4, "intellectual", "Equivocal", "adjective", "ih-KWIV-uh-kuhl", "Unclear, noncommittal, or open to more than one interpretation.", "Her equivocal response left us unsure whether the budget was approved."),
  word(4, "intellectual", "Scrutinize", "verb", "SKROO-tih-nyze", "To examine something very carefully.", "The reviewers scrutinised the migration plan before approving it."),
  word(4, "leadership", "Visionary", "adjective", "VIZH-uh-nair-ee", "Able to imagine and plan an inspiring future.", "Her visionary proposal connected today’s small improvements to a much larger ambition."),
  word(4, "leadership", "Diplomatic", "adjective", "dip-luh-MAT-ik", "Skilful at handling disagreement without causing offence.", "He gave diplomatic feedback that preserved trust while addressing the problem."),
  word(4, "leadership", "Cultivate", "verb", "KUL-tih-vayt", "To deliberately develop a quality or relationship over time.", "Good leaders cultivate an environment where questions are welcomed."),
];

export const dayFiveWords: VocabularyWord[] = [
  word(5, "emotions", "Wistful", "adjective", "WIST-fuhl", "Quietly sad because you are thinking about something you miss or wish for.", "She felt wistful when she found the notebook from her first year abroad.", "/ˈwɪstfəl/"),
  word(5, "emotions", "Disquieted", "adjective", "dis-KWY-tid", "Worried or uneasy, especially because something does not feel right.", "I was disquieted by how quickly the team dismissed the safety concern.", "/dɪsˈkwaɪətɪd/"),
  word(5, "emotions", "Buoyant", "adjective", "BOY-uhnt", "Cheerful, lively, and optimistic.", "Despite the disappointing result, her buoyant mood lifted the whole group.", "/ˈbɔɪənt/"),
  word(5, "emotions", "Empathetic", "adjective", "em-puh-THET-ik", "Able to understand and share another person’s feelings.", "His empathetic response made it easier for me to explain why I was struggling.", "/ˌempəˈθetɪk/"),
  word(5, "intellectual", "Incisive", "adjective", "in-SY-siv", "Clear, direct, and quick to identify the most important issue.", "Her incisive question exposed an assumption that none of us had examined.", "/ɪnˈsaɪsɪv/"),
  word(5, "intellectual", "Tenable", "adjective", "TEN-uh-buhl", "Able to be defended with logic or evidence.", "That explanation is no longer tenable now that the monitoring data contradicts it.", "/ˈtenəbəl/"),
  word(5, "intellectual", "Reconcile", "verb", "REK-uhn-syle", "To find a way for two apparently conflicting ideas or facts to fit together.", "We need to reconcile the customer’s request for speed with the team’s security concerns.", "/ˈrekənsaɪl/"),
  word(5, "leadership", "Unflappable", "adjective", "un-FLAP-uh-buhl", "Remaining calm and effective even in a difficult situation.", "The incident commander was unflappable as new failures appeared.", "/ʌnˈflæpəbəl/"),
  word(5, "leadership", "Strategic", "adjective", "struh-TEE-jik", "Carefully designed to achieve an important long-term aim.", "She made a strategic decision to strengthen the platform before expanding the product.", "/strəˈtiːdʒɪk/"),
  word(5, "leadership", "Champion", "verb", "CHAM-pee-uhn", "To publicly support and actively promote a person, idea, or cause.", "He continued to champion the junior engineers’ proposal when senior colleagues overlooked it.", "/ˈtʃæmpiən/"),
];

export const allWords = [...seedWords, ...dayFiveWords];

export const categories: Array<{ id: Category; label: string; eyebrow: string }> = [
  { id: "emotions", label: "Emotional expression", eyebrow: "Feel with precision" },
  { id: "intellectual", label: "Intellectual conversation", eyebrow: "Think out loud" },
  { id: "leadership", label: "Leadership", eyebrow: "Lead with clarity" },
];

export const dailyExercise = [
  { id: "ex-1", type: "fill" as const, prompt: "The unexplained drop in quality left the lead feeling ________.", answer: "disquieted", reason: "Disquieted describes unease caused by something that does not feel right." },
  { id: "ex-2", type: "fill" as const, prompt: "Her ________ question revealed the central weakness in our argument.", answer: "incisive", reason: "Incisive describes a clear observation that quickly reaches the heart of an issue." },
  { id: "ex-3", type: "fill" as const, prompt: "Without evidence from real users, that conclusion is not ________.", answer: "tenable", reason: "A tenable claim is one that can be defended with logic or evidence." },
  { id: "ex-4", type: "fill" as const, prompt: "A good sponsor will ________ the team’s proposal in the executive meeting.", answer: "champion", reason: "To champion an idea is to support and promote it actively." },
  { id: "ex-5", type: "fill" as const, prompt: "Even when the release failed, Mina remained calm and completely ________.", answer: "unflappable", reason: "Unflappable means staying calm and effective under pressure." },
  { id: "ex-6", type: "sentence" as const, prompt: "Write one sentence using “wistful” to describe a personal memory.", answer: "wistful", reason: "Wistful should express quiet sadness or longing for something missed." },
  { id: "ex-7", type: "sentence" as const, prompt: "Use “reconcile” while discussing two competing priorities.", answer: "reconcile", reason: "Reconcile should show how seemingly conflicting things can fit together." },
];

export type QuizQuestion = {
  id: string;
  type: "meaning" | "fill" | "natural" | "matching" | "sentence";
  prompt: string;
  options?: string[];
  answer: string;
  word: string;
  explanation: string;
};

export const dayFiveQuiz: QuizQuestion[] = [
  { id: "q1", type: "meaning", prompt: "Which word means ‘calm and emotionally balanced, especially under pressure’?", options: ["Equanimity", "Conjecture", "Remorseful", "Visionary"], answer: "Equanimity", word: "Equanimity", explanation: "Equanimity is steady emotional balance in a difficult situation." },
  { id: "q2", type: "meaning", prompt: "Which word describes reasoning that is based on a false idea or invalid logic?", options: ["Cogent", "Fallacious", "Nuanced", "Judicious"], answer: "Fallacious", word: "Fallacious", explanation: "Fallacious reasoning appears plausible but is logically mistaken." },
  { id: "q3", type: "meaning", prompt: "Which verb means to support a claim with evidence?", options: ["Infer", "Discern", "Substantiate", "Delegate"], answer: "Substantiate", word: "Substantiate", explanation: "To substantiate a claim is to give evidence that supports it." },
  { id: "q4", type: "meaning", prompt: "Which word means direct and honest while still respectful?", options: ["Forthright", "Diplomatic", "Stoic", "Equivocal"], answer: "Forthright", word: "Forthright", explanation: "A forthright person communicates openly and directly." },
  { id: "q5", type: "fill", prompt: "After the third unexplained delay, the client sounded ________.", answer: "exasperated", word: "Exasperated", explanation: "Repeated frustration can leave someone exasperated." },
  { id: "q6", type: "fill", prompt: "Before accepting the claim, the reviewer asked us to ________ the supporting data.", answer: "scrutinize", word: "Scrutinize", explanation: "To scrutinize something is to examine it very carefully." },
  { id: "q7", type: "fill", prompt: "A strong lead will ________ ownership while remaining available for guidance.", answer: "delegate", word: "Delegate", explanation: "To delegate is to give responsibility to another person." },
  { id: "q8", type: "fill", prompt: "Her answer was so ________ that nobody knew whether she agreed.", answer: "equivocal", word: "Equivocal", explanation: "An equivocal answer is unclear, ambiguous, or noncommittal." },
  { id: "q9", type: "natural", prompt: "Choose the most natural use of “ambivalent”.", options: ["I was ambivalent about moving: excited by the role but sad to leave my friends.", "The deadline was ambivalent, so we moved it to Friday.", "The database seemed ambivalent about accepting the query."], answer: "I was ambivalent about moving: excited by the role but sad to leave my friends.", word: "Ambivalent", explanation: "Ambivalent naturally describes a person’s mixed feelings about a choice or situation." },
  { id: "q10", type: "natural", prompt: "Choose the most natural use of “elucidate”.", options: ["Could you elucidate how these two components interact?", "Could you elucidate the deployment by completing it before noon?", "She elucidated the heavy box by placing it on the shelf."], answer: "Could you elucidate how these two components interact?", word: "Elucidate", explanation: "Elucidate means to make a complex idea clearer, not to complete or move something." },
  { id: "q11", type: "natural", prompt: "Choose the most natural use of “accountable”.", options: ["The programme lead is accountable to deliver the final outcome.", "The programme lead is accountable with the final outcome.", "The programme lead is accountable for the final outcome."], answer: "The programme lead is accountable for the final outcome.", word: "Accountable", explanation: "The usual pattern is ‘accountable for’ a result or responsibility." },
  { id: "q12", type: "matching", prompt: "Match “perturbed” to its closest meaning.", options: ["Unsettled or worried", "Extremely joyful", "Firmly determined", "Carefully practical"], answer: "Unsettled or worried", word: "Perturbed", explanation: "Perturbed describes being worried or unsettled by something." },
  { id: "q13", type: "matching", prompt: "Match “judicious” to its closest meaning.", options: ["Showing careful, sound judgement", "Speaking with mixed feelings", "Unable to show emotion", "Based on guesswork"], answer: "Showing careful, sound judgement", word: "Judicious", explanation: "Judicious choices show balanced thinking and good judgement." },
  { id: "q14", type: "sentence", prompt: "Write an original sentence using “vulnerable” in an emotional context.", answer: "vulnerable", word: "Vulnerable", explanation: "The sentence should show openness to emotional hurt or criticism." },
  { id: "q15", type: "sentence", prompt: "Write an original sentence using “pragmatic” to describe a decision.", answer: "pragmatic", word: "Pragmatic", explanation: "The sentence should describe a practical, results-focused choice." },
];

export const lessonDates: Record<number, string> = {
  1: "13 August 2026",
  2: "14 August 2026",
  3: "15 August 2026",
  4: "16 August 2026",
  5: "17 August 2026",
};
