# ADR-012: Eine Tabelle für alle Freischaltbedingungen

## Status
Accepted

## Datum
2026-09-09

## Kontext

Acht Module beantworteten dieselbe Frage — *hat dieses Konto die Funktion
überhaupt freigeschaltet?* — mit acht handgeschriebenen Bedingungen:

| Modul | Bedingung |
| --- | --- |
| `League` | `isEnabledLeagues && getLevel() >= LEVEL_MIN_LEAGUE` |
| `Pantheon` | dasselbe, über `Pantheon.pure.decideIsEnabled` |
| `PathOfGlory`, `PathOfValue` | dasselbe, ausgeschrieben |
| `SultryMysteries` | nur Level, ohne Flag |
| `DoublePenetration` | nur Level — mit dem Kommentar `// And 10 gilrs` daneben |
| `PlaceOfPower` | 10 Mädchen und Welt > 2, plus eigene Log-Drosselung |
| `PathOfAttraction` | 10 Mädchen und Welt >= 2 |

Sie sind auseinandergelaufen. `DoublePenetration` nennt eine Bedingung im
Kommentar, die der Code nicht prüft. `LoveRaidManager` trägt seine
Levelprüfung auskommentiert. Die Zehn stand bis v8.12.14 zweimal als Literal
im Code.

Schwerer wiegt, dass jede Bedingung ihre Zahlen selbst liest — und **die
Zahlen sind der Teil, der schiefgeht**. Zwei der neun Fehler aus dem
8.12.9‑bis‑8.12.18‑Durchgang steckten in einer solchen Bedingung, nicht in
der Funktion dahinter:

- **v8.12.11**: `Harem.getGirlCount()` lieferte auf der Harem-Seite 24 für ein
  Konto mit 9 Mädchen. Ein Tor auf dieser Grundlage öffnet sich falsch.
- **v8.12.13/14**: dieselbe Zahl stand einen Tag lang auf 3, während die Seite
  13 auslieferte. Ein Tor auf dieser Grundlage bleibt falsch zu, und Place of
  Power blieb einem Konto verschlossen, das die Bedingung erfüllte.

## Entscheidung

**Eine Tabelle nennt die Bedingung je Modul, eine Stelle liest die Zahlen,
eine reine Funktion entscheidet.**

- `Service/FeatureGate.pure.ts` — die Entscheidung, ohne Globals, Storage
  oder DOM: `decideUnlocked(requirement, state)`.
- `Service/FeatureGate.ts` — die Tabelle `GATES`, aufgelöst gegen
  `ConfigHelper` (die `LEVEL_MIN_*`-Schwellen sind je Spielvariante
  überschreibbar und bleiben deshalb Schlüssel, keine Zahlen), und der
  Zugriff auf `HeroHelper.getLevel()`, `Harem.getGirlCount()` und
  `id_world`.
- Die acht `isEnabled()` rufen nur noch `FeatureGate.isUnlocked(name)`.

Drei Regeln, die die Tabelle trägt:

1. **Ein Wert, der keine Antwort ist, ist keine niedrige Antwort.** `0`,
   `NaN`, `undefined`, ein negativer Wert — alle werden zu 0, und 0 erfüllt
   keine positive Bedingung. Das Spiel liefert diese Zahlen ungleichmäßig:
   `getLevel()` ist 0, bevor eine Seite geparst wurde, `getGirlCount()` ist 0
   auch für „auf dieser Seite keine Quelle", `id_world` fehlt abseits der
   Questseiten.
2. **Nur lesen, was die Bedingung braucht.** Ein Levelprüfer holt die
   Mädchenzahl nicht — sie kostet Storage und, ohne Zwischenspeicher, die
   Seiten-Globals.
3. **Eine gesperrte Funktion sagt einmal, warum.** Nicht je Tick: dieselbe
   Zeile füllte einmal 692 von 2532 Logzeilen (v8.12.12). Die Meldung nennt
   Bedingung und Ist-Wert („needs 10 girls, the harem holds 9").

Die `isEnabledX`-Flags der Spielvariante gehören mit in die Tabelle, aber als
eigene Bedingung: sie werden **zuerst** geprüft, und eine Funktion, die es in
dieser Spielvariante nicht gibt, wird nicht protokolliert — das wäre auf
dieser Variante konstantes Rauschen und nicht die Schuld des Kontos.

### Was ausdrücklich nicht in die Tabelle kommt

**Eine Bedingung, die niemand gemessen hat.** `DoublePenetration` bleibt bei
der Levelprüfung. Der Kommentar `// And 10 gilrs` verschwindet, die Frage
steht als offener Punkt in `docs-internal/adventure-quest-flow.md`. Ein Test
hält fest, dass dort keine Mädchenbedingung steht, damit sie niemand aus dem
alten Kommentar heraus nachträgt.

**„Steht gerade auf der Seite" ist keine Freischaltbedingung.** Bei
`PlaceOfPower` bleibt diese Klausel im Modul: sie hält einen Lauf, der schon
dort ist, davon ab, mitten in der Arbeit weggeschickt zu werden.

## Verworfene Alternativen

### Eine globale Sperre — das Skript unter Level 30 ganz oder teilweise abschalten

Der Vorschlag, der zu dieser ADR geführt hat: statt jeden Fall einzeln
abzufangen, das Skript unterhalb einer Schwelle sperren.

Gegen die neun Fehler des 8.12.9‑bis‑8.12.18‑Durchgangs durchgerechnet hätte
eine solche Sperre **einen** verdeckt (v8.12.12, Logspam), **einen** betrifft
sie selbst (v8.12.13/14 — sie *ist* das Tor), und **einen** hätte sie
versteckt statt behoben (v8.12.11). Sechs blieben:

- Bundle-Reiter und Knopffarbe (8.12.9) — trifft jedes Konto
- Questkampf bei `autoTrollBattle=false` (8.12.10) — hängt am Schalter
- dreifacher Bundle-Lauf (8.12.15) — level-unabhängig
- `#skip-quest` (8.12.16) — nicht gezeigt, dass es niedrige Level betrifft
- PoA-Timer (8.12.17) — PoA verlangt ohnehin schon zehn Mädchen
- Team unter sieben (8.12.18) — **Level 52, 13 Mädchen, trotzdem Dreierteam**

Der letzte Punkt ist der entscheidende: die falsche Annahme hieß „sieben",
nicht „Level 30". Eine Sperre hätte sie unsichtbar gemacht, bis sie ein Konto
mit Level 300 trifft.

Dazu kommt: eine Sperre muss eine Zahl lesen, und genau diese Zahlen waren
zweimal der Fehler. Mehr Tore auf derselben Grundlage vervielfachen die
Stellen, an denen eine falsche Zahl entscheidet.

Verworfen. Was von der Idee bleibt, ist diese ADR: **weniger Tore, besser
gespeist, an einer Stelle.**

### Die Bedingungen ganz nach `HHEnvVariables` schieben

Die Schwellen stehen schon dort. Die *Zusammensetzung* („Level UND Mädchen
UND Welt") ist aber eine Entscheidung, keine Konstante, und `HHEnvVariables`
hat keine Tests.

Verworfen: die Tabelle steht neben der Funktion, die sie auswertet, und beide
sind geprüft.

### Ein Tor je Modul, nur mit gemeinsamer Hilfsfunktion

Wäre der kleinere Eingriff gewesen. Hätte aber genau das gelassen, was
schiefging: acht Orte, an denen jemand eine Bedingung ergänzt oder vergisst.
Der `DoublePenetration`-Kommentar ist der Beleg, dass das passiert.

## Konsequenzen

- Eine neue Funktion mit Freischaltbedingung bekommt eine Zeile in `GATES`;
  ein Name in `FeatureName` ohne Zeile fällt im Test durch.
- Die Schwellen stehen an einer Stelle im Test (`league` 20, `pathOfGlory`
  30, `placeOfPower` 10 Mädchen und Welt 3 …). Ändert das Spiel eine, ist die
  Fundstelle eindeutig.
- Neue Logzeilen: sieben Funktionen, die vorher stumm gesperrt waren, sagen
  jetzt einmal je Zustandswechsel, woran es liegt.
- `Pantheon.pure.decideIsEnabled` ist entfallen; seine Fälle stehen in
  `spec/Service/FeatureGate.pure.spec.ts`.
- Kein neuer Importzyklus: `deps:circular:check` bleibt bei 84 gegen die
  eingefrorene Baseline.

## Referenzen
- `src/Service/FeatureGate.ts`, `src/Service/FeatureGate.pure.ts`
- `spec/Service/FeatureGate.spec.ts`, `spec/Service/FeatureGate.pure.spec.ts`
- `docs-internal/adventure-quest-flow.md` — die ungemessene
  Zehn-Mädchen-Frage bei Double Penetration
- `CHANGELOG.md`, v8.12.11 bis v8.12.18 — die Fehler, aus denen die Regeln
  stammen
