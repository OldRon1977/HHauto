# HHAuto Code Review - Phase 0 Inventory

Status: 2026-05-13. Branch `chore/dev-tooling-setup`. Snapshot of the
HHAuto repository state before the multi-phase code review begins.
This file is the baseline; subsequent phases reference it.

## 1. Repository Size

- 144 TypeScript source files in `src/`.
- 56 Jest spec files in `spec/`.
- 1.4 MiB built userscript bundle (`HHAuto.user.js`).

| Folder       | Files | LoC    |
| ------------ | ----- | ------ |
| Module       | 54    | 15,875 |
| Service      | 23    | 6,243  |
| config       | 14    | 4,012  |
| Helper       | 17    | 3,567  |
| i18n         | 6     | 705    |
| model        | 24    | 702    |
| Utils        | 5     | 558    |
| index.ts     | 1     | 85     |

Top-15 largest source files:

| LoC   | File                                    |
| ----- | --------------------------------------- |
| 2,551 | src/config/HHStoredVars.ts              |
| 1,066 | src/Module/harem/HaremGirl.ts           |
| 1,010 | src/Helper/HHMenuHelper.ts              |
|   990 | src/Service/AutoLoopActions.ts          |
|   915 | src/Module/League.ts                    |
|   900 | src/Module/Troll.ts                     |
|   893 | src/Module/TeamModule.ts                |
|   824 | src/Module/Booster.ts                   |
|   804 | src/Module/Events/EventModule.ts        |
|   758 | src/Module/Shop.ts                      |
|   700 | src/Module/Events/Season.ts             |
|   685 | src/Module/harem/Harem.ts               |
|   600 | src/Module/Champion.ts                  |
|   595 | src/Service/TeamScoringService.ts      |
|   586 | src/Service/TeamBuilderService.ts      |

Files > 500 LoC are review hot-spots: a single PR-sized review
(~300 LoC) cannot cover them, they need to be reviewed in slices.

## 2. Quality Gate Baselines

### Tests

- 56 suites / 807 specs / all passing.
- Total Coverage: **31.31% statements, 20.43% branches, 27.83%
  functions, 31.63% lines**. The branches number is the
  most worrying metric (every conditional that is not exercised is a
  potential bug-incubator).

Files below 30% statement coverage and above 200 statements (high
size, low coverage = highest review priority):

| Coverage | Statements | File                              |
| -------- | ---------- | --------------------------------- |
| 4.65%    | 601        | Module/harem/HaremGirl.ts         |
| 25.48%   | 467        | Module/Troll.ts                   |
| 8.47%    | 460        | Module/League.ts                  |
| 3.28%    | 456        | Module/TeamModule.ts              |
| 1.83%    | 382        | Module/harem/Harem.ts             |
| 24.20%   | 376        | Module/Events/EventModule.ts      |
| 8.51%    | 364        | Module/Champion.ts                |
| 1.66%    | 361        | Module/Shop.ts                    |
| 12.05%   | 340        | Service/AutoLoopActions.ts        |
| 27.32%   | 333        | Module/Events/Season.ts           |
| 2.64%    | 265        | Module/PlaceOfPower.ts            |
| 9.81%    | 265        | Service/StartService.ts           |
| 21.70%   | 258        | Helper/RewardHelper.ts            |
| 4.60%    | 239        | Module/Events/Seasonal.ts         |
| 8.97%    | 234        | Module/Pachinko.ts                |
| 13.63%   | 220        | Module/Labyrinth.ts               |
| 13.63%   | 198        | Helper/HHMenuHelper.ts            |
| 11.34%   | 194        | Service/PageNavigationService.ts  |
| 10.81%   | 185        | Module/PentaDrill.ts              |
| 7.06%    | 184        | Module/Events/LoveRaidManager.ts  |

### Lint

- ESLint flat-config baseline: **72 errors, 857 warnings, 1058 total
  problems** (`npm run lint`).
- 376 warnings auto-fixable via `eslint --fix`.
- Errors are mostly real bugs (`no-undef`, `no-unreachable`,
  `no-redeclare`); warnings are unused vars and `eqeqeq`.

### TypeScript

- Default `tsc --noEmit` (current tsconfig): **clean** after enabling
  `skipLibCheck`.
- Strict `tsc --noEmit -p tsconfig.strict.json`: **2192 errors**. This
  is the upper bound. `strictNullChecks` and `noImplicitAny` are the
  loudest. Roadmap: enable strict flags one at a time, file by file.

### Dependency Hygiene

- **227 circular import chains** detected by madge. Primary cause:
  barrel `index.ts` files that re-export everything in their folder,
  pulling sibling modules into each other transitively. This is the
  single biggest architectural finding.
- Knip: 22 unused exports + 9 unused exported types.
- depcheck: 4 unused devDependencies (`@jest/globals`,
  `@types/tampermonkey`, `jest-environment-jsdom`, `webpack-cli`).
  Two of these (`jest-environment-jsdom`, `webpack-cli`) are likely
  false positives - they are runtime tools without import statements.
  `@jest/globals` and `@types/tampermonkey` need verification.

### Bundle

- 1.4 MiB minified output. `bundle:analyze` script available; deeper
  analysis deferred to phase 5.

### Code Duplication

- jscpd: **12 clones / 0.69% duplicated lines**. Below industry
  average. Not a priority.

### Security Audit

- `npm audit`: **34 vulnerabilities** (5 critical, 12 high, 8
  moderate, 9 low).
- ALL findings are in devDependencies - none ship with the userscript
  bundle. Most cluster around the `karma` test stack
  (engine.io, socket.io, browserify-sign, elliptic), which appears
  unused (see depcheck) but is still in `devDependencies`.
- Recommendation: drop the karma stack in phase 5 cleanup; that
  removes 20+ of the 34 vulnerabilities at once.

## 3. Risk Marker Heat-Map

Counts across `src/`:

| Marker                | Count |
| --------------------- | ----- |
| `unsafeWindow`        | 76    |
| `location.reload(`    | 17    |
| `location.href`       | 12    |
| `setTimeout(`         | 122   |
| `setInterval(`        | 0     |
| `GM_*` globals        | 125   |
| `as any` casts        | 45    |
| `@ts-ignore`          | 0     |
| `$(...)` jQuery calls | 969   |
| `console.log/warn/error` | 94 |
| TODO/FIXME/HACK       | 35    |

Top risk concentrations:

- **`unsafeWindow` clusters**: Shop (6), HHHelper (5), Contest (5),
  HaremGirl (5), WindowHelper (4). Game-side data crosses the trust
  boundary here. Phase 3 security review focus.
- **`location.reload(`**: StartService (4), PageNavigationService (3),
  League (2), TeamModule (2). Reload-driven state machines are a
  known source of loop bugs (see issue #1672).
- **`as any` clusters**: TeamModule (14), TeamBuilderService (4).
  Same area - the team builder logic has the loosest type discipline.
  Phase 2 priority.
- **jQuery selector density**: League (94), Shop (72), Champion (55),
  TeamModule (53), EventModule (53). Each `$()` is a coupling point
  to the game's DOM; site updates break these silently. A registry
  / helper layer would reduce blast radius.
- **`setTimeout` clusters**: HaremGirl (16), AutoLoopPageHandlers (14),
  Pachinko (7), TeamModule (7), Champion (6). Race-condition risk;
  phase 3 concurrency review focus.
- **TODO/FIXME**: HHEnvVariables (4), Harem (4), League (3) - 35 in
  total. Walk-through during phase 3 housekeeping.

## 4. Hot-Spot Ranking (Phase 2 Order)

Combined heuristic = LoC * (1 - coverage) * risk-marker-density. The
order below is the recommended phase-2 sequence:

1. **Service/PageNavigationService.ts** - core routing logic, low
   coverage (10.81%), 3x `location.reload`, 3x `location.href`,
   nav mutex; if this is wrong, every module suffers.
2. **Helper/PageHelper.ts** - 35 LoC patch landed in 7.35.36, tests
   thin, sub-tab routing depends on it.
3. **Service/AutoLoop.ts + AutoLoopActions.ts + AutoLoopPageHandlers.ts**
   - the scheduling brain; 990 LoC just in AutoLoopActions, 14
     setTimeout calls in PageHandlers.
4. **Helper/StorageHelper.ts** - state persistence; gate for many
   bug classes (lost state, key collisions).
5. **Module/Quest.ts, Contest.ts, DailyGoals.ts, Champion.ts,
   PlaceOfPower.ts** - the loop-causing modules from issue #1672.
6. **Module/TeamModule.ts + Service/TeamBuilderService.ts +
   TeamScoringService.ts** - largest "as any" cluster, low coverage.
7. **Module/harem/HaremGirl.ts + Harem.ts** - largest setTimeout
   cluster, 1066 LoC, 4.65% coverage. High blast-radius.
8. **Module/Events/* (EventModule, Season, Seasonal, LoveRaidManager,
   PathOfAttraction, ...)** - largest folder, lowest coverage band.
9. **Module/League.ts, Troll.ts, Shop.ts, Pachinko.ts, Labyrinth.ts,
   PentaDrill.ts** - remaining medium-risk modules.
10. **config/HHStoredVars.ts (2551 LoC)** - data definitions, lowest
    risk-per-LoC; review last with focus on consistency, not logic.

## 5. Architectural Findings (Critical, before phase 2)

### 5.1 Circular dependency epidemic

227 cycles. They run almost exclusively through the `index.ts` barrel
files (`Helper/index.ts`, `Module/index.ts`, `Service/index.ts`,
`Utils/index.ts`). Symptom: changing one helper triggers transitive
module rebuilds and complicates testing (Jest cannot easily mock a
module that pulls its own consumers in).

Mitigation paths:
- Replace barrel imports with direct path imports in source.
- Or move barrels to a single direction-tree (Helper imports from
  Utils only, Module imports from Helper+Utils, Service imports from
  all but never the other way).

This is not the kind of work that fits inside a code review, but the
review needs to flag it and treat any new circular dep as a blocker.

### 5.2 Karma stack appears dead

`karma`, `karma-browserify`, `karma-chrome-launcher`, `karma-commonjs`,
`karma-jasmine` are devDependencies, but no `karma.conf.*` and no npm
script invokes them. They drag 20+ of the 34 npm-audit findings into
the dependency tree. Verify and drop in phase 5.

### 5.3 jQuery surface area

969 `$()` calls across 144 files. Site-update fragility is high.
Consider a thin `domQuery.ts` wrapper that centralizes selectors per
game page, so an HTML refresh on the game side is a one-file fix.

## 6. Tooling Setup (this branch)

Installed devDependencies (pinned):
- `eslint@10.3.0`
- `@typescript-eslint/parser@8.59.3`
- `@typescript-eslint/eslint-plugin@8.59.3`
- `globals@17.6.0`
- `madge@8.0.0`
- `knip@6.13.1`
- `depcheck@1.4.7`
- `jscpd@4.1.1`
- `webpack-bundle-analyzer@5.3.0`

New config files:
- `eslint.config.mjs` - flat config, conservative ruleset
- `tsconfig.strict.json` - extends tsconfig with strict flags
- `knip.json` - entry/project/ignore patterns

Modified files:
- `tsconfig.json` - added `skipLibCheck: true` (build-neutral, fixes
  `tsc --noEmit` against `@types/node` lib mismatches)
- `.gitignore` - added `stats.json`
- `package.json` - new scripts:
  - `lint`, `typecheck`, `typecheck:strict`
  - `deps:graph`, `deps:circular`, `deps:dead`, `deps:unused`
  - `dup:check`
  - `bundle:stats`, `bundle:analyze`

Smoke tests on the toolchain - all green:
- `npm run build` - 1.4 MiB userscript, 8.7 s
- `npm test` - 56 suites / 807 passing
- `npm run lint` - runs (1058 findings, baseline)
- `npm run typecheck` - clean
- `npm run typecheck:strict` - 2192 findings (baseline)
- `npm run deps:circular` - 227 cycles (baseline)
- `npm run deps:dead` - 22 unused exports
- `npm run deps:unused` - 4 candidate unused devDeps
- `npm run dup:check` - 12 clones / 0.69%

## 7. Suggested Next Steps

1. Land this branch (`chore/dev-tooling-setup`) so subsequent phases
   have stable baselines and CI hooks. Doku-only Aenderungen am Build,
   keine User-Wirkung -> kein Versions-Bump.
2. **Phase 1 (Quality Gates):** decide on enforcement levels for the
   new gates: which become CI-blocking (test, lint:errors), which stay
   advisory (typecheck:strict, deps:circular).
3. **Phase 2 (Module Reviews):** start at hot-spot #1
   (`PageNavigationService.ts`) and walk down the ranking.

## 8. Re-running Phase 0

To refresh these numbers after major changes:

```powershell
npm test                     # coverage map
npm run lint
npm run typecheck:strict
npm run deps:circular
npm run deps:dead
npm run deps:unused
npm run dup:check
npm audit --json
```

Then update sections 1-3 of this file. The hot-spot ranking
recalibrates only if the LoC or coverage numbers shift materially.
