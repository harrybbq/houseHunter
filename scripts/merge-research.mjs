// Merge agent research (research/*.json) into data/listings.json.
// Existing entries keep manual verdicts and notes; research fills the rest.
import fs from 'node:fs';

const SOURCES = ['known-listings', 'dennistoun', 'westend', 'southside'];
const OUT = 'data/listings.json';

const existing = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : [];
const byId = new Map(existing.map((l) => [l.id, l]));

for (const name of SOURCES) {
  const file = `research/${name}.json`;
  if (!fs.existsSync(file)) continue;
  for (const l of JSON.parse(fs.readFileSync(file, 'utf8'))) {
    const old = byId.get(l.id);
    if (!old) { byId.set(l.id, l); continue; }
    const merged = { ...l, ...Object.fromEntries(Object.entries(old).filter(([, v]) => v !== null)) };
    for (const k of ['kitchen', 'floor']) {
      if (old[`${k}Source`] !== 'manual' && l[`${k}Source`] === 'manual') {
        merged[k] = l[k]; merged[`${k}Source`] = 'manual';
      }
    }
    merged.status = l.status ?? old.status;
    merged.benchmark = old.benchmark || l.benchmark;
    byId.set(l.id, merged);
  }
}

const all = [...byId.values()];
fs.writeFileSync(OUT, JSON.stringify(all, null, 2));
console.log(`${all.length} listings -> ${OUT}`);
