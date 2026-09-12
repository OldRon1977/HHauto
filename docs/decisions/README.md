# Architecture decisions

A record, numbered by date. Each file holds one decision: what was decided,
why, and what was rejected.

| # | Decision | Date | What you read it for |
| --- | --- | --- | --- |
| [001](ADR-001-drop-barrels.md) | No `index.ts` barrels, direct file imports | 2026-05-13 | the reasoning behind the ESLint rule `no-restricted-imports` (group `*/index`) |
| [002](ADR-002-pipeline-cooldown-persistence.md) | The scheduler's cool-down survives reloads (`Temp_pipelineLastRunAt`) | 2026-05-19 | why `minIntervalMs` goes to sessionStorage instead of memory alone |
| [003](ADR-003-ajax-post-mutex.md) | A global mutex on state-changing `/ajax.php` POSTs | 2026-05-20 | why PlaceOfPower, BossBang and AutoLoop serialise their POSTs (#1598) |
| [004](ADR-004-pipeline-block-architecture.md) | Reload-proof blocks instead of `lastActionPerformed` | 2026-06-12 | the model behind `BlockScheduler`, `BlockTypes`, `BlockRunStore` |
| [005](ADR-005-block-slot-hold-until-home.md) | A block holds the slot until it is idle | 2026-06-13 | why `applySlotHold` keeps a navigating handler |
| [006](ADR-006-nothing-bundled-nothing-split.md) | Neither bundled nor split -- the handlers stay separate | 2026-06-14 | before anyone merges Season + SeasonCollect or splits PoP into multi-step blocks |
| [008](ADR-008-import-cycle-reduction.md) | Cycle reduction against a frozen baseline | 2026-07-05 | why `npm run deps:circular:check` is in CI and what a new cycle costs |
| [009](ADR-009-focused-activity.md) | One activity keeps the pipeline until its work is done | 2026-08-22 | why a block keeps the focus after each fight (#1841) |
| [010](ADR-010-navigation-is-not-a-stop.md) | Navigation does not discard the running run | 2026-08-26 | why switching the auto loop off does not kill the run immediately |
| [011](ADR-011-a-dedicated-account-may-write.md) | A dedicated test account may write | 2026-09-09 | why the rule "writing checks stay manual" now applies only to the maintainer's account |
| [012](ADR-012-one-table-of-unlock-conditions.md) | One table for all unlock conditions | 2026-09-09 | before anyone hand-writes a ninth `isEnabled` condition or proposes a global level gate |

Open beside it: [`docs-internal/exit-condition-concept.md`](../../docs-internal/exit-condition-concept.md)
proposes replacing the weakest part of ADR-009 -- three questions, not decided
yet.

## Conventions

- A number is never reused. New decision, next free number. 007 stayed empty:
  that entry was absorbed into 006.
- The file name carries the number and a short keyword; code comments point at
  the file name, not at the number alone.
- A superseded decision is not deleted. The new ADR that replaces it names it.
