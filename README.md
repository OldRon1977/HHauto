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
