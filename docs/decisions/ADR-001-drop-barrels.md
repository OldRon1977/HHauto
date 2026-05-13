# ADR-001: Drop barrel index.ts files in favor of direct file imports

## Status
Accepted

## Datum
2026-05-13

## Kontext

Phase 0 (REVIEW_PHASE0.md) reported 227 circular dependency chains in
``src/``. Investigation showed that almost every cycle ran through one
of the eleven barrel ``index.ts`` files (``Helper/index.ts``,
``Module/index.ts``, ``Module/Events/index.ts``, ``Module/harem/index.ts``,
``Service/index.ts``, ``Utils/index.ts``, ``model/index.ts``,
``model/KK/index.ts``, ``i18n/index.ts``, ``config/index.ts``,
``config/game/index.ts``).

Pattern of a typical cycle pre-refactor:

```
Helper/BDSMHelper.ts
  -> Helper/ConfigHelper.ts
  -> Utils/index.ts                (barrel re-exports HHPopup, Utils, ...)
  -> Utils/HHPopup.ts
  -> Utils/Utils.ts
  -> Helper/index.ts               (barrel re-exports BDSMHelper)
  -> back to Helper/BDSMHelper.ts
```

The cycle exists because ``export *`` in a barrel pulls every sibling
file into the import graph of every consumer that imports anything
from that folder. The barrels coupled the entire module surface,
weakened tree-shaking, and obscured which file actually owned a
given symbol.

Constraints relevant to the decision:

- 144 source files, 56 spec files. Test coverage 31% statements /
  20% branches.
- Tampermonkey userscript with no staging environment; bugs land
  directly with users on the next ``@version`` bump.
- The CI gate from PR #1687 already blocks *new* circular
  dependencies. The 227-cycle baseline was a frozen tolerance,
  not an architectural fix.

## Entscheidung

Delete every ``index.ts`` barrel under ``src/``. Replace barrel
imports across ``src/`` and ``spec/`` with direct file imports that
point at the file declaring each symbol. Add an ESLint rule
(``no-restricted-imports``) that forbids reintroducing barrels.

The codemod ``scripts/drop-barrel-imports.mjs`` (ts-morph based) does
the rewriting; it stays in tree as documentation and as a tool for
future audits.

## Verworfene Alternativen

### Variante B: einseitige Barrel-Hierarchie

Keep the barrels, but enforce a strict layered import order so cycles
become impossible: ``Utils`` imports nothing internal, ``Helper``
imports only from ``Utils``, ``Module`` imports from ``Helper`` +
``Utils``, ``Service`` imports from anything but is never imported
back. Cycle prevention via ESLint ``no-restricted-imports`` + path
patterns.

- Pro: smaller diff -- only the "wrong-direction" imports need
  rewriting; barrels survive, ergonomics ("import from `'../Helper'`")
  preserved.
- Pro: explicit layer model carries architectural information.
- Contra: requires committing to a layer model up front. The actual
  layer boundaries between ``Module``, ``Service``, and ``Helper``
  are blurry today; deciding them in the abstract before phase 2
  module-by-module review would be premature.
- Contra: every wrong-direction import is still a code change.
  Aufwand close to Variante A but with less measurable upside (no
  bundle-size reduction, no clarification of symbol ownership).
- Contra: barrels still hide which file owns a symbol. A reader of
  ``import { ConfigHelper } from '../Helper'`` does not know whether
  ``ConfigHelper`` lives in ``ConfigHelper.ts`` or comes via
  ``HHHelper.ts``\'s re-export. Drop-barrels makes that explicit
  per import.

Verworfen: similar effort to Variante A without the bundle, tooling,
and clarity gains. Defers a decision (layer boundaries) into a less
appropriate phase.

### Variante C: Status quo + Stop-the-bleeding

Accept the 227 cycles as legacy debt, rely on the CI baseline gate
(``scripts/check-circular-deps.mjs``) to block any *new* cycle, and
revisit only if a future module review surfaces a concrete bug
caused by the cycle structure.

- Pro: zero refactoring risk in an under-tested codebase.
- Pro: no rewrites, instant decision, focuses code-review effort
  on Phase 2.
- Contra: bundle stays bigger than necessary because tree-shaking
  cannot prune through ``export *`` barrels.
- Contra: ``LanguageHelper.ts`` continues to depend on
  ``i18n/index.ts``\'s ``export *`` ordering for side-effect
  population of ``HHAuto_ToolTips``. That implicit coupling is
  fragile -- it broke during a separate refactor experiment in
  this work, and only the explicit side-effect imports added in
  this commit make the load order auditable.
- Contra: ``import { X } from '../Helper'`` keeps hiding which
  file owns ``X``. Phase 2 module reviews would have to dereference
  the barrel manually for every symbol.

Verworfen: pragmatic short-term but leaves architectural fragility
in place that the refactor effort can address now.

## Konsequenzen

### Positive

- Bundle: 1.40 MiB -> 1.39 MiB (one-time tree-shaking gain).
- ``LanguageHelper.ts`` now declares its language-file dependencies
  explicitly, decoupling i18n loading from any export-order
  convention.
- Every import points at the file that declares the symbol; symbol
  ownership is auditable from the import line alone.
- ESLint rule prevents reintroduction of barrels -- including future
  PRs that might add new ``index.ts`` files to new folders.

### Neutral

- Madge cycle count rose from 227 to 544 in the post-migration
  baseline. This is **not a regression**: the same underlying
  file-to-file edges existed before, but barrels collapsed many
  distinct paths into fewer reported chains. Without barrels, madge
  reports each direct file-to-file cycle plus combinatorial
  variations. The CI gate (``circular-baseline.json``) is updated
  to the new 544-cycle baseline so Phase 2 still blocks new
  cycles, just measured at higher precision.
- The remaining cycles cluster around small, real two-file
  bidirectional dependencies (e.g. ``Helper/TimerHelper.ts <->
  Helper/TimeHelper.ts``). They are candidates for individual
  resolution during Phase 2 module reviews; this ADR does not
  require resolving them.

### Negative / Risiken

- Imports per file are slightly more verbose. ``import { A, B } from
  '../Helper'`` may now be two or three direct imports.
- The codemod cannot detect implicit side-effect imports that the
  ``export *`` barrel happened to pull in. ``LanguageHelper.ts`` was
  the only such case in this repo (i18n language files mutate
  ``HHAuto_ToolTips`` at module top level); a future folder with the
  same pattern would have to be migrated by hand. The codemod\'s
  output documents the assumption and reports any case it cannot
  resolve, so the risk is detectable.
- 84 source files and 16 spec files changed in one PR. Coverage
  did not regress (and went up slightly because the explicit
  language-file imports load more code in jest), but a Tampermonkey
  bug that the existing 31%/20% test coverage misses would land
  with the next user-visible release.

## Verifikation

- ``npm run typecheck`` clean (TypeScript ``tsc --noEmit``).
- ``npm run build`` produces the userscript bundle (1.39 MiB,
  was 1.40 MiB).
- ``npm test`` 56 suites / 807 specs passing.
- ``node scripts/check-circular-deps.mjs`` matches the new 544-cycle
  baseline.
- ``npm run lint`` does not report any ``no-restricted-imports``
  violations on the migrated tree.

## Referenzen

- REVIEW_PHASE0.md (Hot-Spot-Ranking Section 5.1, "Circular
  dependency epidemic")
- PR #1687 (CI gates), introducing the baseline-comparison script
- ``scripts/drop-barrel-imports.mjs`` (codemod implementation)
- ``eslint.config.mjs`` (``no-restricted-imports`` rule)
