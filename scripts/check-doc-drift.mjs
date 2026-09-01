#!/usr/bin/env node
// Prüft die Dokumente, die eine Liste aus dem Code führen, gegen den Code.
//
// Zwei Drifts haben das nötig gemacht: storage-keys.md stand einmal neun Keys
// hinter StorageKeys.ts, und eine zweite Kopie derselben Liste lag in
// data-sources-inventory.md mit wieder anderen Zahlen. Beides fiel erst bei
// einem Durchgang von Hand auf.
import fs from 'fs';

const read = p => fs.readFileSync(p, 'utf8');
let failed = 0;
const fail = (what, detail) => { console.error(`DRIFT ${what}\n       ${detail}`); failed++; };
const ok = what => console.log(`OK    ${what}`);

// --- SK/TK-Konstanten gegen storage-keys.md -------------------------------
const src = read('src/config/StorageKeys.ts');
const doc = read('docs-internal/storage-keys.md');

const constants = kind => {
  const block = src.split(`export const ${kind} = {`)[1];
  if (!block) return [];
  // Das Objekt endet mit "} as const;" -- nicht mit der ersten "};"-Zeile.
  const body = block.slice(0, block.indexOf('\n} as const;'));
  return [...body.matchAll(/^\s{4}(\w+)\s*:/gm)].map(m => m[1]);
};
// Nur Zeilen der Key-Tabellen: `konstante` | `Setting_...` | ...
const documented = [...doc.matchAll(/^\|\s*`(\w+)`\s*\|\s*`(Setting|Temp)_\w+`/gm)].map(m => m[1]);

for (const kind of ['SK', 'TK']) {
  const code = constants(kind);
  const missing = code.filter(k => !documented.includes(k));
  if (missing.length) {
    fail(`storage-keys.md: ${missing.length} ${kind}-Konstanten fehlen`,
         missing.slice(0, 8).join(', ') + (missing.length > 8 ? ' …' : ''));
  } else ok(`storage-keys.md kennt alle ${code.length} ${kind}-Konstanten`);
}

const codeAll = [...constants('SK'), ...constants('TK')];
const ghosts = documented.filter(k => !codeAll.includes(k));
if (ghosts.length) {
  fail(`storage-keys.md: ${ghosts.length} Einträge ohne Konstante im Code`,
       ghosts.slice(0, 8).join(', ') + (ghosts.length > 8 ? ' …' : ''));
} else ok('storage-keys.md führt keine Karteileichen');

// --- Seiten-IDs: page-mapping.md darf keine eigene Liste führen -----------
const mapping = read('docs-internal/page-mapping.md');
const tableRows = [...mapping.matchAll(/^\|\s*pagesID\w+/gm)].length;
if (tableRows > 0) {
  fail('page-mapping.md führt wieder eine eigene Seiten-Tabelle',
       `${tableRows} Zeilen -- die Liste gehört in HHEnvVariables.ts, sonst driftet sie`);
} else ok('page-mapping.md kopiert die Seiten-Liste nicht');

process.exit(failed ? 1 : 0);
