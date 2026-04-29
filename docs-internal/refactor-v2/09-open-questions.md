---
last-verified: 2026-04-29
status: open
---

# Offene Fragen (zu beantworten in der nÃ¤chsten Session)

Single-Source der Fragen, die zwischen Sessions stehengeblieben sind. Wenn du diese Datei liest: bitte zuerst diese Fragen beantworten, dann erst weiterarbeiten. Beantwortete Fragen werden in `06-progress-log.md` mit Antwort dokumentiert und hier entfernt (oder mit â€žBEANTWORTET am DATUM" markiert).

---

## Q1 â€” Repo-Transfer-Status (out-of-scope fÃ¼r Refactor, aber blockt v7.35.x-Releases)

**Kontext:** Der `SessionStart:resume`-Hook erinnert daran, dass in v7.35.14 das Repo-Transfer-Popup aktiv ist (`FEATURE_POPUP_VERSION = "7.35.14"` in `src/Service/FeaturePopupService.ts`). Es informiert User Ã¼ber den Transfer Roukys/HHauto â†’ OldRon1977/HHauto. Die `origin`-URL ist inzwischen `OldRon1977/HHauto_OldRon.git` â€” d.h. das ursprÃ¼ngliche `origin/HHauto` wurde von GitHub umbenannt, weil OldRon1977/HHauto jetzt der neue â€žkanonische" Repo-Name ist.

**Frage:** Ist der Transfer komplett abgeschlossen?

- (a) **Ja, komplett:** `FEATURE_POPUP_VERSION = "0"` setzen, neue Release v7.35.15 vorbereiten (Bump in `package.json`, Build, Commit, neue Release tag)
- (b) **Nein, lÃ¤uft noch, neue Release ist vorbereitet:** `FEATURE_POPUP_VERSION` auf neue Release-Version bumpen (z.B. `"7.35.15"`)
- (c) **Nein, lÃ¤uft noch, keine neue Release in Arbeit:** Nichts Ã¤ndern, weiter warten

**Wichtig:** Diese Aktion findet auf `main` statt, NICHT auf `refactor/v7.36.0`. Sollte parallel zum Refactor laufen.

---

## Q2 â€” Functional-Inventory-Methode (blockt Phase 0)

**Kontext:** Phase 0 erstellt `10-functional-inventory.md` als Master-Checkliste fÃ¼r â€žkeine Funktion darf fehlen". Erster Versuch via Background-Sub-Agent (general-purpose, Sonnet 4.6) am 2026-04-27 ist nach 31 Tool-Calls am Quota-Limit gescheitert â€” keine Datei produziert.

**Frage:** Wie soll das Inventory entstehen?

- (a) **Inline in der Hauptkonversation:** Token-Kosten in der Haupt-Session, dafÃ¼r kontrollierbar in Schritten (Sektion fÃ¼r Sektion). Pause/Resume zwischen Sektionen mÃ¶glich.
- (b) **Erneuter Sub-Agent mit kleinerem Scope:** Mehrere Mini-Agents nacheinander, jeder fÃ¼r eine Sub-Section (z.B. Run 1: 33 Handler + Page-UI-Handler; Run 2: 179 SK + 89 TK; Run 3: 16 Service-Files; Run 4: 25 Module-Root + 16 Events + 5 Harem; Run 5: 17 Helper + Utils + Game-Variants; Run 6: AJAX/UI/Anti-Detection/Migration/Tests/i18n/Drift). Pro Run < ~100 Tool-Calls. Resilient gegen Quota-Limits.
- (c) **Du selbst manuell:** Du erstellst das Inventory am Code, ich liefere nur Code-Listen, Greps, Datei-Strukturen auf Anfrage. HÃ¶chste QualitÃ¤t durch dein DomÃ¤nenwissen, dafÃ¼r dein Zeitaufwand.

**Empfehlung beim Wiedereinstieg:** (b) â€” Sub-Agent mit kleinerem Scope. Pro Sektion ein kleiner Run. Robust gegen Quota.

---

## Q3 â€” Code-Re-Verifikation gegen v7.35.14 (vor Phase 0 abgeschlossen)

**Kontext:** Doku-IST-Stand wurde am 2026-04-27 gegen v7.35.10 deep-verifiziert. Aktuelle Code-Basis ist v7.35.14. Delta zu v7.35.10:

- `.gitignore`: +`.kiro/`
- `HHAuto.user.js`: Build-Output (irrelevant)
- `README.md`: Doku
- `bonus-scripts/HHAuto-Login.user.js`: 2 Zeilen
- `build/HHAuto.template.js`: 6 Zeilen (Banner-Text, ggf. Repo-URL-Update)
- `package.json`: Versionsbump 7.35.10â†’7.35.14, Repo-URL
- `src/Helper/ConfigHelper.ts`: 2 Zeilen
- `src/Module/Troll.ts`: 10 Zeilen (Troll-Fix #1582)
- `src/Service/FeaturePopupService.ts`: 82 Zeilen (Repo-Transfer-Popup-Logik)
- `src/Service/StartService.ts`: 4 Zeilen
- `src/i18n/en.ts`: 2 Zeilen

**Bewertung:** Verified Facts (33 Handler, 179 SK + 89 TK, 16 Services, 25 Module-Root, 16 Events, 5 Harem, 17 Helper, 9 Spielvarianten, 510 Tests) bleiben unverÃ¤ndert. Nur Frontmatter-Update auf `verified-against-version: 7.35.14` durchgefÃ¼hrt am 2026-04-29.

**Status:** **GESCHLOSSEN** â€” Re-Verify ausreichend per Diff-Stat-Analyse, kein Deep-Re-Verify nÃ¶tig.

---

## Q4 â€” Build-Files: BannerBuilder.js + HHAuto.template.js (entschieden)

**Kontext:** Der Stash `wip-refactor-v2-docs-and-build-deletes` (vom 2026-04-27) enthielt unter anderem die LÃ¶schung von `build/BannerBuilder.js` und `build/HHAuto.template.js`. Beim Stash-Pop am 2026-04-29 entstand ein Konflikt.

**Antwort des Users (2026-04-29):** Build-LÃ¶schungen verworfen. Beide Files bleiben funktional. Refactor-Plan ist erst Doku-Stand, Build muss weiter laufen.

**Status:** **GESCHLOSSEN** â€” Files restauriert.

---

## Q5 â€” Push-Policy fÃ¼r den Refactor-Branch (entschieden)

**Kontext:** UrsprÃ¼ngliche Regel (2026-04-27): Refactor-Branch bleibt rein lokal, kein Push.

**Antwort des Users (2026-04-29):** Push zu `origin/refactor/v7.36.0` ist ausdrÃ¼cklich erlaubt â€” fÃ¼r Multi-Laptop-Arbeit. Push zu `upstream` (Roukys) bleibt strikt verboten. Push zu `origin/main` bleibt strikt verboten.

**Status:** **GESCHLOSSEN** â€” Push-Policy in `INDEX.md` aktualisiert.
