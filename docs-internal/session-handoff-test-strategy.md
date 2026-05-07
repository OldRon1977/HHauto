# Session handoff -- HHAuto test strategy

Status: 2026-05-07. The previous session analysed the test inventory, ran a
review with sub-agents, and produced the plan. The plan file lives at
`docs-internal/test-strategy.md` and is the source of truth.

## Prompt for a new session (copy and paste)

```
We are continuing the HHAuto test strategy. Preparation from the previous
session is finished, the plan is at `docs-internal/test-strategy.md`.

== Language and style ==
German output, terse, no filler. Direct and factual responses.
Workspace rules apply (Git identity oldron1977@gmail.com, workflow,
agent anonymity, file writes via Python+UTF8 only -- see workspace rule
05_File_Write_Workaround).

Repository content (commits, PR/issue text, code comments) is in English.

== Path ==
c:\\Users\\StephanMesser\\.kiro\\Arbeitsplatz\\HHAuto

== First action ==
1. Read `docs-internal/test-strategy.md`. The status block on top tells
   you where we are.
2. Check whether questions A, B, C in the \"Open questions\" section have
   been answered. If any field is empty: ask the user, update the plan,
   only then start stage 0.
3. If everything is answered: continue with the next unchecked task.

== Pending answers (user must answer if still open) ==

A) Inventory the xit tests? Effort 5 min, no code change.
   Answer: \"Inventory\" or \"Skip\"

B) Inventory the tests hidden by fdescribe in Champion.spec.ts?
   Effort 2 min, no code change.
   Answer: \"Inventory\" or \"Skip\"

C) Subjective findings 3, 4, 5 -- for each:
   - C-3 Pachinko string-mapping tests: a drop / b keep / c defer
   - C-4 Pipeline.config value asserts: a values out + schema stays /
         b keep all / c defer
   - C-5 League jest.spyOn on static methods: a drop /
         b keep until stage 1 replaces them / c rewrite immediately

   Default recommendation from the review: C-3a, C-4a, C-5b.

== Workflow per task ==
1. Branch (`chore/test-hygiene`, `refactor/pure-functions-<module>`,
   `feat/test-fixtures-<module>` etc.)
2. Implement
3. `npm test` and where appropriate `npm run build` locally
4. Commit (no AI mention, no Co-Authored-By)
5. Push
6. Wait for user approval
7. Open PR, merge with `gh pr merge --rebase --delete-branch`
8. Tick the checkbox in `docs-internal/test-strategy.md`,
   update the status block, append to the change log

== Important ==
- Do NOT auto-add tests without a plan reference.
- For every finding provide evidence (file + line) before patching.
- When in doubt: ask the user, do not guess.
- The plan file is the single source of truth. Update its status there.

== Data ==
- `INPUT/hhauto_dump_*.json` (41 MB, 2026-05-05, 30 pages)
- `INPUT/HH_DebugLog_*.log` (3 files, ~10h old)
- Inspector script if a fresh dump is needed:
  `bonus-scripts/HHAuto_debug_inspector.user.js` v4.5.0
```

## What this session produced

- Test inventory analysed: 39 specs, 556 tests, coverage 30/17/24%.
- Review with 6 sub-agents (3 pro / 3 contra).
- Roadmap with 5 stages (0-4); blocked: snapshots, Stryker,
  fast-check as a phase, coverage gate, full dump split.
- 8 findings documented with evidence (Champion.spec.ts fdescribe is the
  most severe).
- Plan file `docs-internal/test-strategy.md` created with tasks,
  checkboxes, open questions, xit inventory table, fdescribe inventory
  table.

## Open before stage 0

1. Question A: inventory xit yes/no
2. Question B: inventory fdescribe-hidden tests yes/no
3. Question C: 3 sub-decisions on Pachinko / Pipeline.config / League

Stage 0 cannot start until these are answered.
