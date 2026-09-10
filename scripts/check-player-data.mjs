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
// Die Formprüfung hat eine Lücke: eine nackte Kennung ohne solchen Schlüssel
// kommt durch. Wer seine eigenen Kennungen kennt, kann zusätzlich auf den
// *Wert* prüfen lassen -- ohne dass eine davon je ins Repo kommt. Die Liste
// wird zur Laufzeit von außerhalb gelesen (siehe privateValues unten) und
// weder ausgegeben noch protokolliert; ein Fund nennt Datei, Zeile und die
// Position in der Liste, nie den Wert. Ohne konfigurierte Liste verhält sich
// das Skript wie zuvor, damit ein fremder Klon und die CI unverändert laufen.
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
// Eigene Kennungen zusätzlich als Wert prüfen (alles optional):
//   HHAUTO_PRIVATE_IDS="123456 7890"        # direkt, getrennt durch , ; oder Leerraum
//   HHAUTO_PRIVATE_IDS_FILE=<pfad>          # eine Kennung je Zeile, # ist Kommentar
//   sonst ~/.config/hhauto-claude/private-ids.txt, falls vorhanden
//
// Exit: 0 sauber, 1 Fund, 2 interner Fehler.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';

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

/**
 * Die privat hinterlegten Kennungen, als Suchmuster.
 *
 * Reihenfolge der Quellen: HHAUTO_PRIVATE_IDS, dann HHAUTO_PRIVATE_IDS_FILE,
 * sonst ~/.config/hhauto-claude/private-ids.txt. Die Vorgabe liegt bewusst
 * außerhalb des Arbeitsverzeichnisses: eine Datei mit echten Kennungen im
 * Repo ist genau das, wovor dieses Skript schützen soll. Liegt der Pfad
 * trotzdem im Repo, muss git ihn ignorieren -- sonst bricht das Skript ab,
 * statt die Datei stillschweigend mitzuprüfen und später mitzucommitten.
 *
 * Kürzer als vier Zeichen wird verworfen: "42" steht in jeder zweiten Datei,
 * und ein Tor, das bei jedem Lauf anschlägt, wird abgeschaltet.
 */
function privateValues() {
    const fromEnv = process.env.HHAUTO_PRIVATE_IDS;
    const fileEnv = process.env.HHAUTO_PRIVATE_IDS_FILE;
    const fallback = join(homedir(), '.config', 'hhauto-claude', 'private-ids.txt');

    let raw = null;
    let source = null;
    if (fromEnv && fromEnv.trim()) {
        raw = fromEnv;
        source = 'HHAUTO_PRIVATE_IDS';
    } else {
        const path = fileEnv && fileEnv.trim() ? resolve(fileEnv.trim()) : fallback;
        const inRepo = !relative(process.cwd(), path).startsWith('..') && !isAbsolute(relative(process.cwd(), path));
        if (inRepo) {
            let ignored = false;
            try {
                execFileSync('git', ['check-ignore', '-q', path], { stdio: 'ignore' });
                ignored = true;
            } catch { ignored = false; }
            if (!ignored) {
                console.error(`ABBRUCH  ${path} liegt im Repo und wird von git nicht ignoriert.`);
                console.error('Eine Datei mit echten Kennungen gehört nicht in den Baum. Lege sie außerhalb ab');
                console.error('oder trage sie in .gitignore ein.');
                process.exit(2);
            }
        }
        if (!existsSync(path)) return { values: [], source: null };
        raw = readFileSync(path, 'utf8');
        source = path === fallback ? 'private-ids.txt' : 'HHAUTO_PRIVATE_IDS_FILE';
    }

    // Kommentare erst zeilenweise entfernen, dann trennen. Andersherum wird
    // aus "# eigene Kennungen" die Suche nach "eigene" und "Kennungen", und
    // das Tor meldet jede Datei, in der eines der Wörter vorkommt.
    const values = raw
        .split(/[\r\n]+/)
        .map((line) => line.replace(/#.*$/, ''))
        .flatMap((line) => line.split(/[,;\s]+/))
        .map((v) => v.trim())
        .filter((v) => v && v.length >= 4);
    return { values: [...new Set(values)], source };
}

const { values: privateIds, source: privateIdSource } = privateValues();

/**
 * Ein Muster je Kennung. Reine Ziffernfolgen bekommen Wortgrenzen, sonst
 * meldet eine sechsstellige Kennung jede Zahl, in der sie als Teilstück
 * vorkommt. Alles andere wird als Teilstring gesucht, damit ein Name auch in
 * "Player: <name>" auffällt.
 */
const privatePatterns = privateIds.map((v) => {
    const quoted = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return /^\d+$/.test(v) ? new RegExp(`\\b${quoted}\\b`, 'g') : new RegExp(quoted, 'g');
});

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
    // Der Wert selbst, egal in welcher Form er dasteht. Die Meldung nennt die
    // Position in der Liste, nicht den Wert -- sonst stünde die Kennung im
    // Terminal, im CI-Protokoll und in jedem Screenshot davon.
    privatePatterns.forEach((pattern, index) => {
        pattern.lastIndex = 0;
        for (const m of text.matchAll(pattern)) {
            findings.push([label, lineOf(text, m.index), `enthält die privat hinterlegte Kennung Nr. ${index + 1}`]);
        }
    });
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
// Ob die Wertprüfung lief, gehört in die Ausgabe: ein grünes Tor, das nur die
// Form geprüft hat, sagt weniger als eines, das auch die Werte kannte.
const valueNote = privateIds.length > 0
    ? `, ${privateIds.length} private Kennung(en) aus ${privateIdSource} mitgeprüft`
    : ' (nur Form -- keine privaten Kennungen hinterlegt)';
console.log(`OK    keine echten Spielerkennungen ${scope}${valueNote}`);
