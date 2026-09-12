# Arbeit an HHauto

Die Regeln dieses Projekts stehen in [CONTRIBUTING.md](CONTRIBUTING.md) — vor
der ersten Änderung lesen. Dort steht, welches Dokument vor welcher Änderung zu
lesen ist, was ein Befund ist und was nicht, warum Doku den Ist-Zustand
beschreibt, was nach einer Änderung mitziehen muss, welche Tore das prüfen, wie
Mitschnitte anonymisiert werden und was beim Messen gegen das laufende Spiel
gilt.

Vier Sätze daraus, die keine Sitzung übersehen darf:

- **Am Aufrufort messen.** Ein Selektor mit 0 Treffern ist erst ein Befund,
  wenn Seite und Zustand benannt sind, in dem der Code ihn liest. Und getrennt
  notieren, was gemessen und was geschlossen ist.
- **Mitschnitte tragen keine echten Spieler.** Eigenes Konto `1`, fremde ab
  `1000`, Namen `Player_N` — auch nicht in Commit-Nachricht, PR-Text oder
  Bericht. `npm run check:player-data` prüft es, `npm run hooks:install` richtet
  den Pre-Commit-Hook ein.
- **Vor jeder Messung `shared.Hero.infos.id` prüfen.** Die ausgeloggte Seite
  liefert einen Platzhalter-Hero, gegen den jede Messung plausibel aussieht und
  Müll ist.
- **Alle Tore vor dem Commit**, und `HHAuto.user.js` gehört in denselben
  Commit wie die Quelle.
