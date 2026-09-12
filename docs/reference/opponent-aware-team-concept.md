---
title: "Concept: a team built for the opponents that are left"
status: draft for decision
last-verified: 2026-09-12
concerns: "TeamModule (edit-team buttons), LeagueHelper (opponent list), TeamEvaluationService"
---

# Concept: a team built for the opponents that are left

A draft for decision. It proposes a third button next to *Current Best* and
*Best Possible* on the edit-team page, and it carries the measurements that say
what that button would be worth.

The two existing buttons answer one question: which seven girls are strongest.
Neither of them has ever seen an opponent. This one would rank the same
candidate teams by the points they are expected to score against the opponents
this account still has to fight.

## 1. What the two buttons optimise today

`TeamModule.setTopTeam(mode)` builds candidates with `TeamBuilderService` and,
for mode 1, lets the game calculate each candidate's real stats and picks the
one with the highest *effective power*
(`TeamEvaluationService.computeEffectivePower`):

    damage x expectedHit x (1 + sun) x ego x (1 + water)

That is a single number describing a team in isolation. It cannot express that
140 of the remaining fights are against a water theme, or that an opponent with
45,809 defence makes 3 % more damage worth nothing while 50 % more would flip
the fight.

## 2. The objective the third button would use

Not power -- points. The point formulas are measured
(`bdsm-battle-simulator.md`, section "The point distribution"):

    win  = min(25, 15 + ceil(10 * ownEgoLeft / ownEgoMax))
    loss = max(3,   3 + ceil(10 * damageDealt / opponentEgoMax))

A loss is worth 3 to 13 points, a win 16 to 25. Both terms reward the same
thing -- ending the fight with more of your own ego, or taking more of theirs --
so one function covers won and lost fights:

    score(team) = sum over remaining fights of expectedPoints(team, opponent)

Each remaining opponent enters with its **number of open fights** as a weight,
not with weight 1. That is the part the request asks for: opponents already
fought three times contribute nothing, and in the extreme the sum runs over a
single opponent.

## 3. Who counts as a remaining opponent

`LeagueHelper.numberOfFightAvailable` reads `opponent.match_history[<the
opponent's id_fighter>]` and counts the `null` entries. Three slots per
opponent.

Measured on the test account, 2026-09-12, mid league week:

| | |
|---|---|
| opponents in `opponents_list` | 180 |
| rows on the league page | 180 |
| rows carrying a fight link | 153 |
| `can_fight === true` | 153 |
| open fights (sum of `null` slots) | 453 |

The three ways of asking "can I still fight them" agree exactly: 153 opponents
have a fight link *and* open slots, 0 have a link without slots, 0 have slots
without a link. Either signal is a correct filter; `match_history` is the one
that also says *how many* fights are left, which the weighting needs.

## 4. Why the existing cache cannot carry this

`Temp_LeagueOpponentList` exists, and `LeagueHelper._getTempLeagueOpponentList`
expires it after `LeagueListExpirationSecs` (2 minutes). It is the wrong
container for two reasons:

- **It holds the wrong fields.** A stored `LeagueOpponent` is
  `{opponent_id, nickname, power, simuPoints, simu}` -- a simulation result
  against the team that was fielded when the page was read. The new button needs
  the opponent's raw stats, because it scores *different* teams against them.
- **It is only written in one sort mode.** The list is filled inside
  `getLeagueOpponentListData` behind `usePowerCalc`, i.e. only when the user has
  chosen the power-calculation sort order.

So: a separate snapshot, written whenever the league page is read, independent
of the sort mode.

## 5. The snapshot

Everything the scoring needs, per remaining opponent:

| field | source |
|---|---|
| id | `player.id_fighter` |
| damage, defense, remaining_ego, chance | `player.*` |
| theme elements | `player.team.theme_elements[].type` (the type string only) |
| open fights | count of `null` in `match_history[id_fighter]` |

Measured sizes for the 153 remaining opponents of the account above:

| form | bytes |
|---|---|
| `opponents_list` as it stands | 2,863,641 |
| stripped to the fields the scoring reads, all 180 opponents | 865,448 |
| the table above, remaining opponents only | **10,304** (67 per opponent) |

The 865 KB version is still large because every `theme_elements` and
`synergies` entry repeats the full element object, icon URL included. Keeping
only the type strings is what brings it to 10 KB, and 10 KB is a size this
storage can hold -- which matters, because `cleanLogsInStorage` deletes
`Temp_LeagueOpponentList` first when storage runs out.

**Lifetime.** The 2-minute expiry of the existing list exists so that a fight
decision is never made on stale opponent data. The snapshot has a different job:
the edit-team page is reached *after* leaving the league page, so by definition
the data is a few minutes old there, and refusing to work would make the button
useless. Proposed: keep the snapshot for the league week, stamp it with the time
it was read, and show that age on the button's result. A snapshot older than the
current league gets dropped, as the league reset already does for
`Temp_LeagueOpponentList` (`StartService`, `HHStoredVars`).

## 6. What the ranking would decide today

The candidates `TeamBuilderService` already builds differ mainly in how many
girls of one element they stack, i.e. in the team theme. The game calculated
their real stats (`team_calculate_caracs`, 2026-09-12):

| stack | damage | ego | defense |
|---|---|---|---|
| strongest 7 (happens to be water) | 19,879 | 127,004 | 7,295 |
| 3x sun | 19,759 (-0.6 %) | 122,547 (-3.5 %) | 7,255 |
| 3x water | 19,879 (+-0) | 127,004 | 7,295 |
| 3x nature | 19,691 (-0.9 %) | 129,104 (+1.6 %) | 7,211 |

So a theme costs under 1 % of damage. Element domination is worth +10 % on ego
and attack (measured, `bdsm-battle-simulator.md`). The remaining fights are
distributed like this:

| opponent theme | open fights |
|---|---|
| none | 221 |
| water | 125 (+6 as sun+water, +9 as nature+water) |
| nature | 33 |
| sun | 15 |
| psychic | 15 |
| fire | 14 |
| light | 9 |
| darkness / stone | 3 each |

The fielded team is water: it dominates fire (14 fights) and is dominated by sun
(21). A sun team dominates water (140 fights) and is dominated by stone (3).
Scoring both over the 453 remaining fights with the formulas of section 2:

| theme | points | wins | domination for / against |
|---|---|---|---|
| water (fielded) | 5,539 | 172 | 14 / 21 |
| **sun** | **5,603** | **175** | 140 / 3 |
| nature | 5,535 | 172 | 3 / 14 |

A switch to sun is worth **+64 points and 3 wins**, or 1.2 %. That is the
honest size of this button on this account today. It is not nothing, and it is
the number that should get larger late in the week, when the opponents that are
left are the ones that were skipped for being too strong -- which is exactly
what the request wants to test.

## 7. The larger lever sits elsewhere

The same model, run against stat changes instead of themes:

| change | points | wins |
|---|---|---|
| baseline (sun) | 5,603 | 175 |
| +10 % damage | 5,770 (+167) | 181 |
| +10 % ego | 5,669 (+66) | 178 |
| +10 % defence | 5,654 (+51) | 178 |
| +10 % on everything | 5,924 (+321) | 193 |
| double damage | 6,908 (+1,305) | 237 |

And the same 453 fights sorted by the points each one delivers:

| fights taken | points | per fight |
|---|---|---|
| the best 41 (one day of challenges) | 1,025 | 25.0 |
| the best 100 | 2,496 | 25.0 |
| the best 287 | 4,939 | 17.2 |
| all 453 | 5,603 | 12.4 |

Choosing *which* opponent to fight is worth twice as much per fight as any team
change available here. HHauto already sorts by simulated points in the
power-calculation sort mode; the third button does not compete with that, it
adds to it. Whoever expects the button to change the ranking of the week will be
disappointed; whoever wants the last few percent, and a measurement of when a
theme switch starts to pay, gets it.

## 8. What has to follow a change of theme

Equipment resonance is bound to the team theme
(`equipment-resonance.md`, section 5: team first, items after).
`applyTeamResult` already writes the theme to `TK.teamTheme` for the gear
optimiser. A third mode has to do the same, and the button's own text has to say
that the gear run belongs after it -- as the numbered order of the existing
buttons does (1 Unequip All, 2a/2b pick, 3 Stuff Team).

## 9. What the scoring model does not cover

Stated, because the numbers above were produced with exactly these gaps:

- **Criticals and heal-on-hit.** The league list's `player` object carries
  `id_fighter, remaining_ego, damage, defense, chance, percent_remaining_ego,
  level, class, current_season_mojo` -- no crit damage, no heal. Both exist in
  `player.team.synergies` as `bonus_identifier` with a multiplier, so the
  snapshot can carry them at about 80 more bytes per opponent. The numbers in
  sections 6 and 7 were computed without them: no criticals, no healing, damage
  = attack - defence.
- **Maximum ego.** Only `remaining_ego` is delivered; the model uses it as the
  maximum, as the shipped simulator does.
- **Who strikes first.** Assumed: we do.
- **The equipped mythic booster.** Known gap of the simulator, measured at
  +15 % and not modelled (`bdsm-battle-simulator.md`).

None of these gaps favour one theme over another, so the comparison in section 6
survives them. The absolute point totals do not -- they are a lower bound.

## 10. Open decisions

1. **Button or mode?** `setTopTeam(mode)` takes a `ScoringMode` of 1 or 2 that
   runs through `TeamBuilderService`, `TeamResult` and the info box. The third
   button is not a third way of scoring *girls* -- it re-ranks the candidates
   the existing modes produce. Cleanest is a separate entry point that takes the
   pool (current or possible) as its argument, so both existing pools stay
   reachable, as the request asks.
2. **Which pool does it use?** The request says both, via the two existing
   buttons. That means the third button needs a pool selector, or it runs twice
   and reports both.
3. **What does it do when the snapshot is missing?** Proposed: say so and do
   nothing, rather than silently falling back to *Current Best* -- a button that
   sometimes optimises something else is worse than one that refuses.
4. **Does it field the team, or only report?** For the test the request
   describes, reporting the delta ("sun: +64 points over 453 remaining fights,
   3 more wins") is the more useful half, and fielding is one more click.
