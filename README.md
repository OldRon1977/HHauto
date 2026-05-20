# HHauto

[English](https://github.com/OldRon1977/HHauto/wiki/English)

[Español](https://github.com/OldRon1977/HHauto/wiki/Espa%C3%B1ol)

[Français](https://github.com/OldRon1977/HHauto/wiki/Fran%C3%A7ais)

## Installation instructions

a) Install browser addon TamperMonkey, Greasemonkey or Violentmonkey
b) Click the script URL: https://github.com/OldRon1977/HHauto/raw/main/HHAuto.user.js
c) TamperMonkey should automatically prompt you to install/update the script. If it doesn't, open up the TM Dashboard, go to the Utilities tab, scroll down to "Install from URL" and paste the above URL in there.

---

## How to file a bug with a dump

Bug reports are easier to investigate with a dump of the actual game state.
The repository ships an inspector userscript at
`bonus-scripts/HHAuto_debug_inspector.user.js` that produces such dumps,
including an opt-in **share mode** that anonymises the dump for public use.

1. Install the inspector userscript:
   <https://github.com/OldRon1977/HHauto/raw/main/bonus-scripts/HHAuto_debug_inspector.user.js>
2. Open the page where the bug occurs. Wait for it to load fully.
3. Click the orange **DUMP FOR SHARING** button in the inspector overlay
   (next to `DUMP THIS PAGE` and `AUTO TOUR`). The dump downloads as a
   single JSON file.
4. Attach the JSON file to your GitHub issue.

The share-mode pipeline removes hero nickname, chat_token, club details,
exact XP, browser fingerprint blocks, and most HHAuto settings. Harem
girls, event girls, opponents, and ids are pseudonymised with a fresh
salt per dump, so two dumps from the same player cannot be correlated.

To verify a dump went through the pipeline, look for `meta.pii.mode`
equal to `"share"` and an `audit` block at `meta.pii.layer_counts`.

Full reference: see `docs-internal/inspector-pii-share-mode.md` for the
list of fields kept, dropped, and pseudonymised.

### Network sniffer for "Access forbidden" reports

For the specific case of "Access forbidden" pages (e.g. on accounts with
very large rosters), a dedicated network-capture userscript is shipped
at `bonus-scripts/HHAuto_issue_1598_network_sniffer.user.js`. It hooks
every request channel a userscript can reach (XHR, fetch, sendBeacon,
WebSocket, EventSource, plus PerformanceObserver as a catch-all) and
shows a small live counter overlay in the top-right corner.

1. Install the sniffer userscript:
   <https://github.com/OldRon1977/HHauto/raw/main/bonus-scripts/HHAuto_issue_1598_network_sniffer.user.js>
2. Disable the main HHAuto userscript so it does not interfere with the
   capture (Tampermonkey dashboard or master switch off).
3. Reload the page where the Forbidden happens. Reproduce the click
   sequence that triggers it.
4. Open DevTools console and run `__x1598.stats()` for a summary,
   `__x1598.dumpAll()` for the full event table, or click the **CSV** /
   **JSON** buttons in the overlay to copy a dump to the clipboard.
5. Attach the dump to your GitHub issue. Strip session tokens
   (`sess=...`) before sharing.

---

## Latest Updates

### v7.35.49 - Troll mapping rechecked and fixed

- **Auto Troll mapping rechecked and fixed.** The world-to-troll mapping has been reviewed end to end and aligned with the current in-game adventure layout for world 22 (Arthur, side), world 23 (Venam Kharney, side) and world 24 (Daddy, main). Last quest id raised to the end of world 24.

### v7.35.48 - PoP "Access forbidden" fix during auto-collect

- **Place of Power auto-collect no longer trips into "Access forbidden".** When the script collected several PoP rewards in quick succession, the game's anti-burst protection sometimes blocked the rest of the phase with a Forbidden page. The script now waits for the game to fully finish each claim before moving on, so the auto-collect run completes cleanly.
- **Most visible on large accounts** (2000+ girls), where each game request takes longer and parallel bursts have more time to overlap. Large rosters amplify the problem, but they are not the cause -- the same race could trigger on smaller accounts under unfavourable timing (slow connection, Firefox Private Browsing). Both cases are now covered.
- **Faster reaction on Forbidden.** When the game replies to a request with Forbidden, the script now picks a longer cool-down on the next reload, instead of waiting for an actual Forbidden page to appear.
- The HHAuto menu and the page UI keep updating during the new short waits between claims, so the script stays controllable.
- First applied to Place of Power. Boss Bang, Champion and Troll claim paths follow in a separate update.

### v7.35.47 - League fights continue while troll waits for combativity

- **League runs even when troll energy is empty.** The v7.35.45 fix made everything but two pipeline handlers run during a troll wait, but it kept blocking league as well. League uses a separate energy pool (challenge tokens) that has nothing to do with troll combativity, so blocking it produced the same "league not working" symptom users reported. The wait flag now suppresses only the event-page navigation, which is the actual ping-pong driver.

### v7.35.46 - World 24 Daddy fight typo fix

- **Daddy boss now resolves to the correct troll on world 24.** A typo in the world-to-troll mapping table sent the bot to Arthur (id 20) instead of Daddy (id 22) when fighting on world 24. The mapping is corrected so Auto Troll, the "first/last troll with girl" picker and the troll dropdown resolve world 24 to Daddy again.

### v7.35.45 - Bot keeps moving while waiting for combativity

- **League, Season, Quest, Champion and friends keep running.** When the troll path was waiting for an energy refill (Plus Event / Plus Mythic / Plus Raid Stars / Plus Raid pending with power=0), the bot froze on the troll loop and skipped every other handler. The wait flag now only suppresses the two pipeline navigations that originally caused the ping-pong loop (event page, leagues page) and leaves classic AutoLoop handlers alone.

### v7.35.44 - Path of Valor / Path of Glory toggles stay on

- **PoV and PoG collect settings persist.** Enabling Auto-collect for Path of Valor or Path of Glory no longer flips back off automatically between event waves. The home-page banner check that drove the reset is gone; the collect logic on the actual event page already handles availability on its own.

### v7.35.43 - No more ping-pong loop when combativity is empty

- **Auto Troll waits instead of bouncing.** When a battle path is active (Auto Troll, Plus Event, Plus Mythic, Plus Raid Stars or Plus Raid) and the only thing missing is combativity, the bot now sits on the troll path until energy refills. Before it kept bouncing between event.html and leagues.html every few seconds.
- **League cool-down survives a page reload.** Pipeline cool-downs (60 s for League, etc.) are now persisted; before they were per-tab-session and reset on every navigation, which let League fire repeatedly within seconds.

### v7.35.42 - Daddy boss recognised on world 24

- **Daddy is the correct opponent again.** The bot now picks Daddy on Hentai Heroes world 24 instead of falling back to Dark Lord, Arthur, or Jackson's Crew. The world-to-troll mapping was off by two and dropped into an "unknown troll" branch.
- **First / Last troll with girls now reaches Daddy.** The girls list for Daddy was missing, so the picker stopped at Darth Excitor. Daddy's three reward girls (Viola Physique, Sergent Agatha, Ish) are recognised.
- **Side adventure world 23 maps to Venam Kharney.** Auto Troll selecting Venam now resolves to the right side troll instead of returning the previous boss.

### v7.35.41 - Best of three team candidates

- **Picker compares up to three candidate teams.** Team built from blessing 1 carriers, team built from blessing 2 carriers, and a default team from the full eligible pool are all built in parallel. The candidate with the highest mode-aware caracs_sum across its 7 slots wins. Tie-break order: blessing 1 > blessing 2 > default.
- **Player class no longer biases the leader pick.** The own-class vs cross-class tiebreaker is gone. Leader uses 7 sort keys (Mythic, Tier-5, element-pair match, trait match, blessed, caracs_sum, Element-Coeff).
- **Leader is chosen from the full eligible pool.** A Mythic Shield outside the active blessing pool now wins over a weaker non-Shield Mythic inside it. When no Shield Mythic matches the team trait, a Shield Mythic without trait match still leads ahead of Stun, Execute or Reflect Mythics.
- **Mono-element shortcut removed.** Cluster selection follows the trait hierarchy eyes > hair > zodiac > position uniformly across all pools.
- **Info panel cleaner.** Class line and the redundant "Team Selection Info" header are gone. Pool labels read in plain language ("Best team built from girls carrying blessing 1", "Best team from the full eligible pool", etc).

### v7.35.40 - Best Possible mode now actually uses projected stats

- **Mode 2 sorts by projected stats again.** The Pos 2-7 fill, the leader rule's caracs_sum tiebreaker and the emergency fallback now read from the mode-aware score map (current carac sum in Mode 1, projected to level 750 + max grades in Mode 2) instead of always using raw current stats. Under-developed mythics are picked into the team in Mode 2 where Mode 1 still picks today's strongest girls.
- **No effect when the pool is fully developed.** When all eligible girls are at level 750 with max grades, both modes still produce the same team (same input, same output). The "modes identical" hint stays accurate.

### v7.35.39 - Team builder rewritten around the spec

- **Strict pool layering.** When two blessings are active, the builder tries the bless1+bless2 carriers first. If that pool cannot fill seven slots, it falls through to bless1-only, then to unblessed, then to an emergency fallback. With one active blessing it skips straight to bless1-only. Without active blessings it picks from the eligible pool. No more silent reroutes through legacy trait-cluster heuristics.
- **Spec-driven leader pick.** Position 1 is decided by an eight-key sort: Mythic before Legendary, Tier-5 priority Shield > Stun > Execute > Reflect, element-pair match to the team cluster, trait-value match (still ahead of own-class), blessed before unblessed, own-class before cross-class, then total carac sum, then element strength.
- **Spec-driven Pos 2-7.** Sub-groups are formed using the trait hierarchy eyes > hair > zodiac > position > element > rarity, with a mono-element shortcut when the pool is dominated by one element (stone-bless then keys on zodiac, hair-bless on eye color, etc). Slots 2-7 are filled from the strongest sub-group first, then the next-largest within the same cluster.
- **Fallback.** If the eligible pool drops below seven girls, the builder now ships an unshortened team (sorted by total carac sum) instead of giving up. The remaining slots stay empty.
- **AssignTopTeam button hardened.** The button is rendered before the info panel, in its own try-block, so a render error in the panel never strips the user-facing entry point.
- **Team info panel redesigned.** Shows which pool path was used, the active blessings the picker considered, and the fallback reason when the emergency path fired. EffectivePower, element-synergy multiplier and leader-bonus indicators are gone -- the spec does not score teams that way anymore.
- **Tighter info panel.** Leader sentence reads in plain language ("strongest blessed Mythic with the highest Tier-5 skill available"). The redundant carac-sum sentence under the cluster block is gone.
- **Top excluded only.** The mythic audit shows the three most relevant excluded girls inline instead of a scrollable list. The total counts stay so you can spot when the pool unexpectedly shrinks.

### v7.35.38 - Team builder rebuilt around the active blessings

The team picker now follows the blessings of the week. Same UI, same buttons -- the picks just match what the blessings are pushing. Quick walk-through of how it decides:

1. **Find this week's blessings.** Eye color, hair color, zodiac, favourite position, element, or rarity -- whatever the game has highlighted, the picker spots it from the girl data alone.

2. **Pick the strongest blessing first.** Higher bonus percent wins. If two are tied, the bigger candidate pool wins, with eyes / hair / zodiac / position preferred over element / rarity.

3. **Gather all blessed girls.** They form the team pool. The most common element among them is chosen so the team also stacks element synergy on top of the blessing.

4. **Stack a Tier-3 chain on top.** Inside the pool, girls who also share a secondary trait (for example all stones with the same zodiac) are preferred for the seven slots.

5. **Pool too small?** When fewer than seven blessed girls match, the remaining slots take unblessed girls of the same element so the team still scales with the blessing.

6. **Leader.** A Mythic Shield (light or stone) is preferred. Blessed and own-class girls go first, then the stronger element, then total power. Falls back to Legendary 5-star when no Mythic fits.

7. **No active blessings?** Falls back to the previous trait-based picker so unblessed weeks still produce sensible teams.

### v7.35.36 - Daily-goals/contests and side-quest loops

Two distinct loops on `/activities.html` and `/side-quests.html` are fixed.

- **Activities sub-tab detection no longer flips between tabs.** The four sub-tab branches (Contests, Missions, Daily Goals, PoP) used sequential `if`s without `else`. Stale or transitional `data-tab` markers in the DOM could make a later branch overwrite the correct value derived from the URL, so `?tab=contests` was sometimes reported as `daily_goals`. The block now uses `else if`, and the URL `tab` query param is the authoritative source. The DOM check is only used when `tab` is absent.
- **No more buy-ticket loop on `/side-quests.html`.** When no side quests remained, the script reloaded the same URL. The page id `side-quests` is not registered, so the next AutoLoop pass kept running handlers on the unrecognized page; `handleChampionTicket` would buy a ticket, the nested `buyTicket()` would reload, and the loop burned quest energy on champion tickets. The script now navigates to home instead. The existing 1-week side-quest timer still prevents the path from being re-entered.

### v7.35.35 - Forbidden race fix in PoP, BossBang, Champion

- **PoP claim path now waits up to 15s for the claim POST** before navigating, matching `gotoPage`. The previous 8s cap was too short for slow connections (Firefox Private Browsing has been observed taking 10-12s).
- **Wait result is now respected.** When the AJAX wait times out, the navigation is deferred and AutoLoop retries on the next tick instead of cancelling the open POST.
- **BossBang fight navigation** routed through the same AJAX-idle wait instead of writing `location.href` directly.
- **Champion auto-team-build and reorder reload** routed through the same AJAX-idle wait instead of `location.reload()`.
- **Shared timeout constants** so PageNavigation and individual modules cannot drift apart again.

### v7.35.34 - Trait-match priority and Mode 2 clarity

- **Slot fill prefers Legendary 5* with trait match** over Mythic without trait match in the cluster-first strategy. Empirical: keeping the Tier-3 chain pays off more than forcing Mythic-only fills.
- **Mode 2 info box puts ProjectedSum first.** Mode 2 = "if all girls were fully developed". The ProjectedSum is the relevant number; current MainSum is shown as a secondary line.
- **Mode 2 log line** also puts ProjSum first to match the info-box ordering.
- **Mode 1 unchanged** -- MainSum stays the headline, ProjectedSum is added as informational.

### v7.35.33 - Cross-class pool, blessing-trait priority, leader explanation

- **Cross-class girls now in the pool.** The own-class hard filter is gone; cross-class girls compete on score and synergy. This is a deliberate deviation from the "never build cross-class" advice in the Kinkoid forum's *Your Performance Handbook* and is based on top-50 league analysis.
- **Blessed trait clusters get priority** in the build phase.
- **Leader pick explained.** When position 1 is not a Mythic Shield, the info box and log state which fallback step was taken.
- **Variante C precedence.** Mythic Shield > Mythic Stun > Mythic Execute > Mythic Reflect > Legendary 5*. Within the same tier-5 priority, the higher mainCarac wins.
- **Audit shows cross-class status** instead of silently filtering.

### v7.35.32 - League team builder rebuild

- **EffectivePower formula extended.**
- **Best Possible** now correctly projects every eligible girl to the awakening cap.
- **Pool unchanged** for both modes: Mythic + Legendary 5* of the player's class.
- **Shield-first leader stays absolute.** If the slot fill consumed the only Shield mythic, it is swapped out as leader and the strongest legendary fills the freed slot.
- **Diagnostics in the log:** every team selection now writes a per-slot detail line and a summary with synergy, tier3, leader bonus, and pool snapshot.
- **Audit shows blessings.** The "Excluded mythics" list in the info box now annotates each entry with the active blessing percent.
- **Modes can still produce the same team** when all 7 top picks are at level 750 with max grades; the pool snapshot in the info box shows when that's the case.

### v7.35.31 - Event/league ping-pong loop with stale events

The script could bounce between the leagues page and the current event page every few seconds without making progress when an unfinished event still sat in the list with an expired refresh timestamp.

- **The right event gets refreshed.** The "is a refresh due" check and the actual parse step looked at different events, so a stale entry could keep firing the trigger forever while the script kept reparsing a different, still-fresh event. The parse step now picks the actually stale event, so the timestamp gets written and the trigger stops firing.
- **No more event/league bounce.** Once the stale entry is refreshed the parser stays quiet on its next tick, so the leagues page and the event page no longer alternate while time and energy are spent on navigation only.

### v7.35.30 - "Forbidden" backoff actually escalates now (Private Browsing follow-up)

Follow-up to v7.35.29 based on logs from Firefox Private Browsing where the same Forbidden kept reappearing every minute.

- **Backoff escalates correctly.** Previously the retry counter reset whenever the script briefly recovered between two Forbiddens, so every reload waited only ~60 seconds. The counter now treats Forbiddens within five minutes as the same streak, so the wait actually doubles to two, four, eight, sixteen minutes (cap thirty) until the streak ends.
- **Don't navigate away while AJAX is still busy.** If the in-flight AJAX wait times out, the script no longer changes the page. It releases the navigation lock and tries again on the next loop tick. Cancelling an in-flight game request was the original cause of the Forbidden response in the first place.
- **AJAX wait raised to 15 seconds.** The previous 8s cap was too tight for very slow connections (Firefox Private Browsing has been observed at 10-12s per response).
- **Less log noise.** The "navigation already in flight, ignoring" line is now throttled to at most once every five seconds.

### v7.35.29 - Fewer "Forbidden" errors (Place of Power, slow networks, after hibernation)

Three changes that together address the "Forbidden" reports still seen on top of v7.35.22, especially in Firefox Private Browsing and after the PC was suspended.

- **Place of Power claim:** the script now waits for the claim AJAX to finish before it changes pages. Previously, on slower connections the page change cancelled the open claim request, which the server then answered with Forbidden on the next call.
- **Cold-start delay:** when the script wakes up after a long pause (tab in background, hibernation, slow first paint), the very first navigation is delayed by a few extra seconds. This avoids the first call hitting the server before it has settled.
- **Smarter Forbidden retry:** once Forbidden is detected, each consecutive retry waits longer than the previous one (one minute, two, four, ... up to thirty), with random jitter. The counter resets as soon as the script is back to a healthy state. Manually closing the tab and opening a fresh one always resets it as well.

### v7.35.28 - Penta Drill: delays adjusted further

Delays between Penta Drill actions have been increased again to avoid blank screens caused by clicks landing before the server response.

---

### v7.35.27 - Fix: Bypass reserve now applies to +Raid and +Raid Stars

The Bypass reserve toggle was ignored for +Raid and +Raid Stars fights. Both modes always fought as soon as a raid girl was available, regardless of the energy threshold or the toggle state. The toggle now controls the threshold consistently: when OFF, the troll threshold applies to raid fights too; when ON, raid fights start as soon as energy is above zero.

The +Raid Stars tooltip and the Bypass reserve tooltip were updated to reflect the new behaviour.

### v7.35.26 - Fix: leagues and quest no longer ping-pong

The script no longer ping-pongs between the leagues page and the current quest page. The league module waits for the active task to finish before changing pages, so the loop can no longer form.

---

### v7.35.25 - Mythic coverage, slot order, and richer team info box

Algorithm refinements driven by community feedback.

**Slot order:** Positions 2-7 are now filled before the leader. The leader is picked from whatever is left in the pool, so a strong cluster girl can no longer be consumed by leader selection. Leader hierarchy stays the same: mythic, tier-5 priority Shield > Stun > Execute > Reflect, cluster membership and trait match as tiebreakers.

**Mythic coverage:** The slot fill evaluates two strategies (cluster-priority and mythic-priority) and keeps the variant with the higher Effective Power. Strong cross-cluster mythics now enter the team when including them beats the cluster-only Tier-3 chain. Weak cross-cluster mythics still cannot break a healthy chain. A leader swap step guarantees a mythic leader whenever any mythic exists in the player's class.

**Info box additions:**
- Mythic Audit lists every mythic in the player's class with status (leader, in slots 2-7, or excluded with reason).
- Class line shows the eligible pool size (own-class Mythic + Legendary 5*), the mythic count, and how many cross-class girls were skipped per class. Explains that league math rewards only the main class carac, so cross-class girls cannot win on the metric that counts.
- Main Sum (sum of the main class carac across the 7 picked girls) is shown next to Effective Power, with green/red deltas vs the previous click and vs the other mode.
- Yellow warning when the own-class pool drops below 7 girls (script falls back to the legacy DOM-based team selection without Tier-3 optimization).

**Logging:** The Team v2 log line now starts with the player class, the carac used as main stat (carac1/2/3), and the Main Sum, so the optimization target is directly visible in debug logs.

**Heads-up:** the game UI's Total Power reacts to equipment, the script's Effective Power does not. To compare the two on equal footing, unequip all girls first, then look at both numbers.

### v7.35.24 - Best Possible projects to the awakening cap

Best Possible mode now projects every girl to the level cap of 750 instead of your current player level. The previous behaviour was a leftover from before the awakening system existed and went unnoticed for a long time. Once top girls became awakened beyond the player level, Best Possible silently collapsed to the same picks as Current Best because the projection had no room left to grow. The mode now consistently answers what each girl would be worth at full awakening, independent of your level.

### v7.35.23 - Team leader fix and Best Possible / Current Best clarity

Two related fixes for the team selection.

**Leader pick now respects the tier-5 priority across the whole roster.**
The Shield > Stun > Execute > Reflect order now applies to all your Mythics, not only those whose element matches the chosen cluster. If you own a Shield Mythic and the best cluster is something else (e.g. eye color), the Shield Mythic still goes into slot 1. Slots 2-7 keep filling from the cluster so the Tier-3 trait bonus stays maximised.

The total team power may end up slightly lower than it would be with a higher-stat leader from the cluster. That is intentional: a Shield leader anchors a defensive skill that scales over the entire fight, which is more valuable than the few extra stat points a non-Shield leader would add.

**Info box restructured into two clear blocks.**
"Leader (Position 1)" and "Cluster (Positions 2-7)" are now separate sections, with a note explaining why the leader may be from a different element pair than the rest of the team.

**Best Possible vs Current Best now tells you when both produce the same team.**
If your top 7 girls are already at your level cap with full grades, both buttons mathematically pick the same team. The info box now says so plainly instead of looking like a silent bug.

---

### v7.35.22 - Fix: "Forbidden" errors and event/league loop

Two related fixes that address the wave of "Access forbidden" reports.

**What changed:**
- Page navigation is now serialised. The script no longer fires two page changes within the same tick, which was the actual cause of the Forbidden responses.
- The auto-loop pipeline aborts cleanly as soon as one of its handlers has triggered a navigation, so it doesn't queue up a second one before the first has happened.
- The event parsing handler now respects each event's own refresh window (e.g. Path of Attraction's six-hour refresh). It no longer pulls the script back to the event page on every single tick when there is nothing new to parse, which was producing a ping-pong loop with active leagues.
- The "What's New" popup is deactivated for this version.

---

### v7.35.21 - League team selection rebuilt

The "Current Best" and "Best Possible" buttons now pick teams using a wider community-knowledge base (Kinkoid forum performance and elements topics, HH Wiki, Tom-208 userscript, plus community input).

**Key changes:**
- Selection is driven by your main class stat alone (HC=carac1, Charm=carac2, KH=carac3) instead of the raw stat sum.
- Cross-class girls are filtered out -- they would always lose against own-class top tier in combat.
- Trait clusters are compared by effective power (main_sum * (1 + tier-3 bonus)). The cluster that maximises real combat power wins, not the one with the most matching traits.
- The leader (slot 1) is picked for tier-5 skill priority (Shield > Stun > Execute > Reflect), not for highest stats. A Shield leader anchors a defensive skill the whole team uses.
- The info box now shows readable trait names ("Blue", "Doggy") instead of internal codes ("00F", "2.png"), and tells you which class, which cluster, and which alternative clusters were compared.
- Stats are equipment-free (verified against the game data). The info box reminds you to hit "Stuff Team" after applying.

Two modes: **Current Best** uses today's stats, **Best Possible** projects each girl to your level cap with all grades applied.

---

### v7.35.20 - Team selection rewrite: blessing-aware top-7

The team selection algorithm has been completely rewritten. The previous version tried to find the best "trait group" (eye color, hair color, position, zodiac) and build a team around it. This often selected the wrong girls because it prioritized trait matching over raw power.

**New logic:**

1. Score all Mythic + Legendary (5-star) girls: base stats minus equipment, times blessing multiplier
2. Sort by score descending
3. Take the top 7
4. Tiebreaker at equal stats: prefer girls that form an element cluster (Tier-3 bonus)
5. Leader: highest-score Mythic, preferring the largest element cluster

**What changed:**
- Equipment stats are subtracted before scoring (fair comparison across differently-equipped girls)
- Blessing multiplier is applied from blessing_bonuses.pvp_v3 data on each girl
- No more trait-group matching or element-pair filtering - the 7 strongest girls win regardless of their trait
- Element-cluster optimization only kicks in as tiebreaker when multiple girls have identical scores
- Blessing categories are read from the BlessingService cache (loaded on Home page visit)

---

### v7.35.19 - Repository transfer complete, blessing boost fix

The repository transfer from Roukys/HHauto to OldRon1977/HHauto is complete. The old URL redirects automatically — no action needed. Tampermonkey picks up updates from the new location. Your settings remain untouched.

**Fixes:**
- Team selection: the blessing boost now works correctly. Previously, hex color codes (e.g. "00F") could not match blessing value names (e.g. "golden"), making the boost ineffective. The algorithm now boosts all groups in the blessed category equally.
- Info box: displays hex trait values with a "#" prefix (e.g. "#A55") for clarity when no blessing name is available.

---

### v7.35.18 - Last version before repository transfer

This is the final release before the repository is transferred from `Roukys/HHauto` to `OldRon1977/HHauto`. No functional changes — only the in-app notification has been updated to inform users about the upcoming transfer.

After the transfer, GitHub will redirect all old URLs automatically. Tampermonkey will pick up future updates from the new location. Your settings remain untouched.

---

### v7.35.17 - Multi-team comparison for optimal selection

The team selection algorithm now builds multiple candidate teams (one per trait group) and compares their effective power (total stats multiplied by Tier 3 bonus). The team with the highest effective power wins, regardless of whether it matches the active blessing. The info box now shows the effective power and a comparison of all evaluated trait groups, so you can see exactly why a particular team was chosen - even if it differs from the current blessing.

Additionally fixed: blessing value parsing for "Favorite position" and "Zodiac sign" patterns, and "Best Possible" mode no longer returns lower values than "Current Best" for fully leveled girls.

---

### v7.35.16 - Blessing-aware team selection, Penta Drill fix, auto-buy timer restored

**Team Selection:** The algorithm previously picked girls from random elements regardless of the chosen trait, resulting in teams with no actual Tier 3 bonus. It now correctly fills the team from the matching element pair first. Additionally, the script now automatically loads the active weekly blessings when visiting the Home page and caches them with a 12-hour validity. The team selection uses this data to prefer the blessed trait and value.

**Info Box:** Completely reworked to explain the team choice. Shows the optimized trait with its actual name (e.g. "golden" instead of hex codes), Tier 3 bonus percentage, leader skill, and element distribution using class names (Dominatrix, Submissive, etc.) instead of confusing internal element names (darkness, psychic). Misleading symbols removed. Active blessings are displayed with match status and cache timestamp.

**Equipment on slow connections:** Increased wait times and stability checks when loading inventory items, reducing failures on 4G or other slow connections.

**Penta Drill:** Increased the delay between steps from 2-3 seconds to 4-6 seconds, preventing the blank screen that occurred when the bot clicked before the server responded.

**Auto-buy timer:** The "Hours to buy Event Combs." and "Hours to buy Mythic Combs." timer fields are back. Set a value (e.g. 16) and the script will only buy combat points when the event has fewer than 16 hours remaining and your energy is at 0. Set to 0 for immediate buying when energy is empty. This allows full use of natural regeneration before spending kobans.

**Note:** Visit the Home page at least once after updating so the blessings get loaded into the cache.

---

### v7.35.15 - Troll with girls now falls through to love raids

When `Last troll with girls` or `First troll with girls` was selected and no troll had any girls left, the script would skip fighting entirely and idle in a loop - even when love raids with girls were available. The troll selection now falls through to love raids as a fallback when no troll target is found, so raid girls are still fought as expected.

---

### v7.35.14 - Repository transfer notice

The HHAuto repository will be transferred to a new owner (`OldRon1977/HHauto`) in the coming days. All repository URLs in the script (`@updateURL`, `@downloadURL`, namespace, wiki and issue links) have been switched to the new location ahead of the transfer. A one-time popup informs users about the move; GitHub redirects and Tampermonkey auto-update will handle the rest for users with auto-update enabled.

---

### v7.35.13 - Troll fallback no longer fights unavailable trolls

When "Last troll with girls" or "First troll with girls" was selected and no troll had any girls left to collect, the script would fall back to fighting the first troll in the game - even if that troll had no girls either. This caused an endless loop of pointless fights and could navigate to a troll that was not yet unlocked, showing "This Troll is not available yet!" in the game. The script now correctly stops fighting and waits for Raids or Events when no troll with girls is available. Affects all game variants.

---

### v7.35.12 - "Possible Best" team assignment now works on first click

Clicking "Possible Best" after "Current Best" on the Edit Team page no longer assigns the wrong girls. The correct team is applied on the first attempt.

---

### v7.35.11 - First/Last troll with girls no longer fights trolls without girls

When “Last troll with girls” or “First troll with girls” was selected and the only remaining trolls with girls were beyond the unlocked adventure range, the script would fight the last unlocked troll even though it had no girls left. The script now correctly skips trolls without girls and waits for Raids or Events instead.

---

### v7.35.10 - Equipment optimization: Slot 1 is equipped reliably again

During auto-equip the first equipment slot was often skipped, so the girl ended up wearing a worse item than the one the script had picked. The other slots were updated normally. The first slot is now equipped correctly on every run.

---

### v7.35.9 - Assign first 7 now applies the full team reliably

When using "Assign first 7" on the team edit page, some girls from the previous team could stay assigned instead of being replaced, leaving the team only partially updated. The new team is now applied correctly on the first click.

---

### v7.35.8 - Buy combativity for +Raid Stars raids

When +Raid Stars was the only active raid mode and energy ran out, the script would not spend kobans to refill - even with enough kobans available above the reserve. Energy is now topped up as expected for +Raid Stars raids as well.

---

### v7.35.7 - League promotion threshold updated to top 20

The game now promotes the top 20 players of a league bracket instead of the top 15. The "Target League" / "Allow win" automation has been updated to match, so the script keeps you in the correct league instead of accidentally promoting or blocking fights based on the old cutoff.

---

### v7.35.6 - Booster auto-equip recovers from external changes

If boosters were changed in another browser or tab while the script was paused, auto-equip could get stuck retrying to equip already-occupied slots or repeatedly reload the Market page. The script now recognizes the out-of-sync state, refreshes the booster info from the Market and resumes normal operation.

---

### v7.35.5 - Simpler buy-combat and refined +Raid Stars

**Buy combat controls simplified:**
- Energy is now topped up immediately when empty and the event / mythic / raid girl has not been won yet - no more "last X hours" timing window
- The "Hours to buy Combats" and "Hours to buy Mythic Combats" inputs are removed from the menu
- The amount of energy purchased still comes from the existing "Troll auto buy", "Mythic auto buy" and "Raid auto buy" fields - change those if you want a different batch size

**+Raid Stars refined:**
- New options: Off, =3 ★★★ (exactly 3-star), ≥3 ★★★ (3-star and up), =5 ★★★★★ (exactly 5-star)
- The unused 6-star option has been removed, as no mythic raids exist in-game
- +Raid Stars now picks the first ending raid matching the selected grade on its own, independently from the "Raid selector" dropdown
- Existing settings are migrated automatically - no manual reconfiguration needed

---

### v7.35.4 - Troll menu: Event section separator and restored buy-combat controls

The Event section of the Troll Battle menu is now visually separated like Mythic and Raid, and the Buy Combat controls for Event are visible again.

**What changed:**
- Separator line added above the +Event row, matching Mythic and Raid styling
- "Buy comb. for events" switch and timer input are visible next to +Event again
- The generic "Enable" switch has been renamed to "Standard Troll on/off" to clarify it only controls the standard troll

---

### v7.35.3 - Full-inventory scan for equipment optimization

Follow-up to v7.35.0. The previous version only considered the first ~100 items visible in the inventory panel, which meant better items further down the list were ignored. v7.35.3 now forces the inventory to load all items before scoring, so the optimal item for each slot is found even with very large inventories.

**What changed:**
- The script now scrolls the inventory panel to load every item before evaluating options
- After selecting the best item, the explicit Equip button is clicked to confirm the change
- No new settings - runs automatically as part of "Give equipment"

---

### v7.35.2 - Fix auto-equip boosters loop

Fixed a bug where auto-equip boosters could enter an infinite loop navigating to the shop page repeatedly without caching booster inventory data.

### v7.35.1 - New troll "Rex & Kate" added for Trans Pornstar Harem

### v7.35.0 - Optimized Equipment Selection

The **Stuff Team** equipment selection has been improved. After the game's built-in auto-equip runs, the bot now checks each of the 6 equipment slots and replaces items with better alternatives from your inventory.

**How it works:**
- For each slot, the equipped item is compared against all available inventory items
- Items are ranked by their total combined stats - this naturally reflects both item level and rarity (a Level 9 Mythic can beat a Level 10 Legendary)
- If two items have equal stats, the one with more resonance matches wins
- As a final tiebreaker, the item with higher combat stats is preferred

No new settings required - the optimization runs automatically as part of "Give equipment".

---

### v7.34.16 - Configurable Sandalwood Min Shards Threshold

The hardcoded threshold of 10 remaining shards - which prevented Sandalwood from being equipped near the end of girl farming - has been replaced with a user-configurable setting **"SW min shards"** (visible next to the +Girl Skins switch).

| Setting | Default | Purpose |
|---------|---------|---------|
| SW min shards | 0 | Stop equipping Sandalwood when remaining shards fall to this value or below. 0 = no limit, Sandalwood is used until the girl is complete. |

- Default is 0 = Sandalwood is always equipped
- Users who want the old behavior can set it to 10
- Example: setting it to 1 means Sandalwood is equipped until only 1 shard remains
---

### v7.34 - Smarter Team Selection

The **"Current Best"** and **"Possible Best"** buttons on the Edit Team page now use an advanced team selection algorithm. Instead of simply picking the 16 girls with the highest stat totals, the script builds an optimized 7-girl team that considers Tier-3 trait matching, element synergies, leader skill quality, rarity filtering, and blessing-aware stat comparison.

#### The Problem (before v7.34)

The old algorithm ranked every girl individually by their stat sum (carac1 + carac2 + carac3) and showed the top 16. It had no awareness of:
- **Tier-3 trait matching** - girls sharing a trait value within an element pair gain a team-wide percentage bonus
- **Element synergies** - a team of 7 Fire girls gives +70% crit damage, while a mixed team might give a more balanced but weaker overall bonus
- **Leader position** - the girl in slot 1 determines the Tier-5 skill for the entire team (Execute, Stun, Shield, or Reflect), but the old algorithm just placed the highest-stat girl there regardless of element
- **Rarity filtering** - 3-star legendaries and lower rarities were included despite having no realistic chance of being optimal
- **Blessings vs traits** - a girl with a +40% blessing bonus could be excluded in favor of a weaker girl that matched a trait group

#### How the Algorithm Works

**1. Rarity Filter (both modes)**

Only girls with meaningful stat potential are considered:
- **Mythic** (6 stars max): always included
- **Legendary** (5 stars max): included
- **Legendary** (3 stars max): excluded
- **All other rarities**: excluded

**2. Leader Selection (Mythic only)**

The algorithm selects the best Mythic leader based on Tier-5 skill priority:

| Leader Element | Tier-5 Skill | Priority |
|---|---|---|
| Light / Stone | **Shield** (% of max HP as shield) | Highest |
| Sun / Darkness | **Stun** (enemy loses turns) | High |
| Fire / Water | **Execute** (instant kill below HP threshold) | Medium |
| Psychic / Nature | **Reflect** (returns % damage) | Low |

Among same-priority leaders, the algorithm prefers those matching the team's trait group, then highest stats.

**3. Tier-3 Trait Matching**

Elements are paired, and each pair shares a trait category. Girls within a pair that share the same trait value gain a bonus:

| Element Pair | Trait Category |
|---|---|
| Darkness + Fire | Eye Color |
| Light + Nature | Hair Color |
| Stone + Psychic | Zodiac |
| Water + Sun | Position |

Bonus per matching teammate: **1.0%** (Mythic) / **0.8%** (Legendary). With a full team of 7 matching girls, the bonus can reach up to ~7%.

**4. Smart Slot-Fill (Slots 2–7)**

Each slot is filled by comparing **all** remaining candidates - trait-group girls and non-group girls compete directly. Each candidate is scored by:

- **Stat score** - current blessed stats (Current Best) or projected max stats (Possible Best)
- **Synergy delta** - how much adding this girl's element improves team synergy (5% weight)
- **Tier-3 delta** - the estimated stat-equivalent value of the Tier-3 bonus she would add

This means a girl with a +40% blessing bonus will be selected over a weaker trait-group member when the tier-3 bonus doesn't compensate for the stat gap. But trait-group girls still win when the bonus outweighs the difference.

Element bonuses per girl in the team:

| Element | Bonus per Girl | Effect |
|---|---|---|
| Fire (Eccentric) | **+10%** | Critical Hit Damage |
| Water (Sensual) | +3% | Heal on Hit |
| Nature (Exhibitionist) | +3% | Ego (HP) |
| Stone (Physical) | +2% | Critical Hit Chance |
| Sun (Playful) | +2% | Reduce Enemy Defense |
| Darkness (Dominatrix) | +2% | Damage |
| Psychic (Submissive) | +2% | Defense |
| Light (Voyeur) | +2% | Harmony |

**5. Two Modes**

| Mode | Score | Use Case |
|---|---|---|
| **Current Best** | Current blessed stats | "What's my strongest team right now?" |
| **Possible Best** | Projected stats at max level + full grades | "Which girls should I invest in?" |

Both modes filter to 5-star Legendary + 6-star Mythic only.

**6. Visual Feedback**

After clicking "Current Best" or "Possible Best", the UI shows:
- Element icons on each team member
- The leader's Tier-5 skill name (e.g. "✨ ★ Shield")
- A synergy info panel with trait match count, Tier-3 bonus %, leader skill, and element distribution

#### FAQ

**Q: Why does my leader have fewer points than girl #2?**
A: The leader determines the Tier-5 skill for the entire team. A Shield leader (Light/Stone) with 29,000 points is stronger than a Reflect leader (Psychic/Nature) with 31,000 points.

**Q: Why is a blessed girl selected over a trait-matching girl?**
A: The algorithm compares the tier-3 bonus value against the stat difference. If a blessed girl has +40% higher stats, the ~2-4% tier-3 bonus from the weaker trait girl doesn't compensate. The blessed girl contributes more to team power.

**Q: Why does the algorithm only show 7 girls instead of 16?**
A: The algorithm optimizes a complete 7-girl team composition. The old algorithm showed 16 individual rankings without team optimization. The 7 girls shown are the optimal team - click "Assign first 7" to use them.

**Q: What if the new algorithm doesn't work on my page?**
A: The algorithm requires `availableGirls` data, which is only present on the Edit Team page. If the data is not available, the script automatically falls back to the previous algorithm.

---

### v7.33.1 - Settings Survey

A voluntary, anonymous **Settings Survey** has been added to help us understand which features are actually used. With 163 configurable settings and no telemetry, this is the only way to identify unused features we can safely simplify or remove.

**How it works:**
- After a version upgrade, a one-time popup asks you to share your settings
- You can also trigger it manually via the **"Settings Survey"** button in the menu
- Two options: **Google Form** (one-click automatic submit) or **Copy to clipboard** (full control)
- "Remind me later" (up to 3 times) or "Don't ask again" to permanently dismiss

**What is collected:**
- Script version and site hostname
- For each setting: `ON`, `OFF`, `DEFAULT`, or `CHANGED`
- **No user IDs, no personal data, no gameplay information**

**Note:** Tampermonkey may ask for permission to send data. Temporary or one-time rights are sufficient - no need to grant permanent ones.

---

### v7.33.0 - Sandalwood Proactive Re-equip

A new **Proactive Re-equip** system for the Sandalwood Perfume booster (MB1) that automatically detects when the booster is depleted and re-equips a new one from the market - without waiting for the next scheduled booster check.

#### The Problem (before v7.33.0)

When Sandalwood Perfume expired mid-fight sequence, the script continued fighting without the booster active. This wasted potential shard drops because the game only drops shards when the booster is equipped. Large batch fights (x50/x10) were particularly wasteful - a x50 batch with only 3 doses remaining would consume all doses in the first few fights and run the remaining 47 fights without the booster.

There was also a race condition: the fight logic could proceed before the AJAX response from a batch fight was fully processed, causing dose tracking to be out of sync.

#### How It Works

**1. Dose Tracking**

When Sandalwood is equipped via the market, the script stores the `usages_remaining` value from the server response. After each fight, it tracks how many doses were consumed by analyzing the shard drops:
- Each shard drop costs exactly 1 dose
- An **odd** shard count from a batch fight means Sandalwood definitively expired mid-batch
- An **even** shard count means `shards / 2` doses were consumed (capped at doses available before the fight)

The dose count is stored in sessionStorage and refreshed from the server whenever the market is visited (`collectBoostersFromMarket`).

**2. Proactive Re-equip**

Before each fight, `needSandalWoodEquipped()` checks if the tracked dose count has reached 0. If so, it removes the depleted booster from the internal booster status, which triggers the existing equip logic to visit the market and equip a fresh Sandalwood automatically - no manual intervention needed.

**3. Race-Condition Fix (Flag+Resolver Pattern)**

For batch fights (x50/x10), the script now uses a synchronization mechanism:
- `resetBattleResponseFlag()` is called before clicking the fight button
- `waitForBattleResponse()` pauses until the AJAX response is fully processed (with a 30s timeout)
- This ensures dose tracking is always up-to-date before the next batch decision

#### Debug Logging

This release includes temporary `[SW-DEBUG]` tagged console logging throughout the Sandalwood flow. This logging covers dose tracking, batch-size decisions, re-equip triggers, and AJAX synchronization. It will be removed once the feature has been fully validated in production.

---

### v7.32.3 - Independent Troll Clusters & +Raid Stars Filter

This is a major architectural update that decouples the Troll Battle system into **3 independent clusters**. Previously, all troll-related features (normal trolls, events, raids) were gated behind a single `Auto Troll Battle` switch. Now each cluster operates independently with its own master switch.

#### The Problem (before v7.32.0)

To fight for Mythic Girls in events or raids, you **had** to enable `Auto Troll Battle`. But this also triggered unwanted normal troll fights. There was no way to say "only fight for valuable girls in raids" without also fighting every random troll on the map.

#### The Solution: 3 Independent Clusters

| Cluster | Master Switch | What it controls |
|---|---|---|
| **Auto Troll** | `Auto Troll Battle` | Normal troll fights (selector, threshold, paranoia) |
| **Events** | `+Event` / `+Mythic Event` | Regular and Mythic event fights |
| **Love Raids** | `+Raid` / `+Raid Stars` | Regular and filtered raid fights |

Each cluster works on its own. You can enable `+Mythic Event` and `+Raid Stars` while keeping `Auto Troll Battle` OFF - the script will only fight for event and raid girls, never touching a normal troll.

#### New Feature: +Raid Stars (Grade Filter)

Replaces the initial `+Mythic Raid` toggle (v7.32.0) with a more flexible **grade-based dropdown**:

| Option | Minimum Stars | What gets fought |
|---|---|---|
| Off | - | No independent raid handling |
| ≥3 ★★★ | 3 | Rare, Epic, Legendary, and Mythic girls |
| ≥5 ★★★★★ | 5 | Legendary and Mythic girls |
| 6 ★★★★★★ | 6 | Mythic girls only |

**How it works:**
- Raids where the girl meets or exceeds your selected grade are claimed by `+Raid Stars` and fought **independently** - they bypass the energy threshold, just like Mythic Events
- Remaining raids (below your grade filter) are handled by `+Raid` if enabled, respecting the normal threshold
- If neither `+Raid` nor `+Raid Stars` is set, no raids are fought
- The girl's star count is read from the game's `nb_grades` field for accurate detection

**Fight Priority Chain:**

```
1. Mythic Event       ← +Mythic Event
2. Filtered Raid      ← +Raid Stars (grade filter)
3. Regular Event      ← +Event
4. Troll 98/99        ← Auto Troll Battle
5. Normal Raid        ← +Raid
6. Custom Troll       ← Auto Troll Battle
7. Fallback Troll     ← Auto Troll Battle
```

Filtered raids (from `+Raid Stars`) take priority over regular events and normal raids, ensuring your most valuable targets are fought first.

#### Example Configuration: "Only Mythic Girls"

| Setting | Value | Effect |
|---|---|---|
| Auto Troll Battle | **OFF** | No normal troll fights |
| +Event | **OFF** | No regular event fights |
| +Mythic Event | **ON** | Fight for Mythic Event girls |
| +Raid | **OFF** | No regular raid fights |
| +Raid Stars | **6 ★★★★★★** | Fight only for Mythic raid girls |
| Sandalwood (Mythic Event) | **ON** | Equip Sandalwood for events |
| Sandalwood (Raid) | **ON** | Equip Sandalwood for raids |
| Buy Combat (Mythic) | **ON** | Buy energy for Mythic events |
| Buy Combat (Raid) | **ON** | Buy energy for raids |

With this setup, the script will **never** fight a normal troll or a low-rarity raid girl. It will only spend energy on Mythic girls in events and raids.

#### Additional Changes in v7.32.x

- **v7.32.1**: Fixed `+Mythic Raid` blocking all subsequent auto-loop handlers when no raid target was found. Added Season Max Tier display. Extended timer handling for Champion, ClubChampion, Labyrinth, PentaDrill, and Pantheon.
- **v7.32.2**: Replaced boolean `+Mythic Raid` toggle with `+Raid Stars` grade dropdown. Added migration from old boolean setting to grade index.
- **v7.32.3**: Fixed girl grade detection - now uses `nb_grades` field which returns the correct visible star count (3=rare, 5=legendary, 6=mythic).
- **v7.32.4**: Added reusable `waitForAjaxEnd` function. Fixed reward collection redirect when no rewards found.
- **v7.32.5**: Added `+Girl Skins` toggle to include skin-only trolls in fight targets. Fixed raid selector reset behavior when user-selected girl is filtered by grade or page reloads.
- **v7.32.5 Fixes**: Fixed raids with disabled source being incorrectly skipped during ongoing events. Fixed `+Raid` energy condition to bypass troll threshold for Cluster 3 raids. Prevented fighting locked trolls and filtered them from the raid selector dropdown.

---

### v7.31.1 - League Optimization, Season Max Tier & Place of Power Fix

**League Power Calculation Optimization**
The league power calculation has been optimized for better performance. The algorithm now evaluates team strength more efficiently, reducing unnecessary computation during league fights.

**Season: Max Tier Option**
A new **Max Tier** option has been added to the Season module. This allows you to set the maximum tier for seasonal events. The option is ignored when "Ignore no girl" is checked, giving you full control over which girls to pursue during seasonal events.

**Place of Power: Wait for Start**
The script now correctly waits for a Place of Power event to fully start before navigating to the next page. Previously, the script could navigate away too early, causing missed POP events. Combined with a league fix that ensures proper handling of league state transitions.

---

### v7.30.0 - Auto-Equip Legendary Boosters

A new **Auto-Equip** feature has been added that automatically equips legendary boosters from your inventory when a booster slot is empty or has expired.

**Important: This feature only works with Legendary Boosters (Ginseng, Jujubes, Chlorella, Cordyceps).** It does NOT buy boosters - it only equips what you already have in your inventory.

**How it works:**
- Enable "Auto-Equip" in the Shop menu section
- Configure which booster to assign to each slot using the "Slot Config" input (e.g. `B1;B1;B2;B4`)
  - B1 = Ginseng Root, B2 = Jujubes, B3 = Chlorella, B4 = Cordyceps
- The script checks your active booster slots and equips missing boosters automatically

**Anti-detection timer:**
After equipping boosters, the script does NOT immediately re-check when they expire. Instead, it waits until the longest active booster expires and then adds a **random delay between 5 minutes and 2 hours** before equipping new ones. This randomized timing is designed to make the automation harder to detect by Kinkoid.

**Tested on:**
- HentaiHeroes
- ComixHarem
- PornstarHarem

Other game variants may work but have not been tested yet. If you encounter issues on other sites, please report them.

**⚠ Use at your own risk.** As with all automation features, there is always a risk of being banned by Kinkoid. The random delay helps reduce detection, but cannot guarantee safety.

[//]: # (formatting-cleanup)
