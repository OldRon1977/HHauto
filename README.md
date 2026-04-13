# HHauto

[English](https://github.com/Roukys/HHauto/wiki/English)

[Español](https://github.com/Roukys/HHauto/wiki/Espa%C3%B1ol)

[Français](https://github.com/Roukys/HHauto/wiki/Fran%C3%A7ais)

## Installation instructions

a) Install browser addon TamperMonkey, Greasemonkey or Violentmonkey
b) Click the script URL: https://github.com/Roukys/HHauto/raw/main/HHAuto.user.js
c) TamperMonkey should automatically prompt you to install/update the script. If it doesn't, open up the TM Dashboard, go to the Utilities tab, scroll down to "Install from URL" and paste the above URL in there.

---

## Latest Updates

### v7.35.2 — Fix auto-equip boosters loop

Fixed a bug where auto-equip boosters could enter an infinite loop navigating to the shop page repeatedly without caching booster inventory data.

### v7.35.1 — New troll "Rex & Kate" added for Trans Pornstar Harem

### v7.35.0 — Optimized Equipment Selection

The **Stuff Team** equipment selection has been improved. After the game's built-in auto-equip runs, the bot now checks each of the 6 equipment slots and replaces items with better alternatives from your inventory.

**How it works:**
- For each slot, the equipped item is compared against all available inventory items
- Items are ranked by their total combined stats — this naturally reflects both item level and rarity (a Level 9 Mythic can beat a Level 10 Legendary)
- If two items have equal stats, the one with more resonance matches wins
- As a final tiebreaker, the item with higher combat stats is preferred

No new settings required — the optimization runs automatically as part of "Give equipment".

---

### v7.34.16 — Configurable Sandalwood Min Shards Threshold

The hardcoded threshold of 10 remaining shards — which prevented Sandalwood from being equipped near the end of girl farming — has been replaced with a user-configurable setting **"SW min shards"** (visible next to the +Girl Skins switch).

| Setting | Default | Purpose |
|---------|---------|---------|
| SW min shards | 0 | Stop equipping Sandalwood when remaining shards fall to this value or below. 0 = no limit, Sandalwood is used until the girl is complete. |

- Default is 0 = Sandalwood is always equipped
- Users who want the old behavior can set it to 10
- Example: setting it to 1 means Sandalwood is equipped until only 1 shard remains
---

### v7.34 — Smarter Team Selection

The **"Current Best"** and **"Possible Best"** buttons on the Edit Team page now use an advanced team selection algorithm. Instead of simply picking the 16 girls with the highest stat totals, the script builds an optimized 7-girl team that considers Tier-3 trait matching, element synergies, leader skill quality, rarity filtering, and blessing-aware stat comparison.

#### The Problem (before v7.34)

The old algorithm ranked every girl individually by their stat sum (carac1 + carac2 + carac3) and showed the top 16. It had no awareness of:
- **Tier-3 trait matching** — girls sharing a trait value within an element pair gain a team-wide percentage bonus
- **Element synergies** — a team of 7 Fire girls gives +70% crit damage, while a mixed team might give a more balanced but weaker overall bonus
- **Leader position** — the girl in slot 1 determines the Tier-5 skill for the entire team (Execute, Stun, Shield, or Reflect), but the old algorithm just placed the highest-stat girl there regardless of element
- **Rarity filtering** — 3-star legendaries and lower rarities were included despite having no realistic chance of being optimal
- **Blessings vs traits** — a girl with a +40% blessing bonus could be excluded in favor of a weaker girl that matched a trait group

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

Each slot is filled by comparing **all** remaining candidates — trait-group girls and non-group girls compete directly. Each candidate is scored by:

- **Stat score** — current blessed stats (Current Best) or projected max stats (Possible Best)
- **Synergy delta** — how much adding this girl's element improves team synergy (5% weight)
- **Tier-3 delta** — the estimated stat-equivalent value of the Tier-3 bonus she would add

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
A: The algorithm optimizes a complete 7-girl team composition. The old algorithm showed 16 individual rankings without team optimization. The 7 girls shown are the optimal team — click "Assign first 7" to use them.

**Q: What if the new algorithm doesn't work on my page?**
A: The algorithm requires `availableGirls` data, which is only present on the Edit Team page. If the data is not available, the script automatically falls back to the previous algorithm.

---

### v7.33.1 — Settings Survey

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

**Note:** Tampermonkey may ask for permission to send data. Temporary or one-time rights are sufficient — no need to grant permanent ones.

---

### v7.33.0 — Sandalwood Proactive Re-equip

A new **Proactive Re-equip** system for the Sandalwood Perfume booster (MB1) that automatically detects when the booster is depleted and re-equips a new one from the market — without waiting for the next scheduled booster check.

#### The Problem (before v7.33.0)

When Sandalwood Perfume expired mid-fight sequence, the script continued fighting without the booster active. This wasted potential shard drops because the game only drops shards when the booster is equipped. Large batch fights (x50/x10) were particularly wasteful — a x50 batch with only 3 doses remaining would consume all doses in the first few fights and run the remaining 47 fights without the booster.

There was also a race condition: the fight logic could proceed before the AJAX response from a batch fight was fully processed, causing dose tracking to be out of sync.

#### How It Works

**1. Dose Tracking**

When Sandalwood is equipped via the market, the script stores the `usages_remaining` value from the server response. After each fight, it tracks how many doses were consumed by analyzing the shard drops:
- Each shard drop costs exactly 1 dose
- An **odd** shard count from a batch fight means Sandalwood definitively expired mid-batch
- An **even** shard count means `shards / 2` doses were consumed (capped at doses available before the fight)

The dose count is stored in sessionStorage and refreshed from the server whenever the market is visited (`collectBoostersFromMarket`).

**2. Proactive Re-equip**

Before each fight, `needSandalWoodEquipped()` checks if the tracked dose count has reached 0. If so, it removes the depleted booster from the internal booster status, which triggers the existing equip logic to visit the market and equip a fresh Sandalwood automatically — no manual intervention needed.

**3. Race-Condition Fix (Flag+Resolver Pattern)**

For batch fights (x50/x10), the script now uses a synchronization mechanism:
- `resetBattleResponseFlag()` is called before clicking the fight button
- `waitForBattleResponse()` pauses until the AJAX response is fully processed (with a 30s timeout)
- This ensures dose tracking is always up-to-date before the next batch decision

#### Debug Logging

This release includes temporary `[SW-DEBUG]` tagged console logging throughout the Sandalwood flow. This logging covers dose tracking, batch-size decisions, re-equip triggers, and AJAX synchronization. It will be removed once the feature has been fully validated in production.

---

### v7.32.3 — Independent Troll Clusters & +Raid Stars Filter

This is a major architectural update that decouples the Troll Battle system into **3 independent clusters**. Previously, all troll-related features (normal trolls, events, raids) were gated behind a single `Auto Troll Battle` switch. Now each cluster operates independently with its own master switch.

#### The Problem (before v7.32.0)

To fight for Mythic Girls in events or raids, you **had** to enable `Auto Troll Battle`. But this also triggered unwanted normal troll fights. There was no way to say "only fight for valuable girls in raids" without also fighting every random troll on the map.

#### The Solution: 3 Independent Clusters

| Cluster | Master Switch | What it controls |
|---|---|---|
| **Auto Troll** | `Auto Troll Battle` | Normal troll fights (selector, threshold, paranoia) |
| **Events** | `+Event` / `+Mythic Event` | Regular and Mythic event fights |
| **Love Raids** | `+Raid` / `+Raid Stars` | Regular and filtered raid fights |

Each cluster works on its own. You can enable `+Mythic Event` and `+Raid Stars` while keeping `Auto Troll Battle` OFF — the script will only fight for event and raid girls, never touching a normal troll.

#### New Feature: +Raid Stars (Grade Filter)

Replaces the initial `+Mythic Raid` toggle (v7.32.0) with a more flexible **grade-based dropdown**:

| Option | Minimum Stars | What gets fought |
|---|---|---|
| Off | — | No independent raid handling |
| ≥3 ★★★ | 3 | Rare, Epic, Legendary, and Mythic girls |
| ≥5 ★★★★★ | 5 | Legendary and Mythic girls |
| 6 ★★★★★★ | 6 | Mythic girls only |

**How it works:**
- Raids where the girl meets or exceeds your selected grade are claimed by `+Raid Stars` and fought **independently** — they bypass the energy threshold, just like Mythic Events
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
- **v7.32.3**: Fixed girl grade detection — now uses `nb_grades` field which returns the correct visible star count (3=rare, 5=legendary, 6=mythic).
- **v7.32.4**: Added reusable `waitForAjaxEnd` function. Fixed reward collection redirect when no rewards found (#1496).
- **v7.32.5**: Added `+Girl Skins` toggle to include skin-only trolls in fight targets. Fixed raid selector reset behavior when user-selected girl is filtered by grade or page reloads.
- **v7.32.5 Fixes**: Fixed raids with disabled source being incorrectly skipped during ongoing events. Fixed `+Raid` energy condition to bypass troll threshold for Cluster 3 raids. Prevented fighting locked trolls and filtered them from the raid selector dropdown.

---

### v7.31.1 — League Optimization, Season Max Tier & Place of Power Fix

**League Power Calculation Optimization**
The league power calculation has been optimized for better performance (#1358). The algorithm now evaluates team strength more efficiently, reducing unnecessary computation during league fights.

**Season: Max Tier Option**
A new **Max Tier** option has been added to the Season module (#1496). This allows you to set the maximum tier for seasonal events. The option is ignored when "Ignore no girl" is checked, giving you full control over which girls to pursue during seasonal events.

**Place of Power: Wait for Start**
The script now correctly waits for a Place of Power event to fully start before navigating to the next page. Previously, the script could navigate away too early, causing missed POP events. Combined with a league fix that ensures proper handling of league state transitions.

---

### v7.30.0 — Auto-Equip Legendary Boosters

A new **Auto-Equip** feature has been added that automatically equips legendary boosters from your inventory when a booster slot is empty or has expired.

**Important: This feature only works with Legendary Boosters (Ginseng, Jujubes, Chlorella, Cordyceps).** It does NOT buy boosters — it only equips what you already have in your inventory.

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
