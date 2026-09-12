# ADR-003: A global mutex on state-changing /ajax.php POSTs

## Status

Accepted

## Date

2026-05-20

## Context

Issue #1598 describes 403 Forbidden on Place of Power and other modules, above
all on accounts with large rosters (reporter Franck-75, 2400+ girls). Four fix
iterations are already merged into main (v7.35.22, v7.35.29, v7.35.30,
v7.35.35), the 403 rate drops step by step, but the bug is not gone. Three of
our own fix attempts (v7.35.48, v7.35.49, local) were refuted by sniffer data.

The diagnosis in short:

- Server-side bot detection punishes several overlapping state-changing POSTs
  on `/ajax.php`.
- On small accounts a POST takes <1s; the AutoLoop tick (~1s) rarely catches
  two in one pass.
- On the 2400-girls account a POST takes 5-7s; the AutoLoop tick runs several
  times, and multiple handlers fire parallel POSTs (capture: three
  `closeHomeAds` POSTs in 1.1s).
- The server answers all parallel POSTs with 403; the script does not notice
  and keeps firing requests into a rate-limited server.
- The user reproduces the 403 by hand with a double click (Home, then Home
  again during page load).

The existing protections are not enough:

| Mechanism | What it does | What it does not do |
|---|---|---|
| `navInFlight` (PageNavigationService.ts) | Protects against a second page navigation in the same tick | Does not protect `/ajax.php` POSTs |
| `waitForAjaxIdle` (AjaxTracker.ts) | Waits until no XHR is pending | Does not wait until the server has finished processing (HTTP loadend comes before the DB write) |
| Forbidden backoff (StartService.ts) | Reacts to a `<body>Forbidden</body>` page | Does not react to a `403` status on XHR answers |

Six or more code paths trigger state-changing POSTs without global
coordination:

- `closeHomeAds` (handlePageSpecific)
- `pop_thumb_claim`, `pop_action`, `pop_auto_assign` (PlaceOfPower)
- `troll_battle`, `season_battle`, `pantheon_worship`, `penta_drill_battle`
- `champion_reorder`, `champion_team_build`, BossBang
- `boost_equip`, `harem_pay`

A point fix per module (a PoP-only pause, say) does not cover the pattern. The
next Forbidden wave would hit another path.

## Decision

A global mutex on state-changing `/ajax.php` POSTs in `Service/AjaxTracker.ts`,
plus three accompanying changes.

### Components

1. **Mutex API in AjaxTracker:**
   ```ts
   acquirePostMutex(): boolean    // true if free, false if already held
   releasePostMutex(): void
   isPostInFlight(): boolean
   ```
   Stale-lock release after 30s, in case a holder forgot the release call.

2. **The AjaxTracker hook recognises POSTs to `/ajax.php`** and drives the
   mutex automatically at `send` and `loadend`. That also registers the game's
   own XHRs (which the script does not fire itself) as "in flight" -- but they
   are not blocked. Blocked are only script calls that explicitly call
   `acquirePostMutex` before their trigger.

3. **A helper `awaitServerSettleAfterPost(claimXhrDurationMs)`** in a new
   service file. Pause = `max(2000, claimXhrDurationMs * 4)`. Empirical, from
   Frank's capture: claim XHR 6.7s -> settle 27s. On small accounts 0.3s -> the
   2s minimum cap.

4. **An AutoLoop tick mutex** at the start of `autoLoop()`: if
   `isPostInFlight() === true`, take the next tick instead of running the
   action handlers. Prevents a burst of 3-4 handlers in one tick.

5. **XHR 403 detection in AjaxTracker:** on `loadend` with status 403, call
   `ForbiddenBackoff.recordForbidden()` at once and put the master switch into
   backoff mode. Keeps the script from pumping requests into a burning server.

### Required calls in the modules

Modules that trigger a state-changing POST must acquire the mutex before the
trigger:

```ts
if (!ajaxTracker.acquirePostMutex()) {
    // another path holds the mutex, the next tick tries again
    return true; // busy=true, the AutoLoop tick counts as done
}
const claimStart = Date.now();
$(button).trigger('click');
await waitForAjaxIdle(15s, 250ms);
const claimDuration = Date.now() - claimStart;
ajaxTracker.releasePostMutex();
await awaitServerSettleAfterPost(claimDuration);
```

First iteration: PlaceOfPower. Second iteration (separate PR): BossBang,
Champion, Troll, Booster.

## Rejected alternatives

### Alternative 1: a per-module pause after a POST

Every state-changing site gets an `await sleep(2000)` before the next action.

- For: minimally invasive, easy to review.
- Against: the pause value has to be maintained per module, and will drift. It
  does not protect against parallel POSTs from two different modules in the
  same tick (a PoP claim and `closeHomeAds` from handlePageSpecific, say). On
  the 2400-girls account 2s is not enough; the capture shows 27s are needed.
- Rejected: a pattern fix belongs in the architecture, not in single spots.

### Alternative 2: manual tick throttling (raise autoLoopTimeMili)

Set `autoLoopTimeMili` from 1000 to 5000, no code change.

- For: no new code. The user can do it themselves.
- Against: slows small accounts down for nothing and large accounts too little
  (a claim takes 7s, a 5s tick still runs in between). It does not solve the
  problem, only postpones it. Several modules per tick can still fire in
  parallel.
- Rejected: treats the symptom, not the cause.

### Alternative 3: a pause in the PoP module only, no architecture

Build the fix into `PlaceOfPower.collectAndUpdate`, ignore other modules.

- For: a small patch, less review load.
- Against: the capture shows the 403 arises in `closeHomeAds` **before** PoP is
  touched. The next Forbidden wave would come from `handleSeason`,
  `handleTrollBattle` or `handlePoVCollect`, and the reporter would be back in
  the loop.
- Rejected: the pattern is universal, so the fix has to be.

### Alternative 4: move everything to jQuery's `$.ajax` queue

jQuery has a built-in request queue. All script XHRs would go through it.

- For: built in, nothing of our own.
- Against: the game's own JavaScript uses XHRs that do not go through jQuery.
  Those would not respect the mutex. The refactoring effort for all existing
  XHR sites is considerable.
- Rejected: poor effort-to-benefit ratio, and it does not cover the game's own
  XHRs.

## Consequences

### Positive

- One single place (AjaxTracker) manages POST concurrency.
- Works for all existing and new modules without further code changes.
- The server-settle wait makes the script human-shaped: pauses after
  state-changing actions, like a user's click behaviour.
- 403 detection at the XHR level makes the script honestly reactive. No more
  pumping into a burning server.

### Negative / trade-offs

- **Speed on large accounts:** PoP phase 1 takes longer with the settle wait.
  With 5 PoPs and a 27s settle: about 3 minutes more. Acceptable.
- **Speed on small accounts:** the 2s minimum cap after every POST costs about
  10s per phase. With 5 PoPs and a 2s settle: about 10s more, hardly
  noticeable.
- **Architectural complexity:** AjaxTracker turns from a passive counter into
  an active mutex manager. The test surface grows.
- **Stale-mutex risk:** if a holder forgets to call `releasePostMutex`, the
  script blocks for 30s. Mitigation: the stale-lock release.

### Skill requirements

None. It extends the repository's existing TypeScript / JavaScript / Jest set.

## Verification

1. **Unit tests** in `spec/Service/AjaxTracker.spec.ts`:
   - mutex acquire/release round trip.
   - stale detection after 30s.
   - 403 detection calls ForbiddenBackoff.
2. **Capture on Frank's account (sniffer on):**
   - 0 Forbidden across 5+ PoP claims in one phase.
   - the XHR sequence shows **no** overlap of POST starts.
   - after a claim, 25-30s pauses appear before the next action (log:
     `awaitServerSettle`).
3. **Small-account test (not the 2400-girls account):**
   - script speed not noticeably worse.
   - cap pauses <= 2s per POST.
4. **Other module paths:** once the first branch (PoP) is clean, a second
   branch for Champion / BossBang / Troll. A capture after each branch.

## Risks

| Risk | Mitigation |
|---|---|
| The mutex is too aggressive and blocks legitimate concurrency | stale-lock release, logging, module migration step by step |
| A 27s settle wait feels slow to the user | an indicator in the sniffer/inspector that the script is settling |
| The game's own JavaScript reacts to the mutex (through changed XHR timing) | game XHRs are registered, never blocked |
| The settle factor (4) is too low | readjust it from a second capture |
| 403 detection fires on normal user pauses | detection only on XHR status 403, not on a page-load 403 (the existing path) |

## References

- Issue: https://github.com/OldRon1977/HHauto/issues/1598
- Sniffer tool: `bonus-scripts/HHAuto_network_sniffer.user.js` (originally
  PR #1712 for issue #1598, generalised in PR #1721)
- Related files:
  - `src/Service/AjaxTracker.ts`
  - `src/Service/PageNavigationService.ts`
  - `src/Service/ForbiddenBackoff.ts`
  - `src/Service/StartService.ts`
  - `src/Module/PlaceOfPower.ts`
