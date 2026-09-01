#!/usr/bin/env node
// Prüft die "Used by:" und "Depends on:"-Köpfe der Module gegen die echten
// Importe.
//
// Warum: am 2026-09-01 nannten 17 dieser Zeilen Module, die die Datei längst
// nicht mehr importieren -- TeamModule, EventModule, LabyrinthAuto und andere.
// Ein Kopf, der das Falsche behauptet, ist schlechter als keiner: er schickt
// den Leser in die falsche Datei.
import fs from 'fs';
import path from 'path';

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.ts')) files.push(p);
  }
})('src');

const text = Object.fromEntries(files.map(p => [p, fs.readFileSync(p, 'utf8')]));
const base = new Set(files.map(p => path.basename(p, '.ts')));

// modul -> wer es importiert
const importers = {};
for (const p of files) {
  const me = path.basename(p, '.ts');
  for (const m of text[p].matchAll(/from\s+["']([^"']+)["']/g)) {
    const mod = m[1].split('/').pop();
    (importers[mod] ||= new Set()).add(me);
  }
}

// Nur Modulnennungen mit .ts oder Pfad zaehlen -- Prosa wie "Cumback Contest
// event" nennt kein Modul, auch wenn ein Wort wie ein Dateiname aussieht.
const named = block => [...new Set(
  [...block.matchAll(/\b([A-Z][A-Za-z0-9_.]*?)\.ts\b/g)].map(m => m[1].split('/').pop())
)];
let failed = 0;

for (const p of files) {
  const me = path.basename(p, '.ts');
  const mine = new Set([...text[p].matchAll(/from\s+["']([^"']+)["']/g)].map(m => m[1].split('/').pop()));
  const lines = text[p].split('\n');

  for (let i = 0; i < lines.length; i++) {
    const st = lines[i].trim();
    const kind = /^(\/\/|\*)\s*Used by:/.test(st) ? 'used'
               : /^(\/\/|\*)\s*Depends on:/.test(st) ? 'deps' : null;
    if (!kind) continue;

    // Fortsetzungszeilen der Aufzählung mitnehmen
    let block = st.split(':').slice(1).join(':');
    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
      const nxt = lines[j].trim();
      if (/^(\/\/|\*)\s+[A-Z(]/.test(nxt) && !/^(\/\/|\*)\s*(Used|Depends|Why|Public)/.test(nxt)) block += ' ' + nxt;
      else break;
    }

    for (const n of named(block)) {
      if (!base.has(n) || n === me) continue;
      const wrong = kind === 'used'
        ? !(importers[me]?.has(n))          // n muss mich importieren
        : !mine.has(n);                      // ich muss n importieren
      if (wrong) {
        console.error(`DRIFT ${p}:${i + 1}  ${kind === 'used' ? 'Used by' : 'Depends on'} nennt ${n}, aber ${kind === 'used' ? `${n} importiert diese Datei nicht` : `diese Datei importiert ${n} nicht`}`);
        failed++;
      }
    }
  }
}

if (!failed) console.log(`OK    ${files.length} Dateien: kein "Used by"/"Depends on" widerspricht den Importen`);
process.exit(failed ? 1 : 0);
