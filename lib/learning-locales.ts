/** Learning support locales are independent of learner identity, plans and evidence. */
import { koreanLearningUI } from "./learning-locale-copy";
import { koreanIdiomTranslations } from "./korean-idioms";
import { koreanBusinessWords } from "./korean-words-business";
import { koreanPeopleWords } from "./korean-words-people";
import { koreanHealthWords } from "./korean-words-health";
export type LearningLocale = "en" | "ko";
export type KoreanWordSupport = { meaning: string; usage: string };
export type KoreanIdiomSupport = { meaning: string; register: string; context: string; plainEnglish: string; avoid?: string };
export const learningLocaleRegistry = [{ locale:"en", label:"English", status:"available" },{ locale:"ko", label:"한국어", status:"available" }] as const;
export const LEARNING_LANGUAGE_STORAGE_KEY = "lucid.learning-language";
export function resolveLearningLocale(value: unknown): LearningLocale { return value === "ko" ? "ko" : "en"; }
export const koreanWords: Record<string, Record<string, KoreanWordSupport>> = { ...koreanBusinessWords, ...koreanPeopleWords, ...koreanHealthWords };
export function translateLearning(locale: LearningLocale, english: string, params: Record<string,string|number> = {}): string {
  const candidate = locale === "ko" && Object.hasOwn(koreanLearningUI,english) ? koreanLearningUI[english] : english;
  const placeholders = (value: string) => [...new Set(value.match(/\{[a-zA-Z0-9_]+\}/g) ?? [])].sort().join("|");
  const template = typeof candidate === "string" && candidate.trim() && placeholders(candidate) === placeholders(english) ? candidate : english;
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g,(placeholder,key:string) => Object.hasOwn(params,key) ? String(params[key]) : placeholder);
}
export function koreanWordSupport(wordId: string, roleId: string): KoreanWordSupport | undefined { return Object.hasOwn(koreanWords,roleId) && Object.hasOwn(koreanWords[roleId],wordId) ? koreanWords[roleId][wordId] : undefined; }
export function koreanIdiomSupport(id: string): KoreanIdiomSupport | undefined { return Object.hasOwn(koreanIdiomTranslations,id) ? koreanIdiomTranslations[id] : undefined; }
export const learningLocalizationPayload = { schemaVersion:1, locales:["en","ko"], koreanUI:koreanLearningUI, koreanWords, koreanIdioms:koreanIdiomTranslations };
