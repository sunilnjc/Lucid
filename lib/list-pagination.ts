/** Dictionary browsing is separate from curated lesson and daily practice order. */
export const DICTIONARY_PAGE_SIZE = 20;
const englishDictionary = new Intl.Collator("en", { sensitivity: "base", ignorePunctuation: true });
const exactOrder = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
export function dictionaryPage<T>(entries: readonly T[], options: { page: number; headword: (entry: T) => string; id: (entry: T) => string }) {
  const ordered = [...entries].sort((a, b) => englishDictionary.compare(options.headword(a).trim(), options.headword(b).trim()) || exactOrder(options.id(a), options.id(b)));
  const totalCount = ordered.length, totalPages = Math.max(1, Math.ceil(totalCount / DICTIONARY_PAGE_SIZE));
  const requested = Number.isFinite(options.page) ? Math.trunc(options.page) : 1;
  const page = Math.max(1, Math.min(totalPages, requested));
  const offset = (page - 1) * DICTIONARY_PAGE_SIZE;
  return { items: ordered.slice(offset, offset + DICTIONARY_PAGE_SIZE), page, totalPages, totalCount, pageSize: DICTIONARY_PAGE_SIZE, from: totalCount ? offset + 1 : 0, to: Math.min(offset + DICTIONARY_PAGE_SIZE, totalCount) };
}
