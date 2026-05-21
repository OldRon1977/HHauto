---
last-verified: 2026-04-23
---

# Zielarchitektur HHauto v7.36.0

Dieses Dokument beschreibt die fünf Bausteine der neuen Architektur, ihre Interfaces, Datei-Verortung und das Verhältnis zum Status quo.

---

## Übersicht

```
+-------------------------------------------------------+
|                       AutoLoop                        |
|  (bleibt: setTimeout-Loop ~1s, ruft Scheduler.tick)   |
+----------------------+--------------------------------+
                       |
                       v
+-------------------------------------------------------+
|                       Scheduler                       |
|  - liest Pipeline-Config                              |
|  - State-Machine pro Handler-Kette                    |
|  - SOFT/HARD-Interrupt-Logik                          |
|  - Atomic-Block-Garantie                              |
+--+----------------+--------------+--------+-----------+
   |                |              |        |
   v                v              v        v
+--------+  +-------------+  +-----------+  +---------+
| State  |  |  Event-Bus  |  |    DOM    |  |Game-API |
| Store  |  |             |  |  Adapter  |  |  Layer  |
+--------+  +-------------+  +-----------+  +---------+
```

Handler (Module) nutzen alle vier Service-Schichten. Direkte DOM-Queries oder direkte Storage-Calls sind nach Refactor verboten.

---

## 1. Declarative Scheduler

### Pipeline-Config-Format

Datei: `src/Service/Pipeline.config.ts`

```typescript
export type InterruptPolicy =
  | 'always'                          // jederzeit unterbrechbar (default)
  | 'never'                           // nicht unterbrechbar (außer SOFT)
  | { betweenSteps: number[] }        // nur an markierten Punkten

export type StepResult =
  | { ok: true }
  | { ok: false; reason: string; retryable: boolean }

export type ChainStep = {
  name: string                        // z.B. "navigateToTeams"
  fn: () => Promise<StepResult>
  timeoutMs?: number                  // pro Schritt
}

export type HandlerConfig = {
  name: string
  priority: number                    // niedriger = früher
  minIntervalMs: number               // mindestens X ms zwischen zwei Läufen
  atomic: boolean                     // ganze Kette läuft als Einheit
  interruptible: InterruptPolicy
  precondition: () => boolean         // skip wenn false
  steps: ChainStep[]
  onFailure?: (failedStep: string, reason: string) => Promise<void>
  totalTimeoutMs?: number             // Watchdog für ganze Kette
}

export const pipeline: HandlerConfig[] = [
  // ... alle Handler hier deklariert
]
```

### Scheduler-Runtime

Datei: `src/Service/Scheduler.ts`

Pseudocode:

```typescript
type HandlerState = 'IDLE' | 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'INTERRUPTED'

class Scheduler {
  private states: Map<string, HandlerState> = new Map()
  private lastRunAt: Map<string, number> = new Map()
  private currentChain: { config: HandlerConfig; stepIdx: number; startedAt: number } | null = null

  async tick(): Promise<void> {
    // 1. SOFT-Interrupt-Check
    if (this.shouldSoftAbort()) {
      if (this.currentChain) await this.abortAtSafePoint()
      return
    }

    // 2. Watchdog: hängende Kette killen
    if (this.currentChain && this.isHung(this.currentChain)) {
      await this.failChain('watchdog timeout')
    }

    // 3. Wenn atomare Kette läuft: weitermachen
    if (this.currentChain && this.currentChain.config.atomic) {
      await this.continueCurrentChain()
      return
    }

    // 4. Pipeline durchgehen, höchste Prio die ready ist
    const next = this.findNextReady()
    if (next) await this.startChain(next)
  }

  private shouldSoftAbort(): boolean {
    return !Store.settings.master
        || MouseService.isPaused()
        || ParanoiaService.isResting()
  }

  private findNextReady(): HandlerConfig | null {
    return pipeline
      .filter(h => this.states.get(h.name) === 'IDLE' || !this.states.has(h.name))
      .filter(h => this.minIntervalElapsed(h))
      .filter(h => h.precondition())
      .sort((a, b) => a.priority - b.priority)[0] ?? null
  }

  // ... weitere Methoden (startChain, continueCurrentChain, failChain, abortAtSafePoint)
}
```

### Interrupt-Klassen

#### SOFT-Interrupt — bricht IMMER, auch atomare Ketten
- Master-Off (Setting `master = false`)
- User-Maus-Aktivität ([MouseService](../../src/Service/MouseService.ts) → pause)
- Paranoia-Pause aktiv

Atomare Ketten brechen am nächsten „safe point" ab. Default: nach abgeschlossenem aktuellen Step. Falls hängend: nach `totalTimeoutMs` oder `step.timeoutMs`.

#### HARD-Interrupt — höher-priorisierter Handler will laufen
- `interruptible: 'always'` — bricht ab, höherer Handler übernimmt
- `interruptible: 'never'` — wartet bis Kette fertig
- `interruptible: { betweenSteps: [2, 4] }` — bricht nur nach Step 2 oder 4 ab (nicht im Prototyp)

### Atomic-Failure-Handling

Wenn ein Schritt in atomarer Kette fehlschlägt:
1. `onFailure(failedStep, reason)` Callback ausführen (z.B. zurück-navigieren, State zurücksetzen)
2. Handler-State auf FAILED, dann zurück auf IDLE
3. Strukturierter Log-Eintrag (für `06-progress-log.md` analysierbar)
4. Min-Interval gilt — nicht sofort Retry
5. Nach 3 Failures in Folge: Handler temporär deaktivieren (4h Cooldown), User-Hinweis in pInfo

---

## 2. Getypter State-Store

Datei: `src/State/Store.ts`

### Tree-Struktur

```typescript
interface AppState {
  settings: {
    master: boolean
    settPerTab: boolean
    spendKobans0: boolean
    troll: TrollSettings
    league: LeagueSettings
    season: SeasonSettings
    champion: ChampionSettings
    paranoia: ParanoiaSettings
    // ... pro Modul ein Sub-Tree
  }
  runtime: {
    energy: { combat: number; mythic: number; quest: number; worship: number }
    haremSize: { count: number; lastUpdate: number }
    activeEvents: Event[]
    burst: boolean
    lastActionPerformed: string
    // ...
  }
  cache: {
    leagueOpponents: LeagueOpponent[]
    boosterStatus: BoosterStatus
    storeContents: StoreContent[]
    // ...
  }
}
```

### Accessor-Pattern

```typescript
// alt:
const enabled = getStoredValue(SK.autoTrollBattle) === 'true'

// neu:
const enabled = Store.settings.troll.enabled
```

### Migration aus 192 Keys

- Generator-Skript (`build/StoreGenerator.js`) liest [src/config/HHStoredVars.ts](../../src/config/HHStoredVars.ts) (Source of Truth) und erzeugt:
  - `AppState`-Type
  - Migrations-Mapper (alter Key → neuer Pfad)
- Beim ersten Start nach 7.36.0:
  - Migration ausführen
  - Alte Keys in Backup-Slot kopieren (`Backup_v7.35_Setting_*`)
  - Neuen Tree initialisieren mit Defaults aus `HHStoredVars.ts`
- `getStoredValue`/`setStoredValue` werden Deprecated aber bleiben funktional (für nicht-migrierte Module während Refactor)

### Persistenz

- Settings-Sub-Tree → localStorage (oder sessionStorage wenn `settPerTab`)
- Runtime-Sub-Tree → sessionStorage
- Cache-Sub-Tree → sessionStorage, mit TTL
- Auto-Persist: Schreiben triggert debounced Save (alle 500ms)

### Reactive Subscriptions (optional, ab Phase 4)

```typescript
Store.subscribe('runtime.energy.combat', (newValue) => {
  Scheduler.invalidatePrecondition('handleTrollBattle')
})
```

Nicht im Prototyp.

---

## 3. Erweiterter Event-Bus

Datei: `src/Service/EventBus.ts`

### Status quo

`onAjaxResponse(pattern, callback)` existiert in [src/Utils/Utils.ts:26](../../src/Utils/Utils.ts), wird aber nur in 2 von 50+ Modulen genutzt ([Spreadsheet.ts](../../src/Module/Spreadsheet.ts), [Booster.ts](../../src/Module/Booster.ts)).

### Erweiterung

```typescript
class EventBus {
  // Bestehender Mechanismus bleibt:
  onAjaxResponse(pattern: RegExp, cb: AjaxCallback): Unsubscribe

  // Neu: typisierte Game-Events
  onGameEvent<E extends GameEventType>(
    event: E,
    cb: (payload: GameEventPayload<E>) => void
  ): Unsubscribe

  emit<E extends GameEventType>(event: E, payload: GameEventPayload<E>): void
}

type GameEventType =
  | 'energy.changed'
  | 'battle.completed'
  | 'team.saved'
  | 'page.changed'
  | 'shop.refreshed'
  | 'girl.upgraded'
  // ...

type GameEventPayload<E> = E extends 'energy.changed' ? { type: string; before: number; after: number }
                        : E extends 'battle.completed' ? { result: 'win' | 'loss'; rewards: Reward[] }
                        : never
```

### Mapping XHR → GameEvent

Zentrale Datei: `src/Service/EventMapping.ts`

```typescript
EventBus.onAjaxResponse(/action=do_battles_v4/, (response) => {
  Store.runtime.energy.combat = response.hero_changes.energy_v4
  EventBus.emit('battle.completed', { result: response.win, rewards: response.rewards })
})
```

Damit nutzen Module nur die typisierten GameEvents, nicht die rohen XHR-Patterns. Wenn das Spiel die Endpoint-Namen ändert: nur `EventMapping.ts` wird angepasst.

### Polling vs. Events

**Wichtig:** Polling im AutoLoop bleibt das Rückgrat. Events sind nur Beschleuniger und State-Invalidator. Niemals Logik-Entscheidungen ausschließlich auf Event-basis treffen — der State-Store muss durch Polling regelmäßig korrigiert werden, falls Events ausgelassen werden.

---

## 4. Zentraler DOM-Adapter

Datei: `src/Service/DomAdapter.ts`

### Problem (aus Issue #1573)

Equipment-Inventory ist virtualisiert. Items detachen während Scroll. CSS-Selektor matcht ein Element, das beim Click nicht mehr im DOM ist (`isConnected === false`).

### Lösung

```typescript
class DomAdapter {
  // Re-Query bei jedem Zugriff, prüft isConnected
  query<T extends HTMLElement>(selector: string, parent?: Element): T | null

  // Mit Identity (z.B. data-id) → Re-Query nach DOM-Änderungen sicher
  queryWithId<T extends HTMLElement>(
    selector: string,
    id: string,
    idAttribute: string
  ): T | null

  // Atomarer Click: Re-Query direkt vor Click
  click(selector: string, options?: { id?: string; idAttr?: string }): boolean

  // Wartet bis Element existiert (mit Timeout)
  waitFor<T extends HTMLElement>(
    selector: string,
    timeoutMs: number
  ): Promise<T | null>

  // Wartet bis Element verschwindet (z.B. Loading-Spinner)
  waitForGone(selector: string, timeoutMs: number): Promise<boolean>
}
```

### Nutzung

```typescript
// alt:
$('#girl_armor_123').click()

// neu:
DomAdapter.click('.girl-armor', { id: '123', idAttr: 'data-girl-armor' })
```

### Nutzung in Pipeline-Steps

Atomare Ketten nutzen DomAdapter intern. Wenn ein Step fehlschlägt weil Element nicht da → Step-Result `{ ok: false, retryable: true }` → Scheduler retried im nächsten Tick (mit min-Interval-Delay).

---

## 5. Game-API-Layer

Datei: `src/Service/GameApi.ts`

### Problem

`unsafeWindow.championData`, `unsafeWindow.harem`, `unsafeWindow.hero_data` etc. sind effektiv `any`. Spiel-Update kann jeden Field-Name ändern, ohne dass TypeScript meckert.

### Lösung

```typescript
class GameApi {
  get hero(): HeroData {
    return this.safe(unsafeWindow.hero_data, HeroDataSchema, 'hero_data')
  }

  get championData(): ChampionData {
    return this.safe(unsafeWindow.championData, ChampionDataSchema, 'championData')
  }

  get harem(): HaremData {
    return this.safe(unsafeWindow.harem, HaremSchema, 'harem')
  }

  // ...

  private safe<T>(value: any, schema: Schema<T>, name: string): T {
    if (!schema.validate(value)) {
      logHHAuto.error(`Game API field ${name} invalid:`, value)
      // Fallback: leeres Objekt mit Defaults, oder throw
    }
    return value as T
  }
}
```

### Vorteil

- Spiel-Update bricht Field-Namen → genau ein Fehler an einem zentralen Punkt
- Bessere TypeScript-Typisierung im restlichen Code
- Schema-Validation als Frühwarn-System für Game-Updates

### Schema-Definitionen

Schemas pro Game-Variante in `src/State/Schemas/` (HH/CH/PH-Unterschiede falls vorhanden).

---

## Datei-Struktur (Ziel)

```
src/
  index.ts                    -- Entry, unverändert
  Service/
    AutoLoop.ts               -- Loop, ruft Scheduler.tick() statt direkt Handler
    Scheduler.ts              -- NEU: Pipeline-Runtime
    Pipeline.config.ts        -- NEU: Pipeline-Deklaration
    EventBus.ts               -- NEU: erweitert onAjaxResponse
    EventMapping.ts           -- NEU: XHR -> GameEvent Mapping
    DomAdapter.ts             -- NEU: zentraler DOM-Layer
    GameApi.ts                -- NEU: typisierter unsafeWindow
    StartService.ts           -- bleibt, aber nutzt neue Stores
    ParanoiaService.ts        -- bleibt
    PageNavigationService.ts  -- bleibt, nutzt DomAdapter intern
    InfoService.ts            -- bleibt
    MouseService.ts           -- bleibt, triggert SOFT-Interrupt
    AdsService.ts             -- bleibt
    TooltipService.ts         -- bleibt
    FeaturePopupService.ts    -- erweitert für Migration-Pop-Up
    SurveyService.ts          -- bleibt
    AutoLoopActions.ts        -- WIRD ENTFERNT (durch Pipeline ersetzt)
    AutoLoopPageHandlers.ts   -- bleibt (Page-UI ist nicht Pipeline)
    AutoLoopContext.ts        -- WIRD ENTFERNT (Scheduler hat eigenen Context)
  State/
    Store.ts                  -- NEU: typisierter Tree
    Migration.ts              -- NEU: Migration aus alten Storage-Keys
    persistence.ts            -- NEU: Auto-Save mit Debounce
    Schemas/                  -- NEU: Schema-Definitionen für GameApi
  Module/                     -- bleibt strukturell, intern angepasst
    ...
  Helper/                     -- bleibt
    StorageHelper.ts          -- DEPRECATED, nur noch für Legacy-Code
    ...
  config/
    StorageKeys.ts            -- DEPRECATED, nur noch Migration-Referenz
    HHStoredVars.ts           -- bleibt als Source of Truth, nährt Generator
build/
  BannerBuilder.js            -- bleibt
  StoreGenerator.js           -- NEU: erzeugt AppState-Type aus HHStoredVars
```

---

## Beziehung zu existierender Architektur

[docs-internal/architecture.md](../architecture.md) beschreibt den IST-Zustand. Diese Datei beschreibt das ZIEL.

Während des Refactors:
- `architecture.md` bleibt gültig für nicht-migrierte Bereiche
- `01-target-architecture.md` (diese Datei) wird sukzessive Realität
- Wenn Phase 9 (Cleanup) abgeschlossen: `architecture.md` wird durch eine neue Version ersetzt, die das Endresultat beschreibt
- Vor Ablösung: Vergleich gegen `10-functional-inventory.md` ob alles abgedeckt

Gleiches gilt für [page-mapping.md](../page-mapping.md) und [storage-keys.md](../storage-keys.md).

---

## 6. Quick-Wins (im Refactor-Branch implementierbar)

Erkenntnisse aus der xnh0x/HH++-Analyse, die unabhaengig von den Hauptphasen umgesetzt werden koennen:

### 6.1 serverNow() -- Zeitsynchronisation

**Quelle:** xnh0x suckless
**Problem:** HHAuto nutzt `Date.now()` fuer Timer-Vergleiche. Server-Zeit weicht ab -> Aktionen zu frueh/spaet.

```typescript
// Pattern aus suckless:
const serverNow = () => Math.trunc(server_now_ts + (Date.now() - client_sync_ts) / 1000)
```

**Umsetzung:** `src/Helper/TimeHelper.ts` um `serverNow()` erweitern. `server_now_ts` aus Game-Variablen (`unsafeWindow.server_now_ts`) lesen, `client_sync_ts` beim Seitenlade setzen.

### 6.2 Prevent Throttling -- AudioContext-Trick

**Quelle:** xnh0x suckless
**Problem:** Browser throttlen Background-Tabs (setTimeout auf 1000ms+). HHAuto laeuft im Hintergrund -> Loop wird extrem langsam.

```typescript
function preventThrottling(): void {
  const context = new window.AudioContext()
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.frequency.setValueAtTime(20, context.currentTime) // unhoerbar
  gain.gain.setValueAtTime(0.001, context.currentTime)         // quasi-stumm
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start()
}
```

**Umsetzung:** In `src/Service/StartService.ts` beim Init aufrufen. Optional per Setting abschaltbar.

### 6.3 Labyrinth-Pathfinding via Dynamic Programming

**Quelle:** xnh0x suckless
**Problem:** HHAuto nutzt Brute-Force DFS O(2^n). xnh0x nutzt DP O(n) rueckwaerts vom Boss.

**Vorteile:**
- 4 Strategien waehlbar (XP, Coins, Kisses, Fists) statt nur "leichtester mit Treasure"
- Datenquelle: `labyrinth_grid` (Game-Variable) statt DOM-Parsing
- Reaktiv: MutationObserver bei Bewegung statt einmalig beim Laden

**Umsetzung:** `src/Module/Labyrinth.ts` komplett ersetzen. Neuer Algorithmus in separater Datei `src/Module/LabyrinthPathfinder.ts`.

### 6.4 doASAP -- MutationObserver statt Polling

**Quelle:** xnh0x suckless / HH++ BDSM
**Problem:** HHAuto pollt mit `$('.selector').length > 0`. Ineffizient, verpasst schnelle DOM-Aenderungen.

```typescript
function doASAP<T extends HTMLElement>(
  callback: ($el: JQuery<T>) => void,
  selector: string,
  condition: ($el: JQuery<T>) => boolean = ($el) => $el.length > 0
): void {
  const $selected = $(selector)
  if (condition($selected)) { callback($selected); return }
  const observer = new MutationObserver(() => {
    const $el = $(selector)
    if (condition($el)) { observer.disconnect(); callback($el) }
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })
}
```

**Umsetzung:** Als Utility in `src/Helper/DomHelper.ts`. Schrittweise Polling-Stellen ersetzen.

---

## 7. Ergaenzung Phase 3 (Event-Bus): Konkrete AJAX-Patterns

Basierend auf der xnh0x-Analyse sind folgende AJAX-Actions als EventMapping-Kandidaten identifiziert:

### Bekannte hh_ajax Actions (aus Leagues++, suckless, League-Tracker)

| Action | Beschreibung | GameEvent-Mapping |
|--------|-------------|-------------------|
| `do_battles_leagues` | League-Kampf ausloesen (1-3 Kaempfe) | `battle.league.completed` |
| `do_battles_v4` | Standard-Kampf (Troll, Season, etc.) | `battle.completed` |
| `leaderboard` | League-Leaderboard abrufen | `league.leaderboard.updated` |
| `hero_update` | Hero-Daten aktualisieren | `hero.updated` |
| `harem_update` | Harem-Daten aktualisieren | `harem.updated` |

### onAjaxResponse als zentrales Pattern

```typescript
// Aus HH++ (jQuery.ajaxComplete):
$(document).ajaxComplete((evt, xhr, opt) => {
  if (opt?.data?.search?.(/action=do_battles_leagues/) >= 0) {
    const response = JSON.parse(xhr.responseText)
    if (response?.success) {
      EventBus.emit('battle.league.completed', {
        result: response.win ? 'win' : 'loss',
        rewards: response.rewards,
        heroChanges: response.hero_changes
      })
    }
  }
})
```

**Wichtig:** `onAjaxResponse` existiert bereits in `src/Utils/Utils.ts:26`, wird aber nur in 2 Modulen genutzt. Im Refactor wird es zum zentralen Event-Dispatch-Mechanismus in `EventMapping.ts`.

---

## 8. Ergaenzung Phase 5 (Game-API-Layer): SCHREIB-Operationen via hh_ajax

### Paradigmenwechsel: navigate+click -> API-Call

**IST-Zustand (HHAuto):**
```typescript
// League-Kampf: navigiere zur Seite, warte auf DOM, klicke Button
gotoPage(ConfigHelper.getHHScriptVars("pagesIDLeague"))
// ... warte auf Seitenlade ...
$('.battle-button').click()
```

**SOLL-Zustand (nach Refactor):**
```typescript
// League-Kampf: direkter API-Call, kein Seitenwechsel noetig
GameApi.battle.leagues(opponentId, numberOfBattles)
```

### Bekannte SCHREIB-Endpoints (aus xnh0x Leagues++)

```typescript
class GameApiBattle {
  async leagues(opponentId: string, battles: number = 3): Promise<BattleResult> {
    return this.call({
      action: 'do_battles_leagues',
      id_opponent: opponentId,
      number_of_battles: battles
    })
  }

  async standard(opponentId: string): Promise<BattleResult> {
    return this.call({
      action: 'do_battles_v4',
      id_opponent: opponentId
    })
  }

  private async call(params: Record<string, unknown>): Promise<BattleResult> {
    return new Promise((resolve, reject) => {
      unsafeWindow.hh_ajax(params, (response: any) => {
        if (response?.success) resolve(this.parseBattleResult(response))
        else reject(new GameApiError('Battle failed', response))
      })
    })
  }
}
```

### Vorteile direkter API-Calls

| Aspekt | navigate+click | hh_ajax direkt |
|--------|---------------|----------------|
| Geschwindigkeit | 2-5s (Seitenlade + DOM) | 200-500ms |
| Fehleranfaelligkeit | Hoch (DOM-Aenderungen) | Niedrig (API stabil) |
| Seiteneffekte | Navigiert weg von aktueller Seite | Bleibt auf aktueller Seite |
| Parallelisierbar | Nein | Ja (mehrere Calls gleichzeitig) |
| Detektierbarkeit | Sichtbar (Seitenwechsel) | Unsichtbar |

### Einschraenkungen

- Nicht alle Aktionen haben einen bekannten hh_ajax-Endpoint
- Manche Aktionen erfordern vorherige Seitennavigation (z.B. Event-Seiten mit dynamischen IDs)
- Anti-Bot-Detection koennte auf ungewoehnliche API-Call-Patterns reagieren -> ParanoiaService muss Delays einbauen
- Schrittweise Migration: erst League-Battles, dann Troll, dann weitere

### Datei-Verortung

```
src/Service/
  GameApi.ts          -- Lese-Zugriffe (hero, harem, championData) [Phase 5 original]
  GameApiBattle.ts    -- NEU: Schreib-Operationen (Kaempfe ausloesen)
  GameApiShop.ts      -- NEU: Shop-Operationen (kaufen, verkaufen)
  GameApiHarem.ts     -- NEU: Harem-Operationen (upgrade, equip)
```