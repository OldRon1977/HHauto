# ADR-002: Der Cool-down des Schedulers übersteht einen Reload

## Status
Accepted

## Datum
2026-05-19

## Kontext

Jeder Handler trägt ein `minIntervalMs`, das ihn davon abhält, sofort wieder zu
laufen. Liegt diese Uhr nur im Speicher, stirbt sie mit der Seite — und jedes
`gotoPage()` lädt das Skript neu. Der erste Tick nach dem Reload sieht den
Handler dann, als hätte er nie gearbeitet.

In #1700 ergab das ein Ping-Pong zwischen `handleEventParsing` und
`handleLeague`: jede Navigation setzte den Cool-down zurück, beide
Preconditions feuerten im nächsten Tick, beide navigierten, alle 3-5 Sekunden
von vorn.

Die klassischen Timer (`Helper/TimerHelper.ts`) lösen dasselbe Problem für die
imperativen Handler längst, indem sie bei jedem `setTimer` in den
sessionStorage schreiben. Bei der Übernahme in die Pipeline kam die Semantik
mit, die Persistenz nicht.

## Entscheidung

Die `lastRunAt`-Map wird unter `Temp_pipelineLastRunAt` im sessionStorage
gehalten: beim Start gelesen, nach jedem Run geschrieben, Format
`{handlerName: epochMs}`. Kaputte Einträge werden still verworfen — dann
verhält sich der Handler wie nach einem frischen Skriptstart, was die sichere
Voreinstellung ist. Handler-Autoren deklarieren weiterhin nur `minIntervalMs`
und müssen von Storage nichts wissen.

**Wo das heute liegt:** `BlockPipeline.blockPorts` liest und schreibt den
Schlüssel (`getLastRunAt` / `setLastRunAt`), `BlockScheduler` fragt ihn in
`eligibility` ab. Die Entscheidung hat die Klasse überlebt, für die sie
geschrieben wurde: `Scheduler.ts` ist inzwischen gelöscht.

## Verworfene Alternativen

**Die klassischen Timer je Handler nutzen:** einheitlicher Mechanismus, aber
die Cool-down-Logik wandert aus der deklarativen Konfiguration zurück in jeden
Handler-Rumpf. `minIntervalMs` ist ein Feld der Konfiguration und gehört
zentral aufgelöst.

**Cool-downs im AutoLoop-Tick verwalten:** verschiebt das Problem, denn
AutoLoop ist selbst eine Funktion, deren Speicher der Reload wegnimmt.

**Persistenz nur für Handler, die sie anfordern:** zwei Cool-down-Modelle
nebeneinander, ohne dass ein Fall bekannt wäre, der die In-Memory-Variante
braucht.

## Konsequenzen

- `minIntervalMs` wirkt über Reloads hinweg; das Ping-Pong aus #1700 ist
  strukturell weg.
- Ein Schreibzugriff mehr pro abgeschlossenem Run.
- Werden die Einträge einmal unlesbar, liest der Scheduler `{}` und schreibt im
  nächsten Tick neu. Kein Rückfall in den Loop.

## Referenzen

- Issue #1700
- `Helper/TimerHelper.ts` (Vorbild für die sessionStorage-Persistenz)
