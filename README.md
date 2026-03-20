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

---

### v7.31.1 — League Optimization, Season Max Tier & Place of Power Fix

**League Power Calculation Optimization**
The league power calculation has been optimized for better performance (#1358). The algorithm now evaluates team strength more efficiently, reducing unnecessary computation during league fights.

**Season: Max Tier Option**
A new **Max Tier** option has been added to the Season module (#1496). This allows you to set the maximum tier for seasonal events. The option is ignored when "Ignore no girl" is checked, giving you full control over which girls to pursue during seasonal events.

**Place of Power: Wait for Start**
The script now correctly waits for a Place of Power event to fully start before navigating to the next page. Previously, the script could navigate away too early, causing missed POP events. Combined with a league fix that ensures proper handling of league state transitions.

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

#### Additional Fixes in v7.32.x

- **v7.32.1**: Fixed `+Mythic Raid` blocking all subsequent auto-loop handlers when no raid target was found. Added Season Max Tier display. Extended timer handling for Champion, ClubChampion, Labyrinth, PentaDrill, and Pantheon.
- **v7.32.2**: Replaced boolean `+Mythic Raid` toggle with `+Raid Stars` grade dropdown. Added migration from old boolean setting to grade index.
- **v7.32.3**: Fixed girl grade detection — now uses `nb_grades` field which returns the correct visible star count (3=rare, 5=legendary, 6=mythic).
