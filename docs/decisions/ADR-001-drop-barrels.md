# ADR-001: No barrel files, direct imports

## Status
Accepted

## Date
2026-05-13

## Context

A cycle survey counted 227 circular import chains in `src/`. Nearly every one
ran through one of the eleven `index.ts` barrels (`Helper/index.ts`,
`Module/index.ts`, `Utils/index.ts` ...):

```
Helper/BDSMHelper.ts
  -> Helper/ConfigHelper.ts
  -> Utils/index.ts        (barrel re-exports HHPopup, Utils, ...)
  -> Utils/HHPopup.ts
  -> Utils/Utils.ts
  -> Helper/index.ts       (barrel re-exports BDSMHelper)
  -> back to Helper/BDSMHelper.ts
```

The cause is `export *`: it pulls every neighbouring file into the import
graph of every consumer that imports anything from the folder. Barrels thereby
couple the whole module surface, weaken tree shaking, and hide which file owns
a symbol.

Cycles are not cosmetic in this project: if a module inside a cycle is reached
early, before `config/HHStoredVars` has finished initialising, it throws a TDZ
ReferenceError and the whole userscript fails to start (lesson
`zirkulaerer-import-tdz-crash`).

## Decision

Delete all `index.ts` barrels under `src/`, point every import at the file
that declares the symbol, and forbid the return with ESLint
(`no-restricted-imports`, group `*/index` plus the folder paths). A one-off
ts-morph codemod did the rewriting; it left the tree again once done.

## Rejected alternatives

**A one-way barrel hierarchy** (keep barrels, but import in one direction
only): solves the cycles only as long as everyone honours the direction, and
no import line shows whether it was honoured.

**Do nothing, freeze the baseline:** no refactoring risk, but `export *` keeps
standing between tree shaking and readability, and `LanguageHelper.ts` would
still depend on the export order of `i18n/index.ts` to have the translation
tables filled as a side effect.

## Consequences

- Every import line names the file that declares the symbol.
- `LanguageHelper.ts` loads its language files explicitly; the load order is
  readable instead of conventional.
- The ESLint rule prevents new barrels, in new folders too.
- The cycle count madge reports **rose** from 227 to 544 in the process. That
  is not a regression: the same edges existed before, the barrels merely
  gathered many paths into few chains. The actual reduction is ADR-008.

## References

- ADR-008 (cycle reduction with a baseline)
- `eslint.config.mjs` (`no-restricted-imports`)
