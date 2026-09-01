#!/usr/bin/env node
// Prüft, dass keine echten Spielerkennungen im Repository landen.
//
// Warum: zweimal ist genau das passiert -- mitgeschnittenes Spiel-JSON wurde
// als Fixture committet und eine Messnotiz nannte das Konto, auf dem gemessen
// wurde. Beides stand danach in einem öffentlichen Repo und war nur noch
// durch einen History-Rewrite herauszubekommen.
//
// Eine Kontonummer ist eine Zahl; von einer beliebigen Zahl lässt sich nicht
// beweisen, dass sie keine ist. Prüfbar ist die Form, in der solche Daten
// hereinkommen: die Schlüssel des Spiel-JSON und die Prosa der Messnotizen.
// Diese Datei enthält deshalb keine einzige echte Kennung -- sie prüft
// Schlüssel, nicht Werte.
//
// Regel: Fixtures tragen nur Platzhalter-Identitäten. Das eigene Konto ist 1,
// fremde Spieler sind 1000 aufwärts, Namen sind Player_N. Genau so lagen
// hero-armor.json und die Nicknames schon vorher.
//
// Aufruf:
//   node scripts/check-player-data.mjs            # alle getrackten Dateien
//   node scripts/check-player-data.mjs --staged   # nur der Commit-Inhalt (Hook)
//   node scripts/check-player-data.mjs --message <datei>   # Commit-Nachricht
//
// Exit: 0 sauber, 1 Fund, 2 interner Fehler.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const staged = process.argv.includes('--staged');
// Die Nachricht ist der zweite Weg nach draußen: sie steht im Repo, in der
// Release-Übersicht und in jedem Klon, und keine Datei-Prüfung sieht sie.
const messageFile = process.argv.includes('--message')
    ? process.argv[process.argv.indexOf('--message') + 1]
    : null;

// Erlaubte Platzhalter: 1 für das eigene Konto, 1000-1999 für fremde Spieler.
const idIsPlaceholder = (n) => n === 1 || (n >= 1000 && n <= 1999);
const nickIsPlaceholder = (s) => /^Player_\d+$/.test(s);

// Schlüssel, die eine Person benennen. Quoted wie im JSON und unquoted wie in
// einem TS-Objektliteral; der Wert muss eine Zahl sein, damit `girl.id_member`
// im Code nicht anschlägt.
const ID_KEYS = ['id_member', 'id_player', 'member_id', 'id_user', 'id_hero'];
const idPattern = new RegExp(`"?(${ID_KEYS.join('|')})"?\\s*:\\s*(\\d+)`, 'g');
const nickPattern = /"?nicknames?"?\s*:\s*"([^"]*)"/g;
// Messnotizen: "Account 12345", "Konto 12345", "account id 12345" -- die Form,
// in der die Kennung in die Dokumentation kam. Die Zahl muss direkt am Wort
// hängen: "Klein-Account-Test (kein 2400-girls-Konto)" in ADR-003 meint eine
// Mädchenzahl und ist kein Fund.
const prosePattern = /\b(account|konto)\b(?:[ -]?(?:id|nr\.?|#))?[\s:#-]{0,3}(\d{4,})\b/gi;

// Binärdateien und alles, was ohnehin nur generiert ist, bleiben draußen;
// HHAuto.user.js NICHT -- der gebaute Stand ist die Auslieferung, und die
// Kennung stand beim letzten Mal auch darin.
const SKIP = /^(coverage\/|node_modules\/|.*\.(png|jpg|jpeg|gif|webp|ico|zip|pdf|woff2?)$)/;

function git(args) {
    // stderr geschluckt: contentOf fragt auch nach Pfaden, die es im Index noch
    // nicht gibt, und deren Meldung ist keine für den Benutzer.
    return execFileSync('git', args, {
        encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
    });
}

function fileList() {
    const out = staged
        ? git(['diff', '--cached', '--name-only', '--diff-filter=ACMR'])
        : git(['ls-files']);
    return out.split('\n').filter((f) => f && !SKIP.test(f));
}

function contentOf(path) {
    try {
        // Im Hook den Index lesen, nicht den Arbeitsbaum: was im Index steht,
        // ist das, was der Commit trägt. Im vollen Lauf die Platte, damit auch
        // eine gerade erst hinzugefügte Datei geprüft wird.
        return staged ? git(['show', `:${path}`]) : readFileSync(path, 'utf8');
    } catch {
        return null; // gelöscht, oder nicht lesbar
    }
}

function lineOf(text, index) {
    return text.slice(0, index).split('\n').length;
}

const findings = [];

function scan(label, text, prose) {
    for (const m of text.matchAll(idPattern)) {
        if (!idIsPlaceholder(Number(m[2]))) {
            findings.push([label, lineOf(text, m.index), `${m[1]} ist keine Platzhalter-Kennung (erlaubt: 1 oder 1000-1999)`]);
        }
    }
    for (const m of text.matchAll(nickPattern)) {
        if (!nickIsPlaceholder(m[1])) {
            findings.push([label, lineOf(text, m.index), `nickname "${m[1]}" ist kein Platzhalter (erlaubt: Player_N)`]);
        }
    }
    if (prose) {
        for (const m of text.matchAll(prosePattern)) {
            findings.push([label, lineOf(text, m.index), `nennt eine Kontonummer ("${m[0].trim()}")`]);
        }
    }
}

if (messageFile) {
    scan('Commit-Nachricht', readFileSync(messageFile, 'utf8'), true);
} else for (const file of fileList()) {
    const text = contentOf(file);
    if (text === null || text.includes('\0')) continue;
    scan(file, text, file.endsWith('.md'));
}

if (findings.length > 0) {
    for (const [file, line, why] of findings) {
        console.error(`FUND  ${file}:${line}  ${why}`);
    }
    console.error(`\n${findings.length} Fund(e). Mitschnitte werden beim Aufnehmen anonymisiert:`);
    console.error('eigenes Konto -> 1, fremde Spieler -> 1000 aufwärts, Namen -> Player_N.');
    console.error('Der Wert gehört auch nicht in die Commit-Nachricht oder den PR-Text.');
    process.exit(1);
}

const scope = messageFile ? 'in der Commit-Nachricht' : staged ? 'im Commit' : 'in den getrackten Dateien';
console.log(`OK    keine echten Spielerkennungen ${scope}`);
