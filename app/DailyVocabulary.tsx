"use client";

import { useLearningLanguage } from "./LearningLanguage";
import { useGuestAccess } from "./GuestLearning";
import { koreanWordSupport, koreanIdiomSupport } from "../lib/learning-locales";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { dailyCollection, dailyWords, ensureDailyVocabulary, unlockDailyExtra, saveDailyWordDraft, revealDailyWord, addDailyWordToReview, dailyWordIsInReview, dailyIdiom, idiomPractice, dueIdiomReviews, idiomReviewSchedule, addDailyIdiomToReview, revealDailyIdiom, saveDailyIdiomDraft, reviewDailyIdiom, revealCatalogIdiom, addCatalogIdiomToReview } from "../lib/daily-vocabulary";
import { dayAt, type State, type Profile, type View } from "../lib/web-learning-ui";
import { dictionaryPage } from "../lib/list-pagination";
import { dailyIdioms, type DailyIdiom } from "../lib/daily-idioms";
import type { ProfessionalWord } from "../lib/professional-content";

type Commit = (next: State | ((current: State) => State), expectedScopeKey?: string) => boolean;
type LearningProps = { state: State; day: string; profile: Profile; scopeKey: string; commit: Commit; blocked?: boolean };
type Mutation = (state: State) => State;
type Save = (mutate: Mutation) => boolean;

function useDailySave({ day, profile, scopeKey, commit, blocked }: Omit<LearningProps, "profile"> & { profile: Profile | null }) {
  const guest = useGuestAccess();
  const [notice, setNotice] = useState("");
  const pending = useRef<Mutation | null>(null);
  const save: Save = (mutate) => {
    if (blocked) { pending.current = mutate; setNotice("Please retry saving above before continuing. Your text stays here."); return false; }
    let accepted = false, unchanged = false;
    const saved = commit((current) => {
      if (!profile || current.profile?.roleId !== profile.roleId || dayAt(current.settings.timeZone) !== day) return current;
      const next = mutate(current); accepted = true; unchanged = next === current; return next;
    }, scopeKey);
    // Retrying an already-persisted candidate may require no further write.
    const success = accepted && (saved || unchanged);
    if (!success && guest.active && guest.getGuestPrompt()) { pending.current = null; setNotice(""); return false; }
    pending.current = success ? null : mutate;
    setNotice(success ? "" : "Your change could not be saved. Your text stays here; retry before leaving.");
    return success;
  };
  return { save, notice, retry: () => pending.current ? save(pending.current) : false };
}

type EntryScope = { day: string; roleId: Profile["roleId"]; scopeKey: string };
/** A saved collection can be reopened without asking storage to commit a no-op. */
export function enterDailyDestination(props: Pick<LearningProps, "state" | "day" | "profile" | "scopeKey" | "blocked">, expected: EntryScope, currentDay: string, save: Save, enter: () => void): boolean {
  if (props.blocked || props.scopeKey !== expected.scopeKey || props.day !== expected.day || props.day !== currentDay || props.profile.roleId !== expected.roleId || props.state.profile?.roleId !== expected.roleId) return false;
  const pinned = dailyCollection(props.state, props.day, expected.roleId) && props.state.learningV3.dailyVocabulary?.idiomsByDay[props.day];
  if (!pinned && !save((current) => ensureDailyVocabulary(current, props.day, expected.roleId))) return false;
  enter(); return true;
}

/** Daily discovery is additional to the learner's unchanged course pace. */
export default function DailyVocabulary(props: LearningProps & { dateLabel: string; greeting: string; dueCount: number; navigate: (view: View) => void; children: ReactNode }) {
  const { t } = useLearningLanguage();
  const { state, day, profile, dateLabel, greeting, dueCount, navigate, children } = props;
  const [panel, setPanel] = useState<"overview" | "words" | "idiom">("overview");
  const { save, notice, retry } = useDailySave(props);
  const [entryScope] = useState<EntryScope>({ day, roleId: profile.roleId, scopeKey: props.scopeKey });
  const navigationBlocked = props.blocked || Boolean(notice);
  const collection = dailyCollection(state, day, profile.roleId);
  const words = dailyWords(state, day, profile.roleId);
  const idiom = dailyIdiom(state, day);
  const dueIdioms = dueIdiomReviews(state, day);
  const explored = words.filter((word) => collection?.revealedWordIds.includes(word.id)).length;
  const idiomExplored = idiomPractice(state, day, idiom.id)?.revealed === true;
  const open = (next: "words" | "idiom") => {
    enterDailyDestination({ ...props, blocked: navigationBlocked }, entryScope, dayAt(state.settings.timeZone), save, () => { setPanel(next); window.scrollTo({ top: 0, behavior: "smooth" }); });
  };
  const back = () => { if (navigationBlocked) return; setPanel("overview"); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const leave = (view: View) => { if (!navigationBlocked) navigate(view); };
  const saveNotice = notice && <div className="save-notice" role="alert"><p>{t(notice)}</p><button disabled={props.blocked} onClick={retry}>{t("Retry this change")}</button></div>;
  return <>
    {panel === "overview" ? <>
      <div className="page-intro daily-intro"><div><span className="eyebrow">{dateLabel.toUpperCase()}</span><h1>{t(greeting)}</h1><p>{t("Choose a little useful language for today.")}</p></div></div>
      <section className="daily-destinations" aria-label={t("Choose today's learning")} data-testid="daily-learning-overview">
        <button className="daily-destination" onClick={() => open("words")} disabled={navigationBlocked}><span className="daily-destination-kicker">{t("5 WORDS + 3 OPTIONAL")}</span><strong>{t("Today’s Words")}</strong><span>{t("Advanced vocabulary for your role.")}</span><small>{explored ? t("{count} of {total} explored", { count: explored, total: words.length }) : t("Ready to explore")}<span aria-hidden="true"> →</span></small></button>
        <button className="daily-destination" onClick={() => open("idiom")} disabled={navigationBlocked}><span className="daily-destination-kicker">{t("ONE EXPRESSION")}</span><strong>{t("Today’s Idiom")}</strong><span>{t("Meaning, context and a plain-English alternative.")}</span><small>{idiomExplored ? t("Explored today") : t("Ready to explore")}<span aria-hidden="true"> →</span></small></button>
        <button className="daily-destination" onClick={() => leave("practice")} disabled={navigationBlocked}><span className="daily-destination-kicker">{t("SPACED PRACTICE")}</span><strong>{t("Review")}</strong><span>{t("Recall before you reveal the guidance.")}</span><small>{dueCount || dueIdioms.length ? t("{wordCount} words · {idiomCount} idioms due", { wordCount: dueCount, idiomCount: dueIdioms.length }) : t("No reviews due today")}<span aria-hidden="true"> →</span></small></button>
      </section>
      <div className="daily-idiom-shortcut"><button className="secondary-button" disabled={navigationBlocked} onClick={() => leave("idioms")}>{t("Explore all {count} idioms", { count: dailyIdioms.length })} →</button></div>
      <p className="daily-overview-note">{t("Exploring builds familiarity. Keep your course moving in")}{" "}<button className="text-button" disabled={navigationBlocked} onClick={() => leave("courses")}>{t("Courses →")}</button></p>
      {saveNotice}
      {children}
    </> : <section className="daily-detail" data-testid="daily-learning-detail" aria-labelledby="daily-detail-title">
      <button className="text-button daily-back" disabled={navigationBlocked} onClick={back}>{t("← Back to Today")}</button>
      <div className="page-intro"><div><span className="eyebrow">{panel === "words" ? t("5 WORDS + 3 OPTIONAL") : t("ONE DAILY EXPRESSION")}</span><h1 id="daily-detail-title">{panel === "words" ? t("Today’s Words") : t("Today’s Idiom")}</h1><p>{panel === "words" ? t("Explore advanced words for your role. Try recalling a meaning or writing a sentence before you reveal.") : t("Learn what it means, where it fits and when plain English works better.")}</p></div></div>
      {saveNotice}
      {panel === "words" ? <>
        <p className="daily-progress" role="status">{t("{count} of {total} explored", { count: explored, total: words.length })} · {collection?.extraUnlocked ? t("{count} words available", { count: words.length }) : t("5 to start, 3 more when you want them")}</p>
        <div className="daily-word-list">{words.map((word, index) => <DailyWordCard key={word.id} state={state} day={day} profile={profile} word={word} index={index} save={save} blocked={props.blocked} />)}</div>
        {!collection?.extraUnlocked && <div className="daily-extra"><div><h2>{t("Room for three more?")}</h2><p>{t("Keep five as your daily collection, or explore three extra words.")}</p></div><button className="secondary-button" disabled={props.blocked} onClick={() => save((current) => unlockDailyExtra(current, day, profile.roleId))}>{t("Add 3 more words")}</button></div>}
        <p className="muted">{t("Exploring or writing here earns no mastery or points. Add a useful word to spaced review when you want to revisit it.")}</p>
      </> : <>
        <DailyIdiomCard key={`${day}:${idiom.id}`} state={state} day={day} profile={profile} idiom={idiom} save={save} blocked={props.blocked} />
        {dueIdioms.some((entry) => entry.id !== idiom.id) && <section className="daily-idiom-due"><h2>{t("Earlier idioms ready to revisit")}</h2><p>{t("Try a fresh self-check before revealing the guidance.")}</p>{dueIdioms.filter((entry) => entry.id !== idiom.id).map((entry) => <DailyIdiomCard key={`${day}:${entry.id}`} state={state} day={day} profile={profile} idiom={entry} save={save} blocked={props.blocked} />)}</section>}
      </>}
      <div className="button-row"><button className="secondary-button" disabled={navigationBlocked} onClick={back}>{t("Back to Today")}</button>{panel === "idiom" && <button className="secondary-button" disabled={navigationBlocked} onClick={() => leave("idioms")}>{t("Explore all {count} idioms", { count: dailyIdioms.length })}</button>}<button className="text-button" disabled={navigationBlocked} onClick={() => leave("practice")}>{t("Open Review →")}</button></div>
    </section>}
  </>;
}

export function DailyWordCard({ state, day, profile, word, index, save, blocked }: { state: State; day: string; profile: Profile; word: ProfessionalWord; index: number; save: Save; blocked?: boolean }) {
  const { locale, t } = useLearningLanguage();
  const guest = useGuestAccess();
  const support = locale === "ko" ? koreanWordSupport(word.id, profile.roleId) : undefined;
  const collection = dailyCollection(state, day, profile.roleId);
  const revealed = collection?.revealedWordIds.includes(word.id) === true;
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? collection?.drafts[word.id] ?? "";
  const inReview = dailyWordIsInReview(state, profile.roleId, word.id);
  const reveal = () => save((current) => revealDailyWord(saveDailyWordDraft(current, day, profile.roleId, word.id, text), day, profile.roleId, word.id));
  return <article className="daily-word-card" aria-labelledby={`daily-word-${word.id}`}>
    <div className="card-top"><span>{t("WORD {index}", { index: index + 1 })} · {revealed ? t("Explored") : t("Ready to explore")}</span><span>{word.learningMode === "recognition" ? t("For understanding") : t("For everyday use")}</span></div>
    <h2 lang="en" id={`daily-word-${word.id}`}>{word.term}</h2>
    <p className="word-meta">{word.partOfSpeech}{word.pronunciation && ` · ${word.pronunciation}`}</p>
    <label htmlFor={`daily-word-draft-${word.id}`}>{t("Your private recall or sentence")}{" "}<span className="muted">{guest.active ? locale === "ko" ? "(세션에만 임시 보관, 선택 사항)" : "(optional, session-only)" : t("(optional, ungraded)")}</span></label>
    <textarea id={`daily-word-draft-${word.id}`} rows={2} maxLength={2000} autoComplete="off" readOnly={revealed || blocked || guest.active && !guest.canExploreItem(`word:${word.id}`)} onFocus={() => { if (guest.active && !guest.canExploreItem(`word:${word.id}`)) guest.requestAccount("limit"); }} value={text} placeholder={t("What might it mean? How would you use it?")} onChange={(event) => { const value = event.target.value; setDraft(value); save((current) => saveDailyWordDraft(current, day, profile.roleId, word.id, value)); }} />
    {!revealed ? <button className="secondary-button" disabled={blocked} onClick={reveal}>{t("Reveal meaning & example")}</button> : <div className="daily-guidance">
      <p className="daily-definition"><strong>{t("Meaning")}</strong><span lang="en">{word.meaning}</span></p>{locale === "ko" && (support ? <p className="korean-learning-support" lang="ko"><strong>{t("Korean meaning")}</strong>{support.meaning}{support.usage && <span>{support.usage}</span>}</p> : <p className="korean-translation-unavailable" lang="ko">{t("Korean support is not available for this entry yet. The original English guidance is shown.")}</p>)}
      <blockquote lang="en">{word.example}</blockquote>
      <details><summary>{t("When to use it")}</summary><p lang="en">{word.whenToUse}</p><p><strong>{t("Take care:")}</strong> {word.avoidOrMisuse}</p>{word.collocations.length > 0 && <p><strong>{t("Common combinations:")}</strong> {word.collocations.join(" · ")}</p>}</details>
      <div className="daily-review-action"><button className="secondary-button" disabled={blocked || inReview} onClick={() => guest.active ? guest.requestAccount("save") : save((current) => addDailyWordToReview(current, day, profile.roleId, word.id))}>{guest.active ? locale === "ko" ? "복습에 저장하려면 로그인" : "Sign in to save to review" : inReview ? t("In spaced review") : t("Add to spaced review")}</button><small>{inReview ? t("Revisit it in Review when it is due.") : t("Starts tomorrow. Exploring does not count as a successful review.")}</small></div>
    </div>}
  </article>;
}

export function DailyIdiomCard({ state, day, profile, idiom, save, blocked }: { state: State; day: string; profile: Profile; idiom: DailyIdiom; save: Save; blocked?: boolean }) {
  const { t, locale } = useLearningLanguage();
  const guest = useGuestAccess();
  const practice = idiomPractice(state, day, idiom.id);
  const [draft, setDraft] = useState<string | null>(null);
  const text = practice?.revealed ? practice.originalResponse ?? practice.draft : draft ?? practice?.draft ?? "";
  const due = dueIdiomReviews(state, day).some((entry) => entry.id === idiom.id);
  const revealed = practice?.revealed === true;
  const schedule = idiomReviewSchedule(state, idiom.id);
  const reveal = () => save((current) => revealDailyIdiom(saveDailyIdiomDraft(current, day, profile.roleId, idiom.id, text), day, profile.roleId, idiom.id));
  return <article className="daily-idiom-card" aria-labelledby={`daily-idiom-${idiom.id}`}>
    <div className="card-top"><span>{due ? t("IDIOM SELF-CHECK DUE") : t("DAILY IDIOM")}</span><span>{practice?.reviewed ? t("Self-check saved") : revealed ? t("Explored") : t("Ready to explore")}</span></div>
    <h2 lang="en" id={`daily-idiom-${idiom.id}`}>{idiom.phrase}</h2>
    <label htmlFor={`daily-idiom-draft-${idiom.id}`}>{due ? t("Recall the meaning or write a fresh example") : t("What do you think it means?")} <span className="muted">{guest.active ? locale === "ko" ? "(현재 세션에만 임시 보관)" : "(private, session-only)" : t("(private, ungraded)")}</span></label>
    <textarea id={`daily-idiom-draft-${idiom.id}`} rows={3} maxLength={2000} autoComplete="off" readOnly={revealed || blocked || guest.active && !guest.canExploreItem(`idiom:${idiom.id}`)} onFocus={() => { if (guest.active && !guest.canExploreItem(`idiom:${idiom.id}`)) guest.requestAccount("limit"); }} value={text} placeholder={t("Use fictional details in your example.")} onChange={(event) => { const value = event.target.value; setDraft(value); save((current) => saveDailyIdiomDraft(current, day, profile.roleId, idiom.id, value)); }} />
    {!revealed ? <button className="secondary-button" disabled={blocked} onClick={reveal}>{t("Reveal meaning & usage")}</button> : <div className="daily-guidance">
      <IdiomGuidance idiom={idiom} />
      {!schedule && <div className="daily-review-action"><button className="secondary-button" disabled={blocked} onClick={() => guest.active ? guest.requestAccount("save") : save((current) => addDailyIdiomToReview(current, day, profile.roleId, idiom.id))}>{guest.active ? locale === "ko" ? "관용어를 저장하려면 로그인" : "Sign in to save this idiom" : t("Add idiom to spaced review")}</button><small>{t("Starts tomorrow. Idiom self-checks stay separate from word mastery and points.")}</small></div>}
      {due && !practice?.reviewed ? <fieldset className="daily-idiom-assessment"><legend>{t("How did your original answer compare?")}</legend><p>{t("This saves your own judgement, without word mastery or points.")}</p><div className="button-row"><button className="secondary-button" disabled={blocked} onClick={() => save((current) => reviewDailyIdiom(current, day, profile.roleId, idiom.id, false))}>{t("Practise again")}</button><button className="secondary-button" disabled={blocked || !practice?.originalResponse?.trim()} onClick={() => save((current) => reviewDailyIdiom(current, day, profile.roleId, idiom.id, true))}>{t("I remembered it")}</button></div>{!practice?.originalResponse?.trim() && <p className="muted">{t("No original answer was saved before reveal. Use Practise again to revisit sooner.")}</p>}</fieldset> : <p className="muted">{practice?.reviewed ? t("Self-check saved. It will return when due.") : schedule ? t("In spaced review · next self-check {date}.", { date: schedule.nextReviewOn }) : t("Explored today. Add it to review if you want to revisit it.")}</p>}
    </div>}
  </article>;
}

export function DailyIdiomReviewSection(props: LearningProps) {
  const { t } = useLearningLanguage();
  const { state, day, profile } = props;
  const due = dueIdiomReviews(state, day);
  const { save, notice } = useDailySave(props);
  if (!due.length) return null;
  return <section className="daily-idiom-due" aria-label={t("Idiom self-checks due")}><div className="section-heading"><div><span className="eyebrow">{t("IDIOMS · SEPARATE FROM WORD REVIEW")}</span><h2>{t("Revisit your expressions")}</h2></div><p>{t("{count} self-checks due", { count: due.length })}</p></div>{notice && <p className="save-notice" role="alert">{t(notice)}</p>}{due.map((idiom) => <DailyIdiomCard key={`${day}:${idiom.id}`} state={state} day={day} profile={profile} idiom={idiom} save={save} blocked={props.blocked} />)}</section>;
}

export function IdiomGuidance({ idiom }: { idiom: DailyIdiom }) {
  const { locale, t } = useLearningLanguage();
  const support = locale === "ko" ? koreanIdiomSupport(idiom.id) : undefined;
  return <>
      <p className="daily-definition"><strong>{t("Meaning")}</strong><span lang="en">{idiom.meaning}</span></p>{locale === "ko" && (support ? <p className="korean-learning-support" lang="ko"><strong>{t("Korean meaning")}</strong>{support.meaning}</p> : <p className="korean-translation-unavailable" lang="ko">{t("Korean support is not available for this entry yet. The original English guidance is shown.")}</p>)}
      <blockquote lang="en">{idiom.example}</blockquote>
      <dl className="daily-idiom-context"><div><dt>{t("Register")}</dt><dd><span lang="en">{idiom.register}</span>{support?.register && <span className="korean-inline-support" lang="ko">{support.register}</span>}</dd></div><div><dt>{t("Where it fits")}</dt><dd><span lang="en">{idiom.context}</span>{support?.context && <span className="korean-inline-support" lang="ko">{support.context}</span>}</dd></div><div><dt>{t("Plain English")}</dt><dd><span lang="en">{idiom.plainEnglish}</span>{support?.plainEnglish && <span className="korean-inline-support" lang="ko">{support.plainEnglish}</span>}</dd></div>{idiom.avoid && <div><dt>{t("Take care")}</dt><dd><span lang="en">{idiom.avoid}</span>{support?.avoid && <span className="korean-inline-support" lang="ko">{support.avoid}</span>}</dd></div>}</dl>
  </>;
}

/** Search includes Korean support without exposing reference answers in recall cards. */
export function searchIdiomCatalog(query: string): readonly DailyIdiom[] {
  const search = query.trim().toLowerCase();
  return !search ? dailyIdioms : dailyIdioms.filter(idiom => {
    const support = koreanIdiomSupport(idiom.id);
    return [...Object.values(idiom), ...Object.values(support ?? {})].some(value => value.toLowerCase().includes(search));
  });
}

type IdiomCollectionProps = Omit<LearningProps, "profile"> & { profile: Profile | null; onBack: () => void; onSetup?: () => void };
export function IdiomCollection(props: IdiomCollectionProps) {
  const guest = useGuestAccess();
  const { t, locale } = useLearningLanguage();
  const { state, day, profile, onBack, onSetup } = props;
  const [listing, setListing] = useState({ query: "", page: 1 });
  const query = listing.query;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const idiomHeading = useRef<HTMLHeadingElement>(null);
  const catalogButtons = useRef(new Map<string, HTMLButtonElement>());
  const requestedFocus = useRef<{ kind: "detail" | "catalog"; id: string } | null>(null);
  useEffect(() => {
    const request = requestedFocus.current;
    if (!request) return; // Initial load keeps the visitor's existing focus.
    if (request.kind === "detail") {
      if (selectedId !== request.id) return;
      idiomHeading.current?.focus();
    } else {
      if (selectedId !== null) return;
      catalogButtons.current.get(request.id)?.focus();
    }
    requestedFocus.current = null;
  }, [selectedId]);
  const { save, notice, retry } = useDailySave(props);
  const blocked = props.blocked || Boolean(notice);
  const selected = dailyIdioms.find(idiom => idiom.id === selectedId);
  const page = dictionaryPage(searchIdiomCatalog(query), { page: listing.page, headword: idiom => idiom.phrase, id: idiom => idiom.id });
  const entries = page.items;
  const today = dailyIdiom(state, day).id;
  const open = (idiom: DailyIdiom) => {
    if (blocked || (!guest.active && profile && !save(current => revealCatalogIdiom(current, day, profile.roleId, idiom.id)))) return;
    requestedFocus.current = { kind: "detail", id: idiom.id };
    setSelectedId(idiom.id); window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const backToCatalog = () => {
    if (blocked || !selected) return;
    requestedFocus.current = { kind: "catalog", id: selected.id };
    setSelectedId(null);
  };
  return <section className="idiom-collection" aria-labelledby="idiom-collection-title" data-testid="idiom-collection">
    <div className="page-intro"><div><span className="eyebrow">{t("All idioms")}</span><h1 id="idiom-collection-title">{t("Idiom collection")}</h1><p>{t("Browse all {count} authored expressions with meanings, workplace examples and Korean support.", { count: dailyIdioms.length })}</p></div></div>
    <div className="button-row idiom-collection-navigation"><button className="text-button" disabled={blocked} onClick={onBack}>{t("← Back to Today")}</button>{onSetup && <button className="secondary-button" disabled={blocked} onClick={onSetup}>{t("Set up my course")}</button>}</div>
    <p className="muted">{t("Reading guidance builds familiarity. It does not award mastery or points.")}</p>
    {notice && <div className="save-notice" role="alert"><p>{t(notice)}</p><button disabled={props.blocked} onClick={retry}>{t("Retry this change")}</button></div>}
    {selected ? <article className="daily-idiom-card idiom-reference-card" aria-labelledby={`idiom-reference-${selected.id}`}>
      <button className="text-button" disabled={blocked} onClick={backToCatalog}>← {t("Back to idioms")}</button>
      <div className="card-top"><span>{t("Idiom guidance")}</span>{selected.id === today && <span>{t("Today’s Idiom")}</span>}</div>
      <h2 ref={idiomHeading} tabIndex={-1} id={`idiom-reference-${selected.id}`} lang="en">{selected.phrase}</h2>
      <div className="daily-guidance"><IdiomGuidance idiom={selected} /></div>
      {profile ? <div className="daily-review-action"><button className="secondary-button" disabled={blocked || Boolean(idiomReviewSchedule(state, selected.id))} onClick={() => guest.active ? guest.requestAccount("save") : save(current => addCatalogIdiomToReview(current, day, profile.roleId, selected.id))}>{idiomReviewSchedule(state, selected.id) ? t("In your review schedule") : t("Add idiom to spaced review")}</button><small>{idiomReviewSchedule(state, selected.id) ? t("In spaced review · next self-check {date}.", { date: idiomReviewSchedule(state, selected.id)!.nextReviewOn }) : t("Starts tomorrow. Idiom self-checks stay separate from word mastery and points.")}</small></div> : onSetup && <div className="daily-review-action"><button className="secondary-button" onClick={() => guest.active ? guest.requestAccount("save") : onSetup()}>{guest.active ? locale === "ko" ? "로그인하여 저장" : "Sign in to save" : t("Set up my course")}</button><small>{guest.active ? locale === "ko" ? "관용어를 계정에 보관하려면 로그인하세요." : "Sign in to keep this idiom in your account." : t("Set up your course to choose idioms for spaced review.")}</small></div>}
    </article> : <>
      <div className="library-tools"><label htmlFor="idiom-search">{t("Search idioms")}</label><input id="idiom-search" type="search" value={query} onChange={event => setListing({ query: event.target.value, page: 1 })} placeholder={t("Search idioms, meanings or usage")} /></div>
      <p className="muted">{t("Choose an idiom to read its meaning and usage.")}</p>
      <DictionaryPagination page={page.page} totalPages={page.totalPages} totalCount={page.totalCount} onPageChange={next => setListing(current => ({ ...current, page: next }))} label="Idiom pages" disabled={blocked} />
      {entries.length ? <div className="idiom-catalog-grid">{entries.map(idiom => <button className="idiom-catalog-entry" id={`idiom-catalog-${idiom.id}`} ref={button => { if (button) catalogButtons.current.set(idiom.id, button); else catalogButtons.current.delete(idiom.id); }} key={idiom.id} disabled={blocked} onClick={() => open(idiom)} aria-label={`${idiom.phrase} · ${t("Read meaning & usage")}`}><strong lang="en">{idiom.phrase}</strong><span>{t("Read meaning & usage")} →</span>{idiom.id === today && <small>{t("Today’s Idiom")}</small>}{idiomReviewSchedule(state, idiom.id) && <small>{t("In your review schedule")}</small>}</button>)}</div> : <div className="empty-state"><h2>{t("No matching idioms")}</h2><p>{t("Try another English phrase or Korean meaning.")}</p></div>}
    </>}
  </section>;
}

export function DictionaryPagination({ page, totalPages, totalCount, onPageChange, label, disabled = false }: { page: number; totalPages: number; totalCount: number; onPageChange: (page: number) => void; label: string; disabled?: boolean }) {
  const { t } = useLearningLanguage();
  return <nav className="dictionary-pagination" aria-label={t(label)}>
    <p role="status">{t("Page {page} of {pages} · {count} entries", { page, pages: totalPages, count: totalCount })}<small>{t("A–Z · 20 per page")}</small></p>
    <div className="button-row"><button className="secondary-button" disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)}>{t("Previous")}</button><button className="secondary-button" disabled={disabled || page >= totalPages} onClick={() => onPageChange(page + 1)}>{t("Next")}</button></div>
  </nav>;
}
