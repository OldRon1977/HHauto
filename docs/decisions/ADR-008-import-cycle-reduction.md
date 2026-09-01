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

## Follow-up stages

The remaining 86 cycles cluster around two rings; next candidate edges by
frequency: `Utils/Utils → Helper/StorageHelper`, `Helper/RewardHelper →
Module/Events/EventModule`, `Service/AutoLoop → Service/AutoLoopPageHandlers`,
`Utils/HHPopup → Utils/Utils`. Same playbook; baseline may only shrink.
Rules for every stage: gates green (`test`, `typecheck`, `build`,
`deps:circular:check`, `deps:toplevel-key`, `check:gm-grants`, `lint:ci`),
no behavior change, no barrels, `--update` only to record a shrink.
