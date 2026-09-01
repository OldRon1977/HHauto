---
title: "Konzept: Wann ist ein Block fertig?"
status: Entwurf zur Entscheidung
last-verified: 2026-08-28
betrifft: "Issue #1841, ADR-009 (Fokussierte Aktivitaet), ADR-010 (Navigation ist kein Stopp)"
---

# Konzept: Wann ist ein Block fertig?

Entwurf zur Entscheidung. Ersetzt nicht ADR-009, sondern loest dessen
schwaechsten Teil ab: die Frage, woran der Scheduler erkennt, dass eine
Aktivitaet zu Ende ist. Heute raet er es aus drei Indizien; dieses Konzept
laesst den Block es sagen.

## 1. Was der Scheduler heute entscheidet

Drei Fragen, aber nur zwei Haken:

| Frage | beantwortet durch | gedacht dafuer |
|---|---|---|
| Darf dieser Block hier und jetzt starten? | `precondition(ctx)` | ja |
| Hat dieser Block noch Arbeit? | `precondition(ctx)` | nein |
| Hat der letzte Run ueberhaupt etwas getan? | `BlockRun.acted` | Hilfskonstrukt |

Die ersten beiden kollidieren immer dann, wenn die Antwort auf Frage 1
"nicht auf dieser Seite" lautet. Genau das ist der Fall aus #1841:
`handleTrollBattle` gibt Kampfergebnis-Seiten bewusst ab (#1740), der
Scheduler liest das als "fertig". ADR-009 hat das behoben, indem ein Fokus
eingefuehrt wurde -- aber der Fokus braucht seinerseits eine Antwort auf
Frage 3, und die gibt es im Modell nicht. Sie wird erschlossen.

## 2. Was `acted` gekostet hat

`acted` heisst "dieser Run hat etwas getan". Der Scheduler kann das nicht
messen, er schliesst es aus Indizien. Jedes Indiz wurde nachgereicht,
nachdem die Praxis ein Loch gezeigt hatte:

| Version | Loch | nachgereichtes Indiz |
|---|---|---|
| 8.10.27 | Fokus wurde auch von Leerlauf-Runs erneuert -- die Pipeline parkte auf `handleTrollBattle`, das alle 4 s nichts tat | `acted` ueberhaupt eingefuehrt: nur `repeat` (Slot-Hold) zaehlt |
| 8.10.29 | ein kaempfender Handler kehrt nie zurueck (die Kampfantwort navigiert), der Marker starb mit der Seite | gueltiges Resume nach Reload zaehlt als `acted` |
| 8.10.31 | `handleLeague` handelt und gibt den Slot absichtlich ab; der Run endet vor dem Reload, es gibt kein Resume | ausgeschalteter Auto-Loop zaehlt als `acted` |

Drei Indizien fuer eine Tatsache, die der Block selbst kennt. Das Muster ist
das Problem, nicht die einzelne Regel: jedes Indiz ist ein Stellvertreter,
und Stellvertreter haben Raender.

Ein Rand, den ich im Code sehe (**gelesen, nicht gemessen**): `acted` wird
gesetzt, sobald der Auto-Loop ausgeschaltet wurde -- das tut jedes
`gotoPage`, auch eines, das nur nach Hause navigiert, weil nichts zu tun
war. `handleQuest` hat genau so einen Pfad (`routeHomeIfWaitingOnQuest`:
Quest wartet auf Ressourcen, also zurueck nach Hause). Dieser Run hat fuer
die Aktivitaet nichts erreicht und gilt trotzdem als handelnd.

## 3. Befund: die Precondition sagt fast ueberall schon das Richtige

ADR-009 hat ein zweites Praedikat mit dem Argument verworfen, "33 Handler
muessten ihre interne Ressourcenlogik nach aussen spiegeln -- eine Kopie,
die auseinanderlaufen kann". Ich habe alle 35 Bloecke der Pipeline
durchgesehen. Das Argument haelt nicht:

**Nur zwoelf Bloecke sind ueberhaupt Aktivitaeten** (laufen wiederholt, bis
eine Ressource oder ein Ziel erschoepft ist). Der Rest sind Aufgaben
(einmal tun, Timer stellen), Helfer oder Infrastruktur -- fuer die ist die
Antwort auf "habe ich noch Arbeit" immer *nein*, sobald der Run fertig ist.

**Und bei neun der zwoelf steht die Antwort bereits in der Precondition:**

| Block | Rolle | Trigger heute | steht in |
|---|---|---|---|
| `handleLeague` | Aktivitaet | `isTimeToFight() \|\| checkTimer('nextLeaguesTime')` | Precondition |
| `handleSeason` | Aktivitaet | `isTimeToFight() \|\| checkTimer \|\| interFightPause()` | Precondition |
| `handlePantheon` | Aktivitaet | `isTimeToFight() \|\| checkTimer('nextPantheonTime')` | Precondition |
| `handlePentaDrill` | Aktivitaet | `isTimeToFight() \|\| checkTimer('nextPentaDrillTime')` | Precondition |
| `handleSultryMysteries` | Aktivitaet | `autoOpenRunning \|\| offene Events` | Precondition |
| `handleChampion` | Aktivitaet | `descriptor.isReady()` | Modul-Deskriptor |
| `handleClubChampion` | Aktivitaet | `descriptor.isReady()` | Modul-Deskriptor |
| `handleLabyrinth` | Aktivitaet | `descriptor.isReady()` | Modul-Deskriptor |
| `handlePlaceOfPower` | Aktivitaet | `PopToStart.length \|\| checkTimer` | Precondition |
| `handleBossBangFight` | Aktivitaet | teils DOM (`$('.completed-event')`) | Precondition, **seitenabhaengig** |
| `handleTrollBattle` | Aktivitaet | `shouldFight` -- Energie, Schwelle, Event-Maedel, Raid | **im Step**, wird verworfen |
| `handleQuest` | Aktivitaet | kein Trigger, Precondition ist "an und nicht fremdbeschaeftigt" | **fehlt** |

Die Aufgaben (14): `handleHaremSize`, `handleSalary`, `handleShop`,
`handleAutoEquipBoosters`, `handleMissions`, `handlePachinko`,
`handleSeasonalFreeCard`, `handleFreeBundles`, `handleContest`,
`handleDailyGoals`, `handleChampionTicket`, `handleLoveRaid`,
`handleBossBangParse`, `handleKobanAds`.
Die Helfer (7): die sechs Collect-Bloecke und `handleGenericBattle`
(`runsDuringFocus`, nehmen den Fokus nie).
Die Infrastruktur (2): `handleEventParsing`, `handleGoHome`.

Damit ist die Aufgabe nicht "33 Praedikate schreiben", sondern: **eine
Funktion benennen, die es neunmal schon gibt, einmal am falschen Ort steht
und einmal fehlt.**

## 4. Vorschlag

Ein optionales zweites Praedikat am Block:

```ts
interface Block {
  /** Darf ich hier und jetzt starten? Ort, Schalter, Loop-Zustand. */
  precondition(ctx: AutoLoopContext): boolean;
  /**
   * Habe ich noch Arbeit? Ressource, Ziel, Timer -- NIE die aktuelle Seite.
   * Fehlt das Praedikat, ist die Antwort false: der Block ist eine Aufgabe
   * und mit dem Ende seines Runs fertig.
   */
  wantsMore?(ctx: AutoLoopContext): boolean;
}
```

**Die Trennlinie ist die eigentliche Entscheidung:**

| gehoert ins Tor (`precondition`) | gehoert in `wantsMore` |
|---|---|
| aktuelle Seite (`ctx.currentPage`) | Energie, Kuesse, Tickets, Kampfkraft |
| Schalter, Feature-Flags des Spiels | Schwellen aus den Einstellungen |
| `ctx.busy`, `lastActionPerformed`, Auto-Loop | Timer (`checkTimer('next...')`) |
| `canCollectCompetitionActive` (Bremse) | offenes Ziel (Event-Maedel, Raid, Skin) |
| DOM-Abfragen | -- |

Der Grund fuer "nie die Seite": `wantsMore` wird ausgewertet, wenn ein Run
endet -- und das ist regelmaessig auf einer Kampfergebnis-Seite. Genau die
Seite, die das Tor zu Recht schliesst.

**Die Fokus-Regel wird damit eine Zeile:**

```ts
// heute
if (block.holdsFocus !== false && run.acted === true) setFocus(...)
// kuenftig
if (block.wantsMore?.(ctx)) setFocus(...) else releaseFocus("fertig")
```

Keine Erschliessung mehr. Der Block sagt es.

### Keine doppelte Wahrheit

Das Gegenargument aus ADR-009 zaehlt nur, wenn `wantsMore` eine *Kopie*
waere. Es ist keine, wenn es dieselbe Funktion ist:

- Wo der Trigger schon in der Precondition steht (9 Bloecke), wird er als
  benannte Funktion herausgezogen, und die Precondition ruft sie auf.
  Eine Funktion, zwei Leser.
- `handleTrollBattle`: `shouldFight` zieht aus dem Step heraus, der Step
  ruft `wantsMore(ctx)` auf. Wieder eine Funktion, zwei Leser -- und
  nebenbei verschwinden die Leerlauf-Runs. Wie viele das sind, steht
  inzwischen in zwei Nutzer-Logs:

  | Log | Starts von `handleTrollBattle` | echte Kaempfe | Leerlauf |
  |---|---|---|---|
  | Handler-Kommentar, 7.35.61 | 75 | 28 | 47 (63 %) |
  | Nacht 2026-08-25, 8.10.47 | 253 | 9 | 244 (96 %) |
  | Nacht 2026-08-26, 8.10.48 | 577 | 12 | 565 (98 %) |

  Der Block kommt durch sein Tor und faellt im Step durch, weil die
  eigentliche Frage erst dort gestellt wird.
- `handleQuest`: hier entsteht wirklich neue Logik, weil es heute keine
  gibt. Das ist der einzige Block, bei dem "Kopie, die auseinanderlaeuft"
  ueberhaupt ein Thema waere -- und der Grund, ihn zuletzt zu machen.
- `handleBossBangFight`: sein Trigger liest das DOM. `wantsMore` darf das
  nicht. Vorschlag: nur der seitenunabhaengige Teil
  (`checkTimer('nextBossBangTime')` + offene Event-IDs) wird `wantsMore`,
  der DOM-Teil bleibt im Tor.

## 5. Was aus `acted` wird

Es faellt aus der Fokus-Entscheidung heraus und wird ersatzlos entfernt --
alle drei Setz-Stellen (`repeat`, Resume nach Reload, Auto-Loop aus) und
das Feld in `BlockRun`. Der No-Progress-Watchdog haengt an `stepStartedAt`,
nicht an `acted`, und bleibt unberuehrt.

Auch die Frage "wer *nimmt* den Fokus" beantwortet sich damit von selbst:
wer `wantsMore` hat und es mit *ja* beantwortet. Aufgaben haben es nicht
und nehmen den Fokus nie -- die Liste `NEVER_FOCUS` wird zur Doku, nicht
zur Regel.

## 6. Absicherungen

Ein falsches `wantsMore` parkt die Pipeline -- exakt der Schaden von
8.10.27. Deshalb bleiben zwei Netze:

1. **`focusStaleMs` bleibt** (5 min ohne Run des fokussierten Blocks). Es
   greift kuenftig auch zuverlaessiger, weil der Zeitstempel nicht mehr von
   Leerlauf-Runs erneuert wird.
2. **Neu: Leerlauf-Zaehler.** Sagt ein fokussierter Block n-mal
   hintereinander *ja*, ohne dass sein Run in den Slot-Hold geht oder eine
   Seite wechselt, faellt der Fokus mit `ev=focus detail="sagt ja, tut
   nichts"`. Das ist die alte `acted`-Frage -- aber als Notbremse mit
   Logeintrag, nicht als Entscheidungsgrundlage. Vorschlag n = 5.

Zusaetzlich: die `ev=focus`-Logzeile bekommt das Ergebnis von `wantsMore`
mit. Damit steht im naechsten Nutzer-Log, warum die Pipeline geblieben oder
gegangen ist -- heute steht dort nur, dass sie es getan hat.

## 7. Umsetzung in Etappen

| Etappe | Inhalt | Risiko |
|---|---|---|
| 1 | Typ, Default, Scheduler liest `wantsMore`; `acted` bleibt als Rueckfall (`wantsMore?.(ctx) ?? run.acted`). Nur `handleTrollBattle` und `handleSeason` bekommen das Praedikat. | klein: fuer alle anderen Bloecke aendert sich nichts |
| 2 | Die uebrigen zehn Aktivitaeten, `handleQuest` zuletzt. | mittel: pro Block ein Testfall |
| 3 | `acted` und seine drei Setz-Stellen entfernen, `NEVER_FOCUS` auf Doku reduzieren. | klein, wenn Etappe 2 belegt ist |

Etappe 1 und 2 sind je eine PATCH-Version in der laufenden Linie, Etappe 3
kann mit der naechsten MINOR gehen.

## 8. Tests

- Pro Praedikat ein Unit-Test mit den Grenzfaellen, die es entscheiden soll
  (Energie genau auf der Schwelle, Timer gerade abgelaufen, Ziel gerade
  erreicht).
- Scheduler-Test: der Fokus bleibt genau so lange, wie `wantsMore` *ja*
  sagt, und faellt in dem Tick, in dem es *nein* sagt -- unabhaengig davon,
  was der Run getan hat.
- Scheduler-Test: Helfer duerfen weiterhin dazwischen, ohne den Fokus zu
  nehmen.
- Regressionstest zu 8.10.27: ein Block, der *ja* sagt und nichts tut,
  verliert den Fokus nach n Runs.

## 9. Was seither passiert ist

Zwei der drei `acted`-Loecher aus Abschnitt 2 sind mit ADR-010 geschlossen
worden, ohne das Praedikat einzufuehren: der Scheduler verwirft einen
gehaltenen Run nicht mehr, wenn das Skript beim Navigieren sein eigenes
autoLoop-Flag ausschaltet, und ein Block kann eine abschliessende
Navigation als `done` melden. Das Konzept hier bleibt davon unberuehrt --
es beantwortet die andere Frage: woran der Fokus erkennt, dass eine
Aktivitaet zu Ende ist. Die Messung aus dem 8.10.48-Nachtlauf spricht
weiter dafuer: 80 Fokus-Episoden, 144 Freigaben "nothing left to do",
9 "ran without doing anything" -- und bei genauer Zuordnung war keine
dieser neun ein Fehlgriff der Heuristik.

Ausgeliefert wurde all das mit dem Release v8.10.0 (2026-08-28). Das
Konzept ist damit nicht erledigt, sondern vertagt.

## 10. Offene Messung

Die Sonde, ob `Hero.energies.*` wirklich auf jeder Spielseite lesbar ist
(die Voraussetzung fuer "wantsMore ist seitenunabhaengig"), konnte ich am
2026-08-25 nicht fahren: die Profil-Session war ausgeloggt
(`is_guest_player`, kein `Hero`-Objekt). Aus dem Code spricht alles dafuer
-- `handleChampionTicket` liest `QuestHelper.getEnergy()` in seiner
Precondition auf beliebigen Seiten, `handleSeason` liest
`Hero.energies.kiss.next_refresh_ts` im Step --, gemessen ist es nicht.
Die Sonde ist read-only (kein Klick, kein Kampf) und dauert zwei Minuten,
sobald die Session wieder eingeloggt ist.

## 11. Zu entscheiden

1. Etappen wie vorgeschlagen, oder alle zwoelf Aktivitaeten in einem Zug?
2. Filtert `wantsMore` auch die *Auswahl* (`findNext`), oder nur den Fokus?
   Mit Filter verschwinden die Leerlauf-Runs (weniger Log-Rauschen, weniger
   Ticks), aber die Auswahl bekommt eine zweite Bedingung, die falsch sein
   kann. Empfehlung: erst nur der Fokus, Filter als eigener Schritt danach.
3. `handleQuest`: was heisst dort "noch Arbeit"? Heute laeuft der Block,
   solange er eingeschaltet ist. Kandidat: Quest-Energie ueber der Schwelle
   ODER ein Requirement, das gerade erfuellt wurde. Das ist eine
   Spielentscheidung, keine Code-Entscheidung.

## Referenzen

- ADR-009 (Fokussierte Aktivitaet), ADR-005 (Slot-Hold), ADR-006 (keine Buendelung)
- Issue #1841, Issue #1740, Issue #1796
- `src/Service/BlockScheduler.ts` (`complete`, `pickUnderFocus`, `eligibility`)
- `src/Service/BlockPipeline.ts` (`applySlotHold`, `FOCUS_INTERRUPTERS`)
