---
last-verified: 2026-09-11
verified-against-version: 8.13.1
status: current
---

# HHauto Script Architecture

Struktur, Ablauf und die Stellen, an denen man nachsieht. Listen, die im Code
stehen (Dateien, Handler, Spiele), werden hier nicht kopiert: jede Kopie in
dieser Datei ist dem Code einmal hinterhergelaufen -- zuletzt eine Tabelle von
32 "klassischen" Handlern und eine Verzeichnisliste, die zwei Drittel der
heutigen Dateien nicht kannte.

---

## Entry-Point & Initialisierung

**Datei:** `src/index.ts`

- ruft `hardened_start()` beim Laden des Skripts auf; `hardened_start` prueft
  jQuery und die Forbidden-Seite und startet `start()` in `Service/StartService.ts`
- erweitert das globale `Window`-Interface um die Spiel-Globals, die ueber
  `unsafeWindow` gelesen werden
- verdrahtet die AutoLoop-Rueckrufe, die Module brauchen, ohne `AutoLoop` zu
  importieren: `setPachinkoAutoLoopKick(autoLoop)` und
  `setHeroAutoLoopKick(autoLoop)`. Ein statischer Import haette einen
  Modul->Service-Zyklus gebildet (ADR-008); der Entry-Point ist der einzige Ort,
  der diese Abhaengigkeit kennt.

---

## Main-Loop: AutoLoop

**Datei:** `src/Service/AutoLoop.ts`, Funktion `autoLoop()`. Ein rekursiver
`setTimeout`-Loop mit dem Abstand `Temp_autoLoopTimeMili`. Ein Durchlauf:

1. `updateData()`, Grundwerte fuer `questRequirement` und `battlePowerRequired`
2. Kontext bauen (`AutoLoopContext`: aktuelle Seite per `getPage()`,
   Kampfenergie, `lastActionPerformed`, `busy = false`)
3. nur bei `getBurst()` und ohne Mauspause: Paranoia-Plan aufraeumen,
   `CheckSpentPoints()`, Contest-Timer, Event-IDs der Seite lesen
   (`EventModule.parsePageForEventId`)
4. **Scheduler**: `blockTick(ctx)` -- jeder Action-Handler laeuft hier, als
   Block der Pipeline. Ausgesetzt, solange ein POST an `ajax.php` unterwegs ist
   (ADR-003)
5. **Seiten-Handler**: `handlePageSpecific(ctx)`, in jedem Durchlauf, auch ohne
   `master` (siehe unten)
6. Paranoia-Wechsel (`flipParanoia`), wenn nichts beschaeftigt ist
7. `lastActionPerformed` fortschreiben
8. naechsten Durchlauf planen, solange `Temp_autoLoop` aktiv ist

Es gibt keinen klassischen Handler-Durchlauf mehr neben der Pipeline;
`Service/AutoLoopActions.ts` exportiert nur noch `wouldFightWithPower`, das
`handleTrollBattle` benutzt.

---

## Scheduler-Pipeline

**Dateien:**
- `src/Service/Pipeline.config.ts` -- die Bloecke (`HandlerConfig`) und am Ende
  das `pipeline`-Array, das die Standard-Reihenfolge festlegt
- `src/Service/BlockPipeline.ts` -- Registry, Reihenfolge, `INFRA_BLOCKS`,
  `BLOCK_CONSTRAINTS`
- `src/Service/BlockScheduler.ts` -- Laufzeit: Vorbedingungen, Schritte,
  Slot-Hold, Fokus, Watchdog
- `src/Service/PipeLogger.ts` -- die `[PIPE]`-Logzeilen

Jeder Block ist eine `HandlerConfig` mit `precondition`, Schritten,
`minIntervalMs`, `atomic` und `interruptible`. Die Entscheidungen dahinter
stehen in den ADRs: Blockarchitektur (ADR-004), Slot-Hold bis home (ADR-005),
Fokus (ADR-009), Navigation ist kein Stopp (ADR-010), Cooldown-Persistenz
(ADR-002). Uebersicht: `docs/decisions/README.md`.

Zwei Extremfaelle zur Orientierung (Werte im Code nachsehen):

| Block | Eigenschaft |
|---|---|
| `handleEventParsing` | nicht atomar, `minIntervalMs` 2 s, in `INFRA_BLOCKS` gepinnt |
| `handleLeague` | `atomic: true`, `interruptible: 'never'` -- die Kampfsequenz wird nicht unterbrochen |

`BlockPipeline.buildRegistryAndOrder()` leitet Registry und Standard-Reihenfolge
aus dem `pipeline`-Array ab. Jeder Block ist damit in der Block-Order-UI
sichtbar und verschiebbar, ausser er steht in `INFRA_BLOCKS`
(`handleEventParsing`, `handleGoHome`) oder hat harte Constraints in
`BLOCK_CONSTRAINTS`. Ein Feature, das selbst navigiert, gehoert deshalb als
eigener Block in die Pipeline -- nicht als Tail-Call in einen fremden Block,
sonst taucht es in der UI nicht auf (Auto-Mystery).

Welcher Block gerade laeuft, zeigt das Log: `[PIPE] ... block=<name>
page=<id> ev=start|done|focus|skip`. Gemessen 2026-09-11: mit `master=true` und
nur `autoQuest` an startete als erstes navigierendes `handleEventParsing`
(`live-verification-lessons.md`).

### lastActionPerformed-Guard

`ctx.lastActionPerformed` (gespeichert in `Temp_lastActionPerformed`) sperrt
Bloecke, solange ein anderer eine mehrseitige Sequenz haelt: die meisten
Vorbedingungen verlangen `none` oder den eigenen Tag. Der `navInFlight`-Mutex
(#1598) verhindert Doppelnavigationen im selben Durchlauf; gegen Pingpong ueber
mehrere Durchlaeufe (#1664) braucht es zusaetzlich diesen Guard.

---

## Seiten-Handler

**Datei:** `src/Service/AutoLoopPageHandlers.ts`, `handlePageSpecific(ctx)`.

Laufen in jedem Durchlauf nach dem Scheduler und **ausserhalb** des
`master`-Schalters: sie fuegen Anzeigen und Knoepfe ein, lesen Seitendaten und
zaehlen etwa den Harem (`moduleHaremCountMax`). Einige handeln auch --
`PathOfAttraction.run()` sammelt auf der Event-Seite ein, wenn
`autoPoACollect` an ist. `master=false` ist deshalb kein Trockenlauf
(`live-verification-lessons.md`).

---

## Verzeichnisse

Welche Dateien es gibt, zeigt `ls src/*/`. Die Schichten und ihre Rolle:

| Verzeichnis | Rolle |
|---|---|
| `Service/` | Ablauf: AutoLoop, Pipeline und Scheduler, Start, Navigation, Paranoia, Team-Bau und -Bewertung |
| `Module/` | ein Spielbereich je Datei (Liga, Troll, Quest, Shop, ...), `harem/` und `Events/` als Unterordner |
| `Helper/` | Zugriffe ohne eigene Entscheidung: Storage, Timer, Seitenerkennung, Hero, Simulator |
| `Utils/` | Log, Ajax-Hooks, Popups |
| `config/` | `HHEnvVariables.ts` (Seiten-IDs, Spielkonstanten), `StorageKeys.ts` + `HHStoredVars.ts` (Storage-Register, auch `HHStoredVarPrefixKey`), `game/` (eine Datei je Spielvariante) |
| `model/` | Datentypen, `model/KK/` fuer die Formen der Spieldaten |
| `i18n/` | Uebersetzungen |

Barrel-Dateien (`index.ts` je Verzeichnis) gibt es nicht mehr (ADR-001).
Jede Datei nennt in ihrem Kopf `Used by:` und `Depends on:`;
`npm run check:headers` haelt das gegen die Importe.

---

## Modul-Pattern

Module sind statische Klassen ohne Instanzen. Die meisten tragen `isEnabled()`
(freigeschaltet) und `isActivated()` (vom Nutzer eingeschaltet), Kampfmodule
dazu `getEnergy()`; eine gemeinsame, vom Compiler gepruefte Schnittstelle gibt
es dafuer nicht -- die beiden statischen Interfaces, die `src/model/IModule.ts`
frueher fuehrte, waren nirgends referenziert und sind entfernt. Die Datei fuehrt
heute nur `ModuleHandlerDescriptor` (`isReady`, `execute`).
Freischaltbedingungen (Level, Maedchenzahl) stehen in einer Tabelle in
`Service/FeatureGate.ts` (ADR-012).

---

## Architektur-Patterns

| Pattern | Beschreibung |
|---|---|
| Statische Module | ein Zustand pro Skript-Lebensdauer |
| Kontext je Durchlauf | `AutoLoopContext` wird unter den Bloecken geteilt |
| Storage als Zustand | Settings und Laufzeitzustand im Browser-Storage, Praefix `HHAuto_` |
| Lazy Init | `callItOnce` fuer Einmal-Aufrufe je Seitenladen |
| Ajax-Interception | `onAjaxResponse(regex, callback)` am jQuery-`ajaxComplete` |
| Spielvarianten | eine Konfiguration je Domain mit Feature-Flags und Troll-Listen |
| Deklarative Pipeline | Bloecke mit Vorbedingung, Schritten, Watchdog, Unterbrechung |

---

## Unterstuetzte Spiele

Die Domains und ihre `gameID` stehen in `getEnv()` der Dateien unter
`src/config/game/`; HornyHeroes (`hh_sexy`) ist direkt in `HHEnvVariables.ts`
eingetragen. `getPage()` liest das Attribut `page` des Elements mit dieser ID.
Gemessen 2026-09-11 auf www.hentaiheroes.com: das ist das `<body>` der
Spielseite selbst (`<body id="hh_hentai" page="...">`), siehe
`page-mapping.md` und `runtime-architecture.md`.
