import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
const code = stripTypeScriptTypes(await readFile(new URL("../lib/list-pagination.ts", import.meta.url), "utf8"));
const { dictionaryPage, DICTIONARY_PAGE_SIZE } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const options = page => ({ page, headword: entry => entry.term, id: entry => entry.id });
const entries = count => Array.from({ length: count }, (_, index) => ({ id: `id-${index}`, term: `item-${String(index).padStart(3, "0")}`, role: index % 2 ? "b" : "a" })).reverse();

test("English dictionary browsing sorts A–Z with stable ID ties and never mutates curated source order", () => {
  const source = [{ id:"z",term:"zebra" },{ id:"b",term:"Apple" },{ id:"a",term:"apple" },{ id:"g",term:"beta" },{ id:"f",term:" Alpha " }];
  const before = JSON.stringify(source);
  assert.deepEqual(dictionaryPage(source, options(1)).items.map(entry => entry.id), ["f","a","b","g","z"]);
  assert.deepEqual(dictionaryPage([...source].reverse(), options(1)).items.map(entry => entry.id), ["f","a","b","g","z"]);
  assert.equal(JSON.stringify(source), before); assert.equal(DICTIONARY_PAGE_SIZE, 20);
});

test("93 role words and 470 all-role words appear 20 per page with complete nonoverlapping coverage", () => {
  for (const count of [93,470]) {
    const source=entries(count), before=JSON.stringify(source), seen=[];
    for(let number=1;number<=Math.ceil(count/20);number++) {
      const page=dictionaryPage(source,options(number));
      assert.equal(page.page,number); assert.equal(page.totalPages,Math.ceil(count/20)); assert.equal(page.totalCount,count);
      assert.equal(page.items.length,Math.min(20,count-(number-1)*20));
      assert.equal(page.from,(number-1)*20+1); assert.equal(page.to,Math.min(number*20,count));
      seen.push(...page.items.map(entry=>entry.term));
    }
    assert.equal(new Set(seen).size,count); assert.equal(seen[0],"item-000"); assert.equal(seen.at(-1),`item-${String(count-1).padStart(3,"0")}`);
    assert.equal(JSON.stringify(source),before);
  }
});

test("filtering and search happen before paging and stale pages clamp to remaining matches", () => {
  const source=entries(93), role=source.filter(entry=>entry.role==="a");
  const filtered=dictionaryPage(role,options(5));
  assert.equal(filtered.totalCount,47); assert.equal(filtered.totalPages,3); assert.equal(filtered.page,3); assert.equal(filtered.items.length,7);
  const searched=dictionaryPage(source.filter(entry=>entry.term.includes("item-09")),options(5));
  assert.equal(searched.totalCount,3); assert.equal(searched.page,1); assert.deepEqual(searched.items.map(entry=>entry.term),["item-090","item-091","item-092"]);
});

test("empty lists and malformed page requests retain a bounded accessible page state", () => {
  const empty=dictionaryPage([],options(88));
  assert.deepEqual(empty,{items:[],page:1,totalPages:1,totalCount:0,pageSize:20,from:0,to:0});
  for(const page of [-4,0,NaN,Infinity]) assert.equal(dictionaryPage(entries(93),options(page)).page,1);
  assert.equal(dictionaryPage(entries(93),options(2.9)).page,2);
  assert.equal(dictionaryPage(entries(93),options(99)).page,5);
});
