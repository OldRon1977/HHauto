---
last-verified: 2026-09-11
verified-against-version: 8.13.1
status: current
---

# BDSM battle simulator -- technical reference

Battle Damage Simulation Model: a probabilistic battle simulator that predicts
the outcome of league and season fights.
Last full verification: 2026-05-06 against v7.35.21 (line by line against
BDSMHelper.ts, BDSMPlayer.ts, BDSMSimu.ts).

---

## Files

| File | Content |
|-------|--------|
| src/Helper/BDSMHelper.ts | the main class, domination, crit calculation, tier-4/5 skill estimation, battle simulation |
| src/model/BDSMPlayer.ts | the battle player model |
| src/model/BDSMSimu.ts | the simulation result model |

## Callers

| Module | Function | inLeague flag |
|-------|----------|---------------|
| Module/League.ts | getSimPowerOpponent() | true |
| Module/Events/Season.ts | opponent simulation (3 opponents) | false (default) |

The league simulation additionally applies element domination bonuses to ego,
attack and defense. In season mode the bonuses are left out -- the raw stats are
simulated directly.

---

## Data models

### BDSMPlayer

File: src/model/BDSMPlayer.ts. The values passed to the constructor are stored
one to one as fields.

| Field | Type | Source | Description |
|------|-----|--------|--------------|
| hp | number | remaining_ego (times the domination bonus where applicable) | current hit points |
| atk | number | damage (times the domination bonus where applicable) | attack |
| adv_def | number | the opponent's defense (times (1 - defReduce) where applicable) | the other side's defense |
| critchance | number | calculateCritChanceShare + dominationChance + synergyCritChance | crit chance |
| bonuses | any | fightBonues(team) | synergy multipliers {critDamage, critChance, defReduce, healOnHit} |
| tier4 | any | estimateTier4SkillValue | per-round scaling factors {dmg, def} |
| tier5 | any | estimateTier5SkillValue | the leader skill {id, value} |
| name | string | nickname | display name |

Additional runtime fields are initialised in calculateBattleProbabilities:

| Field | Initialisation | Meaning |
|------|-----------------|-----------|
| playerShield | tier5.id == 12 ? tier5.value * hp : 0 | shield value (only for a light/stone leader element) |
| opponentShield | set in opponentTurn (round 1) | the opponent's shield from their tier 5 |
| stunned | tier5.id == 11 ? 2 : 0 (on the other side) | remaining stun rounds |
| alreadyStunned | 0 | not actively used |
| reflect | tier5.id == 13 ? 2 : 0 | remaining reflect rounds |
| critMultiplier | 2 + bonuses.critDamage | crit damage factor |

### BDSMSimu

File: src/model/BDSMSimu.ts. The constructor takes (points, win, loss,
scoreClass); the field expectedValue is initialised to 0 and is currently
**not set** by the simulator -- callers compute it themselves when they need it.

| Field | Type | Description |
|------|-----|--------------|
| points | {[point]: probability} | the distribution of expected league/season points |
| win | number | win probability (0.0 - 1.0) |
| loss | number | loss probability (0.0 - 1.0) |
| scoreClass | string | 'plus' (win > 0.9), 'close' (0.5..0.9), 'minus' (< 0.5) |
| expectedValue | number | default 0; not populated by the simulator |

---

> **A type annotation that does not match:** the constructor in BDSMSimu.ts
> declares points: number[]. What is actually stored is a map object
> {[point: number]: probability: number} (see mergeResult and the leaf nodes
> { points: { [point]: 1 } }). The TypeScript type therefore does not match the
> runtime shape. That has been so since the BDSM simulator was introduced and is
> not a new problem.

## The element system

HHAuto knows **8 elements** (no electric). The domination logic in
BDSMHelper.ELEMENTS works with two separate cycles:

### The egoDamage cycle (5 elements)

On a match: +10% ego AND +10% attack on your own side per opposing element hit.


fire -> nature -> stone -> sun -> water -> fire


| Element | dominates |
|---|---|
| fire | nature |
| nature | stone |
| stone | sun |
| sun | water |
| water | fire |

### The chance cycle (3 elements)

On a match: +20% crit chance on your own side per opposing element hit.


darkness -> light -> psychic -> darkness


| Element | dominates |
|---|---|
| darkness | light |
| light | psychic |
| psychic | darkness |

The second column is the element the bonus works against -- in the code
`BDSMHelper.ELEMENTS[cycle][element]`. Measured 2026-09-11 against
`element_data.domination`/`weakness` of all girls of one account: every element
dominates exactly the one named here, and the code reads it in that direction
(`b.includes(ELEMENTS...[element])` on the opponent's side). Until then the
column was labelled "is beaten by"; the values were right, the label was not.

### Element -> class display name

Measured 2026-09-11 from `element_data.flavor`:

| Element | Class name (UI) |
|---------|--------------------|
| fire | Eccentric |
| water | Sensual |
| nature | Exhibitionist |
| stone | Physical |
| sun | Playful |
| darkness | Dominatrix |
| psychic | Voyeur |
| light | Submissive |

`BlessingService.parseElement` and `TeamModule.CLASS_NAME` carried the last two
rows swapped until 8.13.1; in the simulator itself the name plays no part.

**Easy to confuse:** "class" is ambiguous here. There are two terms:

- **The player class:** Hardcore (1) / Charm (2) / Know-how (3) -- read from
  Hero.infos.class.
- **The girl element class:** Eccentric / Sensual / Exhibitionist / ... -- only
  a UI label for the girl's element.

BDSM domination works on the element level alone, **not** on the player class
level. The bonus calculation in calculateDominationBonuses counts matches
between the player team's elements and the opponent team's elements.

### Stacking

Bonuses stack linearly when several element matches exist. Example: the player
team has 3x fire and the opponent 2x nature -- the bonus is still given only
once per occurrence of the player element:

javascript
a.forEach(element => {  // player element
    if (b.includes(...)) {  // the opponent has the counter
        bonuses[k].ego += 0.1
        bonuses[k].attack += 0.1
    }
})


a.forEach iterates every player element individually, b.includes only checks
existence. **Three fire girls give +10% three times, and one nature girl on the
opponent's side is enough.**

---

## Synergies (fightBonues)

> Note: the method really is called fightBonues in the code (a typo -- bon**ues**
> instead of bon**uses**). When refactoring, correct it everywhere at once.

It reads the synergy multiplier per element from team.synergies:

| Element | Synergy field in BDSM | Battle effect |
|---------|-----------------------|-------------|
| fire | critDamage | raises the crit damage factor |
| stone | critChance | an additive increase of the crit chance |
| sun | defReduce | reduces the opponent's defense (league only) |
| water | healOnHit | healing per damage tick landed (% of the damage) |

Other elements have no directly simulated synergy effect in this engine. Their
team synergies are already worked into the player's raw stats by the game
server and reach the simulation through damage, defense, remaining_ego and
chance.

---

## Stat calculation (getBdsmPlayersData)

### On the player's side


playerCrit = chance
critChance = calculateCritChanceShare(playerCrit, opponentCrit)
           + dominationBonuses.player.chance
           + playerBonuses.critChance

if (inLeague):
    hp  = remaining_ego * (1 + dominationBonuses.player.ego)
    atk = damage        * (1 + dominationBonuses.player.attack)
    adv_def = opponentDef    // unmodified in the player's view
else:
    hp  = remaining_ego
    atk = damage
    adv_def = opponentDef


### On the opponent's side (in the player's view)


if (inLeague):
    opponent.adv_def = playerDef * (1 - opponentBonuses.defReduce)
else:
    opponent.adv_def = playerDef    // unmodified


The asymmetry is intended: the league applies the domination bonus to the
player's ego and attack AND the opponent's defReduce to the player's defense --
the season does not. Both modes do add the domination crit bonuses.

### The crit chance formula

typescript
calculateCritChanceShare(ownHarmony, otherHarmony)
    = 0.3 * ownHarmony / (ownHarmony + otherHarmony)


The theoretical maximum base crit: 30% (with ownHarmony >> otherHarmony).

---

## Tier-4 skills (estimateTier4SkillValue)

Reads team.girls[i].skill_tiers_info[4].skill_points_used, sums all the points
and multiplies by 0.002.

| Skill | Factor per skill_points_used | Application |
|-------|------------------------------|-----------|
| Damage | +0.2% | multiplied **exponentially** with the round number in the damage case: atk * (1 + tier4.dmg)^turns |
| Defense | not implemented | the code initialises def: 0 and adds nothing -- tier-4 defense skills are ignored |

A `calculateTier4SkillValue` function would have read both tier-4 skills (index
9 = dmg, index 10 = def). It was commented out and was deleted on 2026-08-17
(commit `chore: delete commented-out code`); it is preserved in the git
history. Tier-4 defense therefore stays unimplemented.

---

## Tier-5 skills (estimateTier5SkillValue)

Reads skill_tiers_info[5].skill_points_used of the **first girl in the team**
(team.girls[0], the leader). The skill's effect depends on the leader's
element:

| The leader's element | Skill | id | Factor per skill_points_used | Effect |
|---------------------|-------|----|-----------------------------:|--------|
| sun, darkness | Stun | 11 | 7% | the opponent loses rounds (initially 2 rounds) |
| stone, light | Shield | 12 | 8% | % of max HP as a shield (set in round 1) |
| psychic, nature | Reflect | 13 | 20% | % of incoming damage returned (initially 2 rounds) |
| fire, water | Execute | 14 | 8% | the opponent dies at once when their HP share <= the skill value |

The opponent's tier 5 is initialised only in opponentTurn(...turns=1) -- in
round 1 the opponent's shield is set, the stun counter is put on the player,
and so on.

### A stylistic note on the code

In the estimateTier5SkillValue block only the first two branches are chained
with else if, while the reflect and execute branches use if. Functionally
harmless (the element strings cannot overlap), but worth harmonising in a
refactor.

---

## The battle loop (calculateBattleProbabilities)

A complete recursive exploration of every possible course a battle can take.

### Setup

1. critMultiplier = 2 + bonuses.critDamage
2. round hp up (Math.ceil)
3. initialise tier 5 for the player (playerShield, the opponent's stunned,
   reflect)

### The recursion


playerTurn(turns)
  -> playerAttack(baseAtk, turns)  -> opponentTurn(turns) or a win
  -> playerAttack(critAtk, turns)  -> opponentTurn(turns) or a win
  -> mergeResult(weighted by probability)

opponentTurn(turns)
  if turns == 1: initialise the opponent's tier 5
  -> opponentAttack(baseAtk, turns) -> playerTurn(turns+1) or a loss
  -> opponentAttack(critAtk, turns) -> playerTurn(turns+1) or a loss
  -> mergeResult


### The memo in playerTurn

The tree is exponential in the number of exchanges a battle needs. Measured
against the version without the memo, one opponent, synchronous: 12 exchanges
95 ms, 14 -> 502 ms, 16 -> 3.1 s, 18 -> 19.9 s.

playerTurn therefore memoises over the complete state: both ego values, both
shields, both stun and reflect counters, and **turns**. turns belongs in the
key because calculateDmg raises attack and defense to the power of turns -- the
same ego pair one round later is a different state. That is exactly where the
sketch that used to be commented out, `_cache[playerHP][opponentHP]`, failed:
keyed on the ego pair alone, it would have returned foreign results.

With the memo the same battles take 3 to 6 ms and deliver **bit-identical**
values; they visit 507 to 1786 nodes and come nowhere near the budget below.

The memo is only switched on while the damage per turn is constant, that is,
without a tier-4 damage or defense bonus on either side. With such a bonus the
damage differs per turn, the ego values no longer coincide, and the map is pure
overhead -- measured 290.5 ms against 291.7 ms for the same battle.
`_memoEnabled` therefore leaves that case on plain recursion, where the budget
bounds it.

Negative damage no longer occurs: `calculateDmg` clamps at 0. Before that, a
hit below the opponent's defense let `shield - damageAmount` make the shield
*grow*, more strongly in the crit branch, so the states drifted apart and the
memo found nothing in a stalemate. The damage line already clamped at 0
(`Math.max(0, damageAmount - shield)`); what lower bound the game itself sets
for such a hit is not measured. Measured on the stalemate test case: 596 to 619
ms before, 1 ms after.

### The damage formula (calculateDmg)


dmg = atk * (1 + tier4.dmg)^turns - adv_def * (1 + tier4.def)^turns


tier4.def is always 0, so in practice this reduces to:


dmg = atk * (1 + tier4.dmg)^turns - adv_def


Every call creates two branches:

| Branch | Probability | Damage |
|-----|--------------------|---------|
| baseAtk | 1 - critchance | Math.ceil(dmg) |
| critAtk | critchance | Math.ceil(dmg * critMultiplier) |

### Damage application (the order in the code)


1. Stun check: when stunned -> skip the round (counter -1, the opponent is up)
2. Damage = max(0, attack.damageAmount - opponentShield)
   opponentShield -= attack.damageAmount   (clamped >= 0)
3. Execute check (tier 5 #14): opponentHP/maxHP <= skill_value -> opponentHP = 0
4. Reflect (the opponent's tier 5 #13): when opponentReflect > 0 and opponentHP > 0,
   reflect damage = ceil(opponent.tier5.value * attack.damageAmount).
   playerHP -= max(0, reflectDmg - playerShield)
   playerShield -= reflectDmg   (clamped)
   opponentReflect -= 1
5. Heal on hit: playerHP = min(playerMaxHP, playerHP + ceil(healOnHit * dealtDmg))
6. Win/loss check: opponentHP <= 0 -> a win, otherwise opponentTurn


The symmetric variant runs in opponentAttack with the roles swapped.

### The cap and the abort

Two limits, and both deliver a result instead of throwing:

- `maxAllowedTurns = 50` bounds the depth.
- `MAX_SIMULATION_NODES = 200_000` bounds the **work**. Depth alone does not:
  four branches per round means depth 50 is 4^50 nodes.

If either is reached, that branch ends with a half-and-half result
(`win: 0.5, loss: 0.5`) and two point values of 0.5 each, built with the same
formulas as the win and loss leaves. If every branch runs into the limit, the
battle comes out at exactly 50 % -- that is the marker for "undecided". If only
some branches fail to resolve, the results of the others are kept.

The function used to throw at this point. The try/catch in
calculateBattleProbabilities then delivered an empty `{}`, and
`LeagueHelper.getSimPowerOpponent` read `simu.points` on it without checking.
The TypeError landed in `SimPower()`, an async function nobody awaits -- and the
league list stopped filling at the first such opponent. The result now always
carries `points`; the check in the caller stays anyway, because the try/catch
can still deliver `{}` on a different error.

Measured in a league with 122 open opponents, the stored list deleted
beforehand, a visible window with GPU: all 122 recomputed and stored in 5 s, no
opponent skipped, no invalid value in the list. The main thread was blocked 6
times, at most 162 ms, 511 ms in total.

### Aggregation

At the end:


sum = ret.win + ret.loss
ret.win  /= sum
ret.loss /= sum
ret.scoreClass = win > 0.9 ? 'plus' : win < 0.5 ? 'minus' : 'close'


The scoreClass boundaries, inclusive-exclusive:

| win value | scoreClass |
|----------|------------|
| > 0.9 | 'plus' |
| 0.5 .. 0.9 | 'close' |
| < 0.5 | 'minus' |

---

## The point distribution

### A win


point = min(25, 15 + ceil(10 * playerHP / playerMaxHP))


Range: 16 (no HP left) to 25 (full HP). Capped at 25 by Math.min.

### A loss


point = max(3, 3 + ceil(10 * (opponentMaxHP - opponentHP) / opponentMaxHP))


(opponentMaxHP - opponentHP) is the damage dealt to the opponent. Range: 3 (no
damage) to 13 (the opponent nearly dead).

**Measured on a real fight (2026-09-11, test account):** HHauto simulated 127
league opponents in 5 s; for the chosen opponent `win` 1.0, `scoreClass`
`plus`, a distribution of 17 to 24 points, expected value 22.1. A single fight
against them brought **+22** league points (1309 -> 1331), and the answer names
the same number (`rewards.heroChangesUpdate.league_points`). Recomputed from
the `rounds` of the answer: 8 opposing hits, 2 of them critical; remaining ego
to starting ego 0.642, so 15 + ceil(6.42) = 22 -- the win formula above hits the
game's value. One fight is not a rate; a loss is not measured.

### Aggregation

Every leaf evaluation tracks points: {[point]: 1} and is merged through
mergeResult, weighted by probability, into one point distribution. Callers
compute the expected value themselves:

typescript
expectedValue = Σ(point * probability) over points


---

## Helper functions

### getSkillPercentage(team, id)

typescript
return 1 + (team.girls.map(e => e.skills[id]?.skill.percentage_value ?? 0)
                       .reduce((a, b) => a + b, 0) / 100);


Sums the percentage_value field of all team.girls[*].skills[id] and returns
1 + (sum / 100). Callers use it as a multiplier (for the getSimPowerOpponent
power bonuses, say).

---

## Known limits / design decisions

1. **Full branch exploration instead of Monte Carlo.** The simulator visits
   every possible crit/non-crit path and weights it -- exact, but exponential in
   the number of rounds as long as the memo does not apply. Where the budget
   cuts in, the value is an approximation: measured on a 16-round battle
   without the memo, 51.7 % against an exact 61.3 %.
2. **The memo only with constant damage.** playerTurn memoises over the full
   state including turns. With a tier-4 bonus the run falls back to plain
   recursion; there the node budget bounds it, and the value becomes an
   approximation.
3. **Tier-4 defense ignored.** The def factor is never populated
   (estimateTier4SkillValue sets def: 0). Tier-4 defense skills have no effect
   on the simulation.
4. **Estimated skills instead of the API.** Because exact skill values are not
   reliably delivered by the game API, fixed factors per skill_points_used are
   used (tier 4: 0.002; tier 5: 0.07/0.08/0.2/0.08 per element family).
5. **The league/season asymmetry.** The league applies element domination to
   ego, attack and defense, the season does not. The domination crit bonus
   applies in both modes.
6. **The fightBonues typo.** The method name is entrenched in the code. Refactor
   everywhere at once, or not at all.
7. **else if vs. if in estimateTier5SkillValue.** The last two branches
   (reflect, execute) are written as if instead of else if. Functionally
   harmless, stylistically inconsistent.
8. **expectedValue is not set by the simulator.** Callers compute the expected
   value themselves from points.
