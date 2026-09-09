# ADR-008: Import-cycle reduction strategy (ARCH-001)

Status: accepted (2026-07-05) · Stage 1 shipped in v8.1.6
Predecessor: ADR-001 ("no barrel index.ts imports") exists as enforced ESLint
rules (`no-restricted-imports` in eslint.config.mjs), not as a written record.

## Context

`docs-internal/circular-baseline.json` froze 349 import cycles (348 after the
WART-002 menu split). Cycles in this codebase are not cosmetic: modules that
are reached early inside a cycle before `config/HHStoredVars` finished
initializing throw TDZ ReferenceErrors and the whole userscript fails to boot
(lesson `zirkulaerer-import-tdz-crash`, issues #1598/#1672 era). The baseline
gate stops growth but not the standing risk.

Analysis (madge, edge frequency across all cycles) showed the graph is not
348 independent problems: a small "backbone" ring — config → Module →
Helper → Service → Utils → config — carries the overwhelming majority of
cycles. Breaking one high-frequency edge removes every cycle routed through
it.

## Decision

Reduce cycles **edge-wise, highest-frequency edge first**, using exactly
three mechanical, behavior-neutral patterns:

1. **Inline trivial cross-layer calls.** A config/leaf file must never
   import a Module for a helper it can express with its own imports.
   (HHStoredVars called `PlaceOfPower.cleanTempPopToStart()` — two
   `deleteStoredValue` lines — in three settings callbacks: inlined.)
2. **Extract shared constants into dependency-free leaf modules.** UI code
   that only needs option values must not import the feature module.
   (`Module/LabyrinthDifficulty.ts`, `Module/LeagueSortModes.ts`; the
   feature classes keep their old statics as aliases, so no caller changes.)
3. **Setter injection from the boot path** for genuine cross-layer calls,
   wired in `src/index.ts` before `hardened_start()` — the pattern already
   established by `setPachinkoAutoLoopKick`/`setBlockTick`/`setMenuPorts`.
   Guards must fail loudly (`throw`) when a call happens before wiring, not
   silently no-op. (HeroHelper's autoLoop retry kick; StorageHelper's
   `setDefaults` reference.)

Additionally, importers should target leaf modules directly instead of
facades that sit inside the cycle SCC (StorageHelper now imports
`menu/MenuSettings`, not the HHMenuHelper facade).

Not chosen: big-bang layering refactor (too risky for a live userscript),
madge ignore rules (hides instead of fixes), barrels (forbidden by ADR-001).

## Stage 1 result

Six edges broken, baseline 348 → **86** (target for stage 1 was < 300; the
current number lives in `docs-internal/circular-baseline.json`, 85 today):

| Edge | Cycles through it | Pattern |
|---|---|---|
| config/HHStoredVars → Module/PlaceOfPower | 253 | 1 (inline) |
| Helper/HeroHelper → Service/AutoLoop | 154 | 3 (injection) |
| Helper/StorageHelper → Helper/HHMenuHelper | 142 | facade → leaf import |
| Helper/HHMenuHelper → Module/LabyrinthAuto | 131 | 2 (constants leaf) |
| Helper/StorageHelper → Service/StartService | 127 | 3 (injection) |
| Helper/HHMenuHelper → Module/League | 113 | 2 (constants leaf) |

(Cycle counts overlap; the total drop is 262, not the column sum.)

## Stage 2 result

One edge, seven times: `Module/* → Service/AutoLoop`, imported only to call
`setTimeout(autoLoop, delay)` after an action that had switched the loop off.
Baseline 84 → **52**.

Measured before the change by removing exactly those seven imports and
re-running madge, so the number was known before a line was rewritten:

| | Zyklen |
|---|---|
| mit den sieben Kanten | 84 |
| ohne sie | 52 |

Pattern 3 (injection), as in the `HeroHelper → AutoLoop` row above -- but
through one shared seam, `Service/AutoLoopKick.ts`, instead of a setter per
module. The seam imports nothing at all: a leaf cannot join a cycle, so it
can never become the problem it was written to solve. The delay stays with
the caller for the same reason (a storage read would have pulled an import
in).

| Modul | Aufrufstellen |
|---|---|
| `Module/Bundles.ts` | 1 |
| `Module/Quest.ts` | 1 |
| `Module/League.ts` | 1 |
| `Module/PlaceOfPower.ts` | 1 |
| `Module/Events/DoublePenetration.ts` | 2 |
| `Module/Events/PathOfAttraction.ts` | 1 |
| `Module/Events/LivelyScene.ts` | 0 -- the import was unused |

`Module/Pachinko.ts` and `Helper/HeroHelper.ts` keep their own
`setPachinkoAutoLoopKick` / `setHeroAutoLoopKick`: both are wired and tested,
and moving them to the shared seam removes no cycle. Recorded here so the
next reader does not take it for an oversight.

## Follow-up stages

The remaining 52 cycles cluster around two rings; next candidate edges by
frequency: `Utils/Utils → Helper/StorageHelper`, `Helper/RewardHelper →
Module/Events/EventModule`, `Service/AutoLoop → Service/AutoLoopPageHandlers`,
`Utils/HHPopup → Utils/Utils`. Same playbook; baseline may only shrink.
Rules for every stage: gates green (`test`, `typecheck`, `build`,
`deps:circular:check`, `deps:toplevel-key`, `check:gm-grants`, `lint:ci`),
no behavior change, no barrels, `--update` only to record a shrink.
