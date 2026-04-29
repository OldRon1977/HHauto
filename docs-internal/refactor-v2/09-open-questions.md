---
last-verified: 2026-04-29
status: open
---

# Offene Fragen (zu beantworten in der nächsten Session)

Single-Source der Fragen, die zwischen Sessions stehengeblieben sind. Wenn du diese Datei liest: bitte zuerst diese Fragen beantworten, dann erst weiterarbeiten. Beantwortete Fragen werden in `06-progress-log.md` mit Antwort dokumentiert und hier entfernt (oder mit „BEANTWORTET am DATUM" markiert).

---

## Q1 — Repo-Transfer-Status (out-of-scope für Refactor, aber blockt v7.35.x-Releases)

**Kontext:** Der `SessionStart:resume`-Hook erinnert daran, dass in v7.35.14 das Repo-Transfer-Popup aktiv ist (`FEATURE_POPUP_VERSION = "7.35.14"` in `src/Service/FeaturePopupService.ts`). Es informiert User über den Transfer Roukys/HHauto → OldRon1977/HHauto. Die `origin`-URL ist inzwischen `OldRon1977/HHauto_OldRon.git` — d.h. das ursprüngliche `origin/HHauto` wurde von GitHub umbenannt, weil OldRon1977/HHauto jetzt der neue „kanonische" Repo-Name ist.

**Frage:** Ist der Transfer komplett abgeschlossen?

- (a) **Ja, komplett:** `FEATURE_POPUP_VERSION = "0"` setzen, neue Release v7.35.15 vorbereiten (Bump in `package.json`, Build, Commit, neue Release tag)
- (b) **Nein, läuft noch, neue Release ist vorbereitet:** `FEATURE_POPUP_VERSION` auf neue Release-Version bumpen (z.B. `"7.35.15"`)
- (c) **Nein, läuft noch, keine neue Release in Arbeit:** Nichts ändern, weiter warten

**Wichtig:** Diese Aktion findet auf `main` statt, NICHT auf `refactor/v7.36.0`. Sollte parallel zum Refactor laufen.

---

## Q2 — Functional-Inventory-Methode (blockt Phase 0)

**Kontext:** Phase 0 erstellt `10-functional-inventory.md` als Master-Checkliste für „keine Funktion darf fehlen". Erster Versuch via Background-Sub-Agent (general-purpose, Sonnet 4.6) am 2026-04-27 ist nach 31 Tool-Calls am Quota-Limit gescheitert — keine Datei produziert.

**Frage:** Wie soll das Inventory entstehen?

- (a) **Inline in der Hauptkonversation:** Token-Kosten in der Haupt-Session, dafür kontrollierbar in Schritten (Sektion für Sektion). Pause/Resume zwischen Sektionen möglich.
- (b) **Erneuter Sub-Agent mit kleinerem Scope:** Mehrere Mini-Agents nacheinander, jeder für eine Sub-Section (z.B. Run 1: 33 Handler + Page-UI-Handler; Run 2: 179 SK + 89 TK; Run 3: 16 Service-Files; Run 4: 25 Module-Root + 16 Events + 5 Harem; Run 5: 17 Helper + Utils + Game-Variants; Run 6: AJAX/UI/Anti-Detection/Migration/Tests/i18n/Drift). Pro Run < ~100 Tool-Calls. Resilient gegen Quota-Limits.
- (c) **Du selbst manuell:** Du erstellst das Inventory am Code, ich liefere nur Code-Listen, Greps, Datei-Strukturen auf Anfrage. Höchste Qualität durch dein Domänenwissen, dafür dein Zeitaufwand.

**Empfehlung beim Wiedereinstieg:** (b) — Sub-Agent mit kleinerem Scope. Pro Sektion ein kleiner Run. Robust gegen Quota.

---

## Q3 — Code-Re-Verifikation gegen v7.35.14 (vor Phase 0 abgeschlossen)

**Kontext:** Doku-IST-Stand wurde am 2026-04-27 gegen v7.35.10 deep-verifiziert. Aktuelle Code-Basis ist v7.35.14. Delta zu v7.35.10:

- `.gitignore`: +`.kiro/`
- `HHAuto.user.js`: Build-Output (irrelevant)
- `README.md`: Doku
- `bonus-scripts/HHAuto-Login.user.js`: 2 Zeilen
- `build/HHAuto.template.js`: 6 Zeilen (Banner-Text, ggf. Repo-URL-Update)
- `package.json`: Versionsbump 7.35.10→7.35.14, Repo-URL
- `src/Helper/ConfigHelper.ts`: 2 Zeilen
- `src/Module/Troll.ts`: 10 Zeilen (Troll-Fix #1582)
- `src/Service/FeaturePopupService.ts`: 82 Zeilen (Repo-Transfer-Popup-Logik)
- `src/Service/StartService.ts`: 4 Zeilen
- `src/i18n/en.ts`: 2 Zeilen

**Bewertung:** Verified Facts (33 Handler, 179 SK + 89 TK, 16 Services, 25 Module-Root, 16 Events, 5 Harem, 17 Helper, 9 Spielvarianten, 510 Tests) bleiben unverändert. Nur Frontmatter-Update auf `verified-against-version: 7.35.14` durchgeführt am 2026-04-29.

**Status:** **GESCHLOSSEN** — Re-Verify ausreichend per Diff-Stat-Analyse, kein Deep-Re-Verify nötig.

---

## Q4 — Build-Files: BannerBuilder.js + HHAuto.template.js (entschieden)

**Kontext:** Der Stash `wip-refactor-v2-docs-and-build-deletes` (vom 2026-04-27) enthielt unter anderem die Löschung von `build/BannerBuilder.js` und `build/HHAuto.template.js`. Beim Stash-Pop am 2026-04-29 entstand ein Konflikt.

**Antwort des Users (2026-04-29):** Build-Löschungen verworfen. Beide Files bleiben funktional. Refactor-Plan ist erst Doku-Stand, Build muss weiter laufen.

**Status:** **GESCHLOSSEN** — Files restauriert.

---

## Q5 — Push-Policy für den Refactor-Branch (entschieden)

**Kontext:** Ursprüngliche Regel (2026-04-27): Refactor-Branch bleibt rein lokal, kein Push.

**Antwort des Users (2026-04-29):** Push zu `origin/refactor/v7.36.0` ist ausdrücklich erlaubt — für Multi-Laptop-Arbeit. Push zu `upstream` (Roukys) bleibt strikt verboten. Push zu `origin/main` bleibt strikt verboten.

**Status:** **GESCHLOSSEN** — Push-Policy in `INDEX.md` aktualisiert.
