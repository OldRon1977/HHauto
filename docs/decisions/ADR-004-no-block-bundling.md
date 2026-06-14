# ADR-004: Keine Block-Buendelung -- alle Handler bleiben Standalone

## Status
Accepted

## Datum
2026-06-14

## Kontext
Schritt 17 (Pipeline-Block-Architektur) sah in `design.md` ("Block-Mapping")
vor, Handler mit geteiltem Continuation-Token/Timer zu je einem Block zu
buendeln: Season (handleSeason + handleSeasonCollect), PentaDrill (+Collect),
Seasonal (handleSeasonalFreeCard + EventCollect + RankCollect), Champion
(handleChampion + handleChampionTicket) und BossBang (Parse + Fight).

Die urspruengliche Motivation war Koordination: mit dem alten
`lastActionPerformed`-Token konnten token-teilende Handler ueber Reloads
gegeneinander laufen (Ping-Pong, LV-28 Season fight<->collect, LV-29
PoP<->ClubChampion).

Zwei Fakten veraendern die Lage gegenueber dem urspruenglichen Entwurf:

1. **Slot-Hold (ADR-002) hat das Ping-Pong strukturell geloest** -- live
   validiert (v7.36.7: je 1 Start statt Loop; v7.36.11: 0 Interruptions ueber
   46 min). Die Koordinations-Motivation der Buendelung ist damit entfallen.
2. **Die Buendel-Mitglieder stehen in der aktuellen Pipeline-Reihenfolge NICHT
   nebeneinander.** Beispiele: handleSeasonCollect Position 10 vs handleSeason
   Position 27; handleChampionTicket 18 vs handleChampion 21;
   handleSeasonalFreeCard 8 vs EventCollect 12 vs RankCollect 13. Collect laeuft
   frueh (Rewards zuerst), Fight spaet. Eine Buendelung muesste sie zwangsweise
   benachbart machen -> Reihenfolge-Aenderung -> verhaltensnah, trotz des
   "verhaltensidentisch"-Anspruchs der Spec.

## Entscheidung
Keine Buendelung. Alle 33 Handler bleiben eigenstaendige Single-Step-Bloecke
(1:1 aus Task 6). Der andere Teil von Task 8 -- harte Ordnungs-Constraints +
`userMovable`-Flags -- ist umgesetzt (Commit `70f1a81`, v7.36.12) und davon
unabhaengig. Koordination token-teilender Handler uebernimmt der Slot-Hold
(ADR-002), nicht die Block-Struktur.

Entscheidung gemeinsam mit dem User getroffen (Handler-Tabelle durchgegangen,
User-Votum: alles Standalone).

## Verworfene Alternativen

### Volle Buendelung gemaess Spec (Season/PentaDrill/Seasonal/Champion/BossBang)
- Pro: Token-Gruppe erscheint als eine verschiebbare Einheit im Reorder-UI
  (Task 15); entspricht dem urspruenglichen design.md-Mapping.
- Contra: Mitglieder sind nicht benachbart -> Buendeln erzwingt Benachbarung
  = Reihenfolge-Aenderung = verhaltensnah. Die Ping-Pong-Motivation ist durch
  ADR-002 weg. Das Zusammenfuehren mehrerer Handler in einen Multi-Step-Block
  ist echtes Restructuring mit eigenem Live-Test-Aufwand und Regressionsrisiko.
- Verworfen: hoher Aufwand und Verhaltensrisiko fuer einen Nutzen
  (Reorder-Granularitaet), der durch den bereits geloesten Ping-Pong nicht mehr
  noetig ist.

### Teil-Buendelung nur BossBang (Parse + Fight)
- Pro: Parse (Position 24) + Fight (25) sind bereits benachbart und ein
  Feature (parse -> fight); Buendeln waere ordnungs-neutral.
- Contra: minimaler Mehrwert -- der Slot-Hold haelt den parse->fight-Flow
  ohnehin ueber den Reload zusammen. Ein einziger Sonderfall-Block neben 32
  Standalone-Bloecken erhoeht die Komplexitaet ohne klaren Gewinn.
- Verworfen: Nutzen zu gering. Kann spaeter via neues ADR nachgezogen werden,
  falls sich im Betrieb ein konkreter Bedarf zeigt.

## Konsequenzen
- Task 8 ist abgeschlossen mit dem Constraints-/`userMovable`-Teil; der
  Buendel-Teil entfaellt ersatzlos. Kein zusaetzlicher Code, da alle Handler
  bereits standalone sind.
- Das Reorder-UI (Task 15) zeigt alle `userMovable: true`-Bloecke einzeln,
  auch die Collect-/Fight-Handler getrennt. Feinere, aber transparente
  Granularitaet.
- Die Buendel-Tabelle in `design.md` ("Gebuendelte Bloecke") ist durch dieses
  ADR ueberholt und nicht mehr umzusetzen.
- Die Multi-Step-Zerlegung (Tasks 10-13: PoP-Repeat, Quest-Sub-Pfade) bleibt
  davon unberuehrt -- sie betrifft einzelne Handler, die reload-feste
  Mehrschritt-Logik brauchen, und ist keine Buendelung mehrerer Handler.

## Referenzen
- ADR-001 (Pipeline-Block-Architektur), ADR-002 (Slot-Hold).
- `design.md` "Block-Mapping" (ueberholte Buendel-Tabelle).
- Commit `70f1a81` (Constraints + userMovable, v7.36.12).
- Live-Validierung Slot-Hold: v7.36.7, v7.36.11 (PENDING_LIVE_VERIFICATION LV-29/LV-32).
