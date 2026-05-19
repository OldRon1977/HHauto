# ADR-002: Persist pipeline scheduler cool-down across page reloads

## Status
Accepted

## Datum
2026-05-19

## Kontext

The Scheduler in ``src/Service/Scheduler.ts`` runs declarative pipeline
handlers defined in ``Pipeline.config.ts``. Each handler carries a
``minIntervalMs`` cool-down that prevents the same handler from running
again before the cool-down has elapsed. The Scheduler stores the last
run time in an in-memory ``Map<string, number>`` and a singleton
instance.

The cool-down is correctly enforced for back-to-back ticks within the
same page session. It is **not** enforced across page reloads. Every
``gotoPage()`` triggers ``window.location.href = ...``, which re-loads
the script and re-instantiates the Scheduler with empty
``lastRunAt``. The next tick after the reload sees the handler as if
it had never run.

In issue #1700 (Comix Harem and Hentai Heroes logs) this manifested as
a tight ping-pong between ``handleEventParsing`` and ``handleLeague``:
each ``gotoPage`` reset the cool-down, both preconditions fired in the
next tick, both navigated, the cycle repeated every 3-5 seconds.

The classic ``Timers`` system in ``Helper/TimerHelper.ts`` already
solves the same problem for the imperative AutoLoop handlers. It
persists the timer dictionary to sessionStorage on every
``setTimer`` call. Pipeline handlers were originally migrated from
imperative AutoLoop to the declarative pipeline (PR #1681 et al.) and
the cool-down semantics were carried over **without** the persistence
side, on the assumption that each tick would be quick enough to keep
state in memory only. That assumption breaks the moment any handler
in the same tick triggers a navigation.

Constraints relevant to the decision:

- 144 source files, two pipeline handlers (handleEventParsing, handleLeague)
  in ``Pipeline.config.ts`` today; the architecture is meant to absorb more
  migrations from AutoLoop.
- sessionStorage is per-tab/origin; the user can have multiple HHAuto
  tabs open. The Timers infrastructure also writes to sessionStorage
  with the same caveat, so the existing trade-off is the baseline.
- No staging environment; the fix lands directly with users on the
  next ``@version`` bump.

## Entscheidung

Make the Scheduler's ``lastRunAt`` map persistent in sessionStorage,
under a new storage key ``Temp_pipelineLastRunAt``. The Scheduler
restores the map in its constructor and writes the map after every
chain completion or failure. The persistence layer lives entirely
inside ``Scheduler.ts``; pipeline handler authors keep declaring
``minIntervalMs`` on the handler config and do not need to know about
storage.

Storage format: ``{handlerName: epochMs}``. JSON-encoded. Restore is
defensive: malformed entries are dropped silently and the handler
starts with no cool-down (same behaviour as a fresh script load,
which is the safe default).

The ``reset()`` method (used in tests) also clears the persisted key
to keep test isolation explicit.

## Verworfene Alternativen

### Variante B1: Klassische Timers fuer Pipeline-Handler nutzen

Statt sessionStorage in Scheduler.ts einzubauen, koennte jeder
Pipeline-Handler die bestehende ``checkTimer/setTimer``-Infrastruktur
nutzen. Vorteil: einheitlicher Cool-down-Mechanismus mit AutoLoop.
Nachteil: das verlagert die Cool-down-Logik aus der deklarativen
Pipeline-Config heraus zurueck in jeden Handler-Body und untergraebt
den Vorteil der Pipeline-Architektur (deklarative Konfiguration).
Pipeline-Handler haben ``minIntervalMs`` als first-class Feld; das
sollte zentral aufgeloest werden, nicht pro Handler.

### Variante B2: Cool-down im AutoLoop-Tick statt im Scheduler tracken

Theoretisch koennte AutoLoop selbst pro Tick die Pipeline-Handler
filtern und sich an Cool-downs erinnern. Praktisch ist AutoLoop
ohnehin wieder eine Singleton-Funktion mit gleicher in-memory-Schwaeche
nach Page-Reload. Verlagert das Problem nur, ohne es zu loesen.

### Variante B3: Cool-down-Persistierung nur fuer als ``persistent``
markierte Handler

Pro Handler ein neuer Flag ``persistentCooldown: boolean``. Nachteil:
zwei Cool-down-Modelle in der Pipeline (in-memory vs. persistent),
was die Mental Model verkompliziert. Der bestehende Use-Case (League
60s) und alle absehbaren naechsten Migrationen profitieren von
Persistenz; ein Opt-in lohnt sich nicht.

## Konsequenzen

Positiv:

- ``handleLeague.minIntervalMs = 60_000`` wirkt wie erwartet auch ueber
  Page-Reloads hinweg. Ping-Pong gegen ``handleEventParsing`` ist
  unterbunden.
- Zukuenftige Pipeline-Migrationen erben das Verhalten ohne
  zusaetzliche Arbeit.

Negativ:

- Geringfuegig mehr sessionStorage-Schreibzugriffe (einer pro
  Pipeline-Tick-Abschluss). Auf modernen Browsern unproblematisch.
- Multi-Tab-Race: zwei HHAuto-Tabs schreiben auf denselben
  sessionStorage-Key. sessionStorage ist allerdings per Tab/Origin
  isoliert, sodass dieser Konflikt physisch nicht eintritt.

Risiko:

- Wenn die persistierten Eintraege jemals korrupt werden (z.B. durch
  Storage-Quota-Probleme), liest der Scheduler sie als ``{}`` ein und
  faellt auf das alte In-Memory-Verhalten zurueck. Kein Loop-Regress
  zu erwarten, weil der erste Tick nach Korruption die Werte sofort
  wieder schreibt.

## Referenzen

- Issue #1700 (Loop in beiden Spielen)
- ``REVIEW_autoloop_pingpong_power_zero.md`` -- Investigation-Notiz
- ``Helper/TimerHelper.ts`` -- Vorbild fuer sessionStorage-basierte
  Timer-Persistierung
