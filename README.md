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

### v7.34.0 — Smarter Team Selection

The **"Current Best"** and **"Possible Best"** buttons on the Edit Team page now use an improved team selection algorithm. Instead of simply picking the 16 girls with the highest stat totals, the script now builds an optimized 7-girl team that considers element synergies, leader skill quality, and overall team composition.

#### The Problem (before v7.34.0)

The old algorithm ranked every girl individually by their stat sum (carac1 + carac2 + carac3) and showed the top 16. It had no awareness of:
- **Element synergies** — a team of 7 Fire girls gives +70% crit damage, while a mixed team might give a more balanced but weaker overall bonus
- **Leader position** — the girl in slot 1 determines the Tier-5 skill for the entire team (Execute, Stun, Shield, or Reflect), but the old algorithm just placed the highest-stat girl there regardless of element
- **Team composition** — two girls with identical stats but different elements contribute very differently to a team

#### How the New Algorithm Works

**1. Leader Selection (from Top 25)**

The algorithm first looks at the top 25 girls by stats and selects the best leader based on Tier-5 skill priority:

| Leader Element | Tier-5 Skill | Priority |
|---|---|---|
| Fire / Water | **Execute** (instant kill below HP threshold) | Highest |
| Sun / Darkness | **Stun** (enemy loses turns) | High |
| Stone / Light | **Shield** (% of max HP as shield) | Medium |
| Psychic / Nature | **Reflect** (returns % damage) | Low |

This means the leader may have fewer raw stat points than other team members — that is intentional. An Execute skill can end fights that raw stats alone would lose.

**2. Synergy-Aware Team Building (Slots 2–7)**

After selecting the leader, the algorithm fills the remaining 6 slots one by one. For each slot, it picks the girl that maximizes a combined score of:
- **Individual stats** (90–95% of the score)
- **Element synergy bonus** (5–10% of the score) — how much adding this girl's element improves the team's overall bonuses

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

Fire has the highest single-girl impact (+10% vs +2–3%), so the algorithm naturally favors Fire girls when stats are close.

**3. Two Modes**

| Mode | Filter | Score | Use Case |
|---|---|---|---|
| **Current Best** | Mythic + Legendary only | Current blessed stats | "What's my strongest team right now?" |
| **Possible Best** | All girls (including Level 1) | Projected stats at max level + full grades | "Which girls should I invest in?" |

In "Possible Best" mode, a Level 1 Mythic with 6 stars can outrank a fully maxed Epic because its stat ceiling is much higher.

**4. Visual Feedback**

After clicking "Current Best" or "Possible Best", the UI now shows:
- Element icons on each team member
- The leader's Tier-5 skill name (e.g. "★ Execute")
- A synergy info panel with the team's element distribution

#### FAQ

**Q: Why does my leader have fewer points than girl #2?**
A: The leader determines the Tier-5 skill for the entire team. An Execute leader (Fire/Water) with 29,000 points is stronger than a Reflect leader (Psychic/Nature) with 31,000 points, because Execute can instantly end fights.

**Q: Why does the algorithm only show 7 girls instead of 16?**
A: The new algorithm optimizes a complete 7-girl team composition. The old algorithm showed 16 individual rankings without team optimization. The 7 girls shown are the optimal team — click "Assign first 7" to use them.

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

### v7.33.0 — Sandalwood Proactive Re-equip & Intelligent Batch Sizing

A new **Proactive Re-equip** system for the Sandalwood Perfume booster (MB1) that automatically detects when the booster is depleted and re-equips a new one from the market — without waiting for the next scheduled booster check. Additionally, the script now intelligently limits fight batch sizes (x50/x10/x1) based on remaining Sandalwood doses to avoid wasting the booster on oversized batches.

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

**3. Intelligent Batch Sizing**

The script now calculates the maximum safe batch size before each fight using `getRecommendedBatchSize()`. It picks the **most restrictive** limit from:
- **Remaining doses**: Not enough doses for a x50? Downgrade to x10. Not enough for x10? Use x1.
- **Remaining shards until limit**: Close to your shard target? Use smaller batches to avoid overshooting.
- **User preferences**: Your x50/x10 toggle settings are still respected.

This means the script gradually transitions from x50 → x10 → x1 as Sandalwood runs low, maximizing efficiency.

**4. Race-Condition Fix (Flag+Resolver Pattern)**

For batch fights (x50/x10), the script now uses a synchronization mechanism:
- `resetBattleResponseFlag()` is called before clicking the fight button
- `waitForBattleResponse()` pauses until the AJAX response is fully processed (with a 30s timeout)
- This ensures dose tracking is always up-to-date before the next batch decision

#### New Settings

Four configurable thresholds control when batch downsizing kicks in:

| Setting | Default | Purpose |
|---------|---------|---------|
| SW Shards x10 Limit | 80 | Shards collected before downgrading from x10 to x1 |
| SW Shards x1 Limit | 95 | Shards collected before stopping x1 fights |
| SW Doses x10 Limit | 6 | Minimum doses required to use x10 batch |
| SW Doses x1 Limit | 3 | Minimum doses required to use x1 batch |

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
