// Proposes a Wikipedia article for each calendar event, strictly: the article
// title's words must all appear in the event's name (or name + city), or cover
// most of the name. Writes proposals for review; a human accepts them into
// src/lib/heat/wikiTitles.json. One request per second, identified by site.
import { readFileSync, writeFileSync } from 'node:fs';

const UA = 'dope.travel-heat/1.0 (https://dope.travel)';
const events = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const STOP = new Set(['the', 'of', 'and', 'de', 'la', 'le', 'du', 'des', 'di', 'del', 'a', 'in', 'at', 'on', 'for', 'festival', 'week', 'season', '2026', '2027']);
const words = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
const sig = (s) => words(s).filter((w) => !STOP.has(w));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = [];
for (const event of events) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(event.name)}&srlimit=5&format=json`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) { out.push({ id: event.id, name: event.name, error: res.status }); await sleep(3000); continue; }
  const body = await res.json();
  const nameWords = new Set(sig(event.name));
  const context = new Set([...nameWords, ...sig(event.city), ...sig(event.country)]);
  let pick = null;
  for (const hit of body.query?.search ?? []) {
    if (/disambiguation/i.test(hit.snippet ?? '') || /\(disambiguation\)/.test(hit.title)) continue;
    const t = sig(hit.title);
    if (!t.length) continue;
    const inside = t.every((w) => context.has(w));
    const cover = [...nameWords].filter((w) => t.includes(w)).length / Math.max(1, nameWords.size);
    if (inside && cover >= 0.5) { pick = hit.title; break; }
  }
  out.push({ id: event.id, name: event.name, city: event.city, pick });
  await sleep(1000);
}
writeFileSync(process.argv[3], JSON.stringify(out, null, 1));
console.log(out.filter((o) => o.pick).length, 'of', out.length, 'proposed');
