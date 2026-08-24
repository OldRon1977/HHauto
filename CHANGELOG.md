# Changelog

All notable changes to HHauto are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This file replaces the in-README "Latest Updates" section as of v7.35.52.
Older entries below were migrated 1:1 from `README.md`.

### v8.10.39 - 36 dead texts removed from the language files

- 36 entries had no reference anywhere in the script: leftovers from the two
  extra koban safety switches, the old Path of Valor/Glory heading, the
  labyrinth team builder, the market fight simulator, several harem buttons and
  a "upradable" typo. None of them could ever appear on screen.
- Removed from all four languages, 144 entries in total. Every language now
  holds the same 409 keys, and a scan finds no key without a use.

### v8.10.38 - Three French labels were overwriting the English ones

- Three entries in the French file were assigned to the English bucket by
  mistake, so "Main adventure", "Side adventure" and "Others" in the troll
  selector showed up in French for everyone — including players of every other
  language, since they fall back to English. Present since #1381. They are
  French entries now, and English reads English again.
- The Warning text is gone from all files. It belonged to a function that has
  been commented out for a long time, so nothing ever showed it; the commented
  function went with it.

### v8.10.37 - The last trace of the Arena is gone

- The Spanish file still carried a translation for the old Arena switch, the
  PvP mode the game replaced with Seasons. The translator had already marked it
  obsolete in the tooltip. Nothing read it: no setting, no stored value, and
  the only mention in the code was a commented-out line. Both are gone.

### v8.10.36 - The event troll list is complete and correct

- bjaume's proofread of the Spanish menu is in, including the labels that were
  still abbreviated from the days when space was tight (AutoSal., AutoMision
  and friends), and "Senda" changed to "Camino" — what the Spanish client
  actually calls the Paths.
- The list of event trolls in the tooltip was five short in every language and
  three of the names were wrong. It is now generated from the list the script
  itself uses, so it cannot drift again: 1-19 and 22, with a note that 20 and
  21 are side-adventure trolls and have no name.
- Fixed on the way: the French file defined the troll-order entry twice. The
  second one won, and its list ended in a placeholder — with a version high
  enough that it never fell back to English, so French players saw it.

### v8.10.35 - The menu speaks French

- Same for French as the previous release did for Spanish: it was 151 of 446
  entries, with nine more translated but invisible because an entry older than
  its English counterpart is ignored by design. Both are done, and a dozen
  entries that had been sitting there in English were translated as well.
- Like the Spanish file, it is written to be proofread. Villain names and a few
  in-game terms were left as they are rather than invented.

### v8.10.34 - The menu speaks Spanish

- The Spanish menu was 81 of 446 entries, so most of it fell back to English —
  and nine further entries were translated but invisible, because an entry
  older than its English counterpart is ignored by design. Both are done: 366
  new entries, the nine refreshed, nothing missing.
- Written to be proofread rather than trusted. Names of villains and a few
  in-game terms were left as they are rather than invented.

### v8.10.33 - +Girl Skins now works for event villains too

- With +Girl Skins on, the script kept fighting love raids for a girl it
  already owned but stopped at event villains, mythic ones included (#1842).
  Reported by bjaume, whose settings were right all along — the feature simply
  did not exist outside raids.
- Event girls now stay a target while a skin of theirs is still outstanding.
  The game says so on the girl itself, so this is read, not guessed: each skin
  carries whether it is released and whether you own it.
- Unreleased skins are ignored. Farming something nobody can win yet would
  never end.

### v8.10.32 - +Mythic, +Event and +Raid are not marked as broken any more

- Since 8.10.25 the menu marked the Event trolls, Mythic event and Love Raid
  blocks amber — "set up but will not run" — whenever Auto troll battle was
  off. That was wrong: each of those three switches makes the script fight on
  its own, and a correct configuration was being reported as a mistake (#1842).
- They are green on their own now. The amber state stays for what it was built
  for: options set on a block whose own switch is off.

### v8.10.31 - Leagues no longer loses its turn mid-session

- After the league block launched its fights, another block could take the
  leaderboard page and navigate away before they were done. Seen in a
  ten-minute session: three league fights started, and Season went to the
  season arena instead.
- The league block hands the slot back on purpose after arming its timer — that
  part is right, it is what lets the fight results be read. What was missing is
  that it had just done something, so the pipeline treated the turn as an empty
  one and gave it to the next block.
- A block that switches the automation loop off is now counted as having acted,
  which is what every handler does just before the page reloads. The block still
  hands the slot back; it simply gets its turn back afterwards.

### v8.10.30 - The activity survives a fight again

- 8.10.29 still let another block cut in right after a fight, on the result
  page, before the reward had been read. Three times in a seven-minute session,
  each time with League, Quest or Season taking over on the troll battle page.
- The reason was where the script noted that a block had done something: after
  the handler returned. A fighting handler never returns — it waits for the
  battle, and the answer loads the next page, so the note died with the page.
  The run came back looking as if it had done nothing and gave the activity up.
- It is now noted when a run comes back after a page load, which is proof that
  it navigated. That note is written on the new page and survives.

### v8.10.29 - Fixes the pipeline stall in 8.10.27

- 8.10.27 could park the pipeline on one block. A block's settings say it may
  run, not that it has anything to do: troll battle comes through its gate
  every few seconds and falls through when the power is below the threshold.
  Such an empty run kept the activity anyway, so nothing else was even offered
  a turn, and the five-minute safety net could never fire because it measured
  from that same empty run.
- An activity is now only kept by a run that actually did something -- fought,
  collected, navigated. A block that comes up empty hands the pipeline straight
  back, exactly as before 8.10.27.

### v8.10.28 - Path of Attraction collects on its own again

- Collecting Path of Attraction rewards was tied to the "Go to in Events"
  switch (#1816). That switch adds a convenience link on one PoA objective and
  has nothing to do with collecting -- but the auto-collect sat inside the same
  branch, so turning the link off silently turned collecting off with it, and
  nothing said so. The Collect all button kept working, because it collects
  directly, which is why this looked like "it works when I press it, never on
  its own". The switch now decides only about the link.

### v8.10.27 - One activity is finished before the next one starts

- The script hopped between activities: one troll fight, one season fight, one
  pantheon fight, round and round (#1841). It now stays on an activity until
  that activity is done -- out of energy, threshold reached, timer set -- and
  only then moves to the next one.
- The cause was a single word meaning two things. A fight block hands its
  battle-result page to the reward parser (#1740) by reporting "not me" for
  that page, and the scheduler read that as "finished" and released the slot
  after every single fight. It now tells "not yet" and "done" apart.
- The collect blocks still cut in whenever they are due. Their rewards expire
  with the event they belong to, so they never queue behind a fight.
- Fixed on the way: another block could start on a battle-result page and
  navigate away before the reward had been read. Only the troll block guarded
  that page; now the running activity holds it whatever is fighting.

### v8.10.26 - The Adventure heading matches its tab

- The area is called Adventure in the menu rail and every other area says the
  same thing on both sides, but the heading beside it read "Battle Troll" --
  the script's word for what it does there, not the game's word for the place.
  Both say Adventure now. The energy label on the adventure page itself is
  unchanged.

### v8.10.25 - Every block says whether it is running

- Each block in the settings menu (Salary, Daily Goals, Champions, ...) now
  carries a coloured dot on its heading: **green** it runs, **red** nothing in
  it is switched on, **amber** it is set up but will not run. Blocks that
  cannot be on or off at all -- thresholds, opponent filters, team settings,
  display options -- stay unmarked, because "on" would mean nothing there.
- Amber is the case a plain on/off marker gets backwards: +Event configured
  down to the buying while Auto troll battle is off, or Labyrinth hard mode set
  with Labyrinth itself off. Nothing runs there, and it is not a decision --
  it is the forgotten toggle. The same applies to the mythic and love-raid
  blocks, which all need Auto troll battle to do anything.
- The count on the tab rail counts **blocks** now instead of single switches,
  so "3/9" reads in the same units the areas are named in. It takes the same
  three colours, and amber wins for the whole area even when other blocks in it
  run -- so a forgotten toggle is visible on the rail without opening the area.
- Books and Gifts in the shop count as running blocks now. Both spend money the
  moment they are on, exactly like Boosters, and were missing from the count.
- A block for a feature this game does not have (no Pachinko, no Labyrinth) no
  longer sits in the denominator of the count. It was hidden but still counted.

### v8.10.24 - "Change team" actually goes to the team page

- The Change team button on the league page linked to a bare `/teams.html`,
  which the game redirects straight to the home page. So it never arrived, and
  the gear tools never got the chance to note which theme your team runs --
  which is what made Current/Possible Best Gear ask you to build a team first.
  The link carries the battle type now, like the game's own links do.
- The message those buttons show when the theme is still unknown said "build a
  team first". Nothing has to be built: opening the team page once is enough,
  and it now says so.

### v8.10.23 - The HH Gear popup is readable

- The popup sits on white, but the menu entries were drawn in the menu's own
  near-white and the descriptions in a pale grey-green -- unreadable on that
  background. Entries are black now, descriptions dark grey.
- The table lines in the same popup were white on white and never showed at
  all, which also affected the Current/Possible/Upgrade previews.

### v8.10.22 - The keep marks survive the trip to the level-up page

- Marking was drawn on the market page and gone the moment you walked to the
  level-up page -- which is the page where the material is actually picked, so
  it was gone exactly where it mattered. The decision is now stored and the
  stars reappear there.
- What is stored is an identity that does not move: skin, slot, rarity and the
  two resonance axes. Deliberately not the level or the stats, both of which
  are a pure function of the level -- a key built on those breaks the instant a
  piece is levelled, which is what happens to HH++ OCD's favourites. And not
  the item id either: the market and the level-up page hand out different id
  spaces, and ids change when a piece is unequipped.
- The material list loads while you scroll, so the markers are added as it
  does rather than once on arrival.

### v8.10.21 - One HH Gear button, not a row of them

- 8.10.20 broke the check that stops the gear button being injected twice: it
  tested for an id that the menu rewrite had just removed, so every switch back
  to the armor tab added another copy. It now tests for the container itself,
  and sweeps up any extras a page already collected instead of needing a
  reload.

### v8.10.20 - The gear tools move into a menu

- Four buttons never fit beside the game's own Level-up and Equip. Measured on
  the live page, the space left in that row is 150x115 device pixels, which
  holds two of them -- the fourth was being drawn over the Equipped Items panel
  where it could not be clicked at all. There is now a single **HH Gear**
  button that opens the four actions as a list, each with its one-line
  description. One extra click for the three you already knew, and the next
  tool costs no space at all.

### v8.10.19 - The gear buttons fit again

- The fourth button pushed the block past the bottom of its container and the
  last one was cut off. The four now sit in two columns instead of one, which
  halves the height (measured in the running game: 215px down to 111px). The
  width was never the constraint.

### v8.10.18 - Mark the gear worth keeping

- New **Mark Keepers** button on the market's armor tab. It puts a star on the
  mythic pieces worth keeping, so everything unmarked is safe to spend by hand
  as upgrade material -- which is the point: two helmets of the right class and
  element mean one can level the other instead of being sold.
- One piece is kept per slot and element. Which one: your own class first, then
  damage before defence before ego before harmony, then the higher level, and
  the lower id to break a dead heat so the star does not wander between page
  loads. An element you only own on a foreign class keeps its best piece
  anyway, otherwise that element would disappear from the slot.
- Display only. Nothing is equipped, sold or consumed, and the automation still
  never feeds mythics to anything.
- Dropped the per-run level-up cap, which could not fire: the loop raises the
  level on every pass, so the max-level check ends it after at most 19 passes
  and the cap sat at 30.

### v8.10.17 - Tooltips you can actually read

- **The help box now sizes itself to the text.** A one-line hint keeps the
  narrow box; a long explanation gets up to double the width before anything
  else changes. Only if it still does not fit does the type shrink, so width is
  spent before readability. It also places itself on whichever side of the panel
  has room, instead of tucking over the rows it is explaining.
- **The long texts have structure instead of one run of line breaks.**
  Paragraphs, bulleted lists, bold for the thing being defined, and monospace
  for the codes you type. The pure code tables -- Mythic Slot, Buy boosters,
  Event troll order -- are laid out in two columns rather than sixteen short
  rows down the side.

### v8.10.16 - Spelling out when the Mythic Slot list gets all five

- The reserved slot and the skipping of MB1 apply only while one of the
  Sandalwood auto-equips is switched on. With all of them off the list uses all
  five slots and MB1 is a normal entry, equipped in the position you gave it --
  it then simply stays on rather than being put in for the fights that want it.
  Unchanged behaviour; the help text says it now, and tests hold it in place.

### v8.10.15 - The Sandalwood slot stays reserved

- With any of the Sandalwood auto-equips on, MB1 belongs to that automation:
  it is ignored in the Mythic Slot list even if you type it, and one slot stays
  free so the automation can equip it when a fight needs it. Your list fills at
  most four of the five. This is unchanged behaviour -- the help text now says
  so plainly instead of leaving you to work it out from an empty slot.

### v8.10.14 - Mythic conflicts are remembered across sessions

- Which mythic boosters clash with each other can only be learned by being
  refused: the game sends no description of what a mythic booster does. Every
  clash therefore costs a request, a popup and a page reload to find out. That
  knowledge was kept only for the current browser tab, so every new session
  paid the whole price again. It now survives, and still clears itself once the
  booster it clashed with is gone.

### v8.10.13 - The mythic conflict popup stops coming back

- The game refuses a mythic booster that clashes with one already equipped, and
  shows a popup that cannot be closed from a script, so the page is reloaded to
  clear it. That refusal was remembered only for the *exact* set of boosters
  equipped at the time, so any successful equip afterwards invalidated it: the
  refused booster was tried again on the next pass, refused again, and the
  popup and reload came back. It is now remembered against the boosters that
  were on at the time and only re-tried when one of them is actually gone --
  adding a booster to a free slot cannot resolve a clash, so it no longer
  clears the memory.
- A single pass now gives up after three refusals instead of walking the rest
  of the list. Each refusal costs a request and a popup, and they are
  remembered, so the remaining entries are picked up on the next pass with
  nothing lost.
- **The Mythic Slot list really does take all twelve codes now.** 8.10.12 raised
  the input field but the parser still cut the list to five, so everything past
  the fifth entry was dropped without a word. A repeated code is also ignored
  instead of taking a second turn.

### v8.10.12 - Tab badges, readable tooltips, and a compact menu

- **Each area in the tab rail now shows how many of its automations are on**,
  as `2/6`. Franck-75 asked for a red/green marker; a count says *how much* is
  running rather than only *whether anything* is, which is what you need when
  comparing the same area across accounts -- and it does not depend on telling
  red from green. Only switches that actually make the script act are counted,
  so an area does not look busy because a display option is ticked. Areas with
  nothing to count (Harem) show no badge.
- **Long tooltips are no longer cut off.** The box grew with the game's zoom
  while its height limit did not, and once it overflowed the text could not be
  reached: the box ignores the mouse, so its scrollbar was untouchable, and it
  closed as soon as the pointer left the row. It now uses the full window
  height and shrinks its type until the whole text fits.
- **The Mythic Slot list is no longer capped at 5 entries.** The field took at
  most 5 codes, which read as "5 is the limit" -- but 5 is the number of slots
  in the game, not a sensible length for a priority list. You can now list all
  twelve; the script fills whatever slots are free with the first ones you own.
  The help text says so, and spells out the difference.
- **New "Compact menu" switch** under Global -> Basics: denser rows and smaller
  type for more options per screen. Off by default, so nothing changes unless
  you ask for it.

### v8.10.11 - Boss Bang no longer reports "Time's up!" after the event ends

- When a Boss Bang event finished, the status panel kept showing a Boss Bang
  row stuck on "Time's up!" for an event that no longer existed. The
  automation was right not to act on it -- it never tried to navigate there --
  but the row stayed until the browser tab was closed. The script now drops
  the Boss Bang timers as soon as the event widget is gone from the home page,
  the same way it already did for Sultry Mysteries, and the row disappears
  with the event.

### v8.10.10 - The status panel, readable

The panel on the home page listing the timers was two centred columns, which
left the longer rows cut off at the panel edge.

- **One column**, with the timer name on the left and its time flush right.
- **Long names wrap** instead of disappearing under the next column.
- **The contest row is now two rows**, "Contest end" and "Next contest", so it
  is clear which time is which.
- **The missing-booster marker is just "no booster"** now, which leaves room on
  the rows that carry it.
- **Eight more timers**: daily goals, free bundles, Boss Bang, and the
  collect-all timers for season, seasonal event, Path of Valor, Path of Glory
  and Penta Drill. Each appears only while its timer is actually running.
- **Narrower panel and smaller type**, so the rows sit together instead of
  spanning half the screen. **Show info left** has a set width as well now --
  it used to stretch across almost the whole window whatever width the panel
  was given.

### v8.10.0 - A menu that fits every language

The settings menu is no longer three fixed-width columns. Options are grouped
by game area, every group has a heading, and a label can be as long as its
translation needs. Longer German, Spanish and French texts no longer run under
their switch or off the edge of a box.

- **Areas instead of columns.** One pane per game area, reachable from the rail
  on the left, with the area you had open remembered.
- **Single page menu.** A switch under *Global* drops the rail and stacks every
  area in one scrolling list, for anyone who wants the whole configuration in
  one view.
- **Menu Order.** A new footer button reorders the areas by drag or arrows. It
  applies to both layouts, is kept locally, and is part of the settings export.
- **Number fields hold twelve digits** plus thousands separators, so large
  amounts are readable instead of clipped.
- **Places of Power filter widened** and menu tooltips no longer sit half
  outside the panel or ignore the zoom the game draws the menu at.
- **German terminology reviewed** against the English menu once more.

### v8.9.0 - German, in full

The German menu is complete: every one of the 381 entries the English file
has, none missing, none falling back to English behind your back.

- **310 entries translated**, from the option labels down to the tooltips.
- **9 rewritten** where the English text had moved on and nobody noticed.
  `+Event` and `+Mythic Event` still described how they worked before
  v7.32.1 -- "ignore the selected trolls during an event" -- when they have
  meant "fight event trolls independently of Auto Troll" for months. You
  never saw the wrong text: the version stamp was older than the English
  entry, so the menu quietly showed English instead. Same for Main Quest,
  the booster filter, Max Exp and Max Aff.
- **1 dead key removed** (`autoArenaCheckbox`), which had no English
  counterpart and could never be read.

Game words stay as the game says them -- Koban, Booster, Troll, Season,
Pachinko, Orbs, Skills. Everything around them is German.

**The translation was produced with AI assistance.** It follows the
terminology the existing entries already established and every string was
reviewed before it landed, but a machine does not have a native speaker's ear
for what reads naturally in a game menu. If something sounds stiff, wrong or
simply odd to you, please say so -- open an issue or send a pull request
against `src/i18n/de.ts`. Corrections from native speakers are genuinely
wanted, not merely tolerated.

French is next and will carry the same note; Spanish is untouched for now.

#### Under the hood

- 195 lines of commented-out code deleted. A commented-out selector had
  already produced one false finding in the live checker: nothing about a
  commented block says "this is not a claim the script makes any more".
- Comments that stated something checkable were checked. 23 module headers
  claimed they were used by `Service/index.ts`, a file that does not exist;
  they now name the modules that actually import them. Two spec case counts
  were wrong, and one comment referred to a function that never existed.

### v8.8.0 - Gear for your hero

Three buttons next to the armor inventory on the market page, laid out like
the team workflow so there is one mental model instead of two.

- **Current Best Gear** puts on the best armor you own for each of the six
  hero slots, judged as things stand today.
- **Possible Best Gear** puts on the items worth developing -- the ones that
  will be strongest once levelled to the cap -- and says per slot what that
  costs you right now.
- **Upgrade Gear** levels the mythics you are wearing towards the cap,
  best-matching slot first.

**No mythic is ever used as material.** Upgrade Gear consumes only legendary
and epic items. There is no exception -- not for duplicates, not for spares,
not for a mythic sitting unworn in your inventory, and not for one whose
resonance matches nothing you have. If you own it and it is mythic, this
feature will not spend it.

**How items are ranked.** By priority, not by a computed stat score: a capped
mythic matching your class *and* your team's theme, then class, then theme,
then any capped mythic, and only then everything else. At the cap every
mythic of a slot has identical stats, so the resonance is the whole
difference; two items of the same tier are separated by how much bonus they
carry, and the theme axis pays double on the chance track.

Two stat scores were built first and both wanted to trade mythics away for
legendaries. Reading the equipment of all 99 players in one league settled
it: 582 of 594 worn slots are mythic, 576 of those at the cap, every player
in the top 25 wears six of six, and the four holding legendaries sit at
places 49, 60, 80 and 95. A score cannot be made right here either -- the
theme resonance lands on defense or crit in all 582 cases, and neither is
measurable client-side.

**What each button promises.** Current Best never makes you weaker: an
unlevelled mythic is judged on its real stats, so it cannot displace a
stronger legendary just for being mythic. Possible Best deliberately does the
opposite, exactly as "Best Possible" on the team page fields a level-1 girl,
and prints the gap instead of hiding it. Upgrade Gear leaves the cost curve
to the game -- the upgrade page states the requirement and its "Auto Select"
fills the material slots by the game's own rules, so the run presses that and
stops when the game says the stock is spent.

**Before it touches anything** each button shows the full plan, logs one line
per slot, refuses to act when `hh_ajax` is missing, and records the inventory
id of every item it takes off, so a rollback stays possible -- that id changes
on every unequip and can only come from the equip response.

**The theme comes from your team.** `TeamModule` now stores the theme of the
team it fielded, and the teams page records it too, because the market page
has no team data of its own. Without a theme the buttons do nothing and say
so: gear picked on a guessed theme is six wrong items.

For scale: taking one mythic from level 1 to the cap took 1,206 legendary and
epic items on the test account. The run stops on its own when the material
does, and the upgrade page shows each item's exact requirement.

### v8.7.0 - Team selection ranked by battle power, and a workflow to go with it

**Team selection.** The picker ranked teams by `caracs_sum`, which is exactly
the "Total Power" the game prints -- measured against the live game, that
number is the plain sum of the seven girls' caracs and contains none of the
mechanics that decide a fight. Element synergies scale the whole stat, hero
base included, and run linear from the *first* girl of an element (three is
only the threshold for the team theme and its league domination bonus).

The builder now also produces candidates that stack an element to three or
four girls -- teams a stat-sum ranking can never reach, since constraining a
pool can only lower its sum. All candidates go to the game's own calculation
(`action=team_calculate_caracs`, the request the edit screen fires on every
girl swap) and are ranked by expected damage per hit x survivability. Without
`hh_ajax`, or when any candidate cannot be calculated, the previous
`caracs_sum` pick stands. "Best Possible" is excluded on purpose: the game
calculates today's stats, while that mode ranks girls by their value at level
750 with max grades.

Measured on one account against the 101 real opponents of its league, scored
with the script's own battle simulator: 88.89% -> 92.18% average win chance at
identical Total Power (+6.8% damage, +7.8% ego), better against 26 opponents
and worse against none. Across 135 candidate teams the new metric correlates
0.96 with simulated points and picks the actual best team; `caracs_sum` alone
correlates 0.85 and picks the 9th best.

**Equipment is part of `caracs`.** The internal docs claimed the opposite and
the info panel repeated it. Moving gear between girls moves their `caracs_sum`
with it, and the same six-item set can be worth ~23% more on one girl than on
another (mythic resonance bonus). Building while the sitting team still wears
the gear therefore ranks that team for its items: hit **Unequip All** first.
The panel says so now.

**Edit-team workflow.** The buttons are one numbered column -- 1 Unequip All,
2a Current Best, 2b Possible Best, 2c Assign first 7, 3 Stuff Team. "Stuff
Team" used to exist only on the team-list page, which was reachable only by
leaving the edit page, and "Assign first 7" ended by clicking the game's
Validate button, which saves *and* navigates back -- so the flow was over
before the girls could be stuffed. Assign now sends the same request Validate
sends and stays on the page. The buttons sit in a flex column with identical
boxes so no label length can make them overlap, and the summary panel folds
away with a click on its header (remembered, because step 1 reloads the page).

Enhancement for #1679.

### v8.6.1 - Auto-Mystery is its own pipeline block

Auto-Mystery now appears in **Block Order** and can be prioritised like every
other feature. It used to run as a tail call inside the Sultry Mysteries event
parsing, which had two consequences: it was invisible to the reorder UI, and
every tick that re-parsed the event page started another click chain of its
own -- squares were opened in parallel while an open request was still in
flight, and *Generate new grid* could fire several times in a row.

The new `handleSultryMysteries` block navigates to the event page itself, so
the event no longer has to be marked "due" for the whole time the key-check
timer sits expired. Behaviour of the grid run is unchanged.

The "What's New" popup is active for this release and introduces Auto-Mystery
(off by default, no settings are reset).

### v8.6.0 - Auto-Mystery: automated Sultry Mysteries grid

New **Auto-Mystery** switch next to *Refresh Shop*. Enabling it opens a
reward-selection popup (the same one Path of Valor/Glory use for their
collectables) listing the eight reward types a grid square can hide:
Kobans, Gems, Fists, Kisses, Orbs, Items, Coins and Keys.

The script opens grid squares with the keys it has, in a checkerboard
pattern so the first wave spreads across the whole board:

```
X O X O X O        squares  1  3  5
O X O X O X                 8 10 12
X O X O X O                13 15 17
O X O X O X                20 22 24
X O X O X O                25 27 29
```

That is exactly 15 squares -- the game's threshold for *Generate new grid*.
The remaining squares follow in ascending order when a selected reward is
still hidden, so the grid is regenerated only once **both** conditions
hold: at least 15 squares open, and every selected reward type fully
revealed. Selecting nothing means the grid is regenerated as soon as 15
squares are open.

- Keys won from the grid itself are spent immediately, within the same
  pipeline pass.
- When the keys run out the automation parks for an hour before looking
  again -- keys only drop from the last Daily Goals chest and from
  villains, and the script should not sprint off the moment a single key
  appears. The next check is shown in the info panel as *Auto-Mystery*.
- Keys are never bought with kobans. Clicking a locked square with zero
  keys makes the game open its key purchase popup, so the automation only
  ever clicks with keys in hand.
- Reward counts per type are read from the live grid rather than
  hard-coded, so a regenerated board with a different composition is
  handled correctly.

### v8.5.5 - Selector and gating fixes found by live-testing against the game

Each fix below was reproduced against the running game before and after the
change, not just unit-tested. Two further suspicions were investigated and
dropped as measurement errors -- `optimizeEquipmentSlots` and the `id_girl`
global both work; they had been measured on the wrong page state.

- **Shop:** `isTimeToCheckShop()` only knew about the market's *readers*
  (`updateMarket`, `autoEquipBoosters`), never the *buyer*. With only
  `autoBuyBoosters` enabled the `handleShop` pipeline block never started,
  so the store contents were never cached and no booster was ever bought.
  Buying now triggers the market visit as well, gated on a non-empty
  booster filter so an emptied filter still means "buy nothing".
- **League:** the game dropped `#leagues-tabs` and `#leagues_middle`, so
  the script header (Hide beaten opponents, power-calc controls) and the
  opponent-parsing popup were injected into nothing and never appeared.
  Both are re-anchored to `#leagues .league_content` / `#leagues`. The
  guard against double injection and against the HH-OCD script's own
  button is unchanged.
- **Market:** `doShopping()` reported `Could not parse store content.` on
  every page load until the shop had been visited once -- the check sat
  inside a branch that had already established the value was `undefined`,
  so it always fired. "Not cached yet" is a normal state and is no longer
  logged; the JSON check moved to where a stored value is actually read,
  where a genuinely corrupt value still surfaces as an error.
- **Bundles:** the expiry timer was scraped through `.period_deal`, which
  is a tab and not an ancestor of the timer, so the scrape always failed
  and fell back to `maxCollectionDelay`. It now reads the visible content
  container. Timers longer than 24h are still capped -- that cap is
  intentional so the next free-bundle check is not deferred for days --
  but the cap is no longer reported as a read error.
- **Seasonal:** `goAndCollectFreeCard()` read `mega_event_data.cards`
  before checking which page it was on. Off the Seasonal page that global
  does not exist, so it logged `HH var not found` and skipped the
  "already collected" shortcut, navigating to the event needlessly. The
  page check now runs first.
- **Sultry Mysteries:** the event's remaining time was scraped from a DOM
  timer that only exists on the shop tab, while `parse()` runs with the
  grid tab active. `convertTimeToInt('')` then returned a random 15-17
  minutes, so `seconds_before_end` was wrong on every poll. It now reads
  `sm_event_data.seconds_until_event_end`, falling back to the DOM scrape
  and then to one hour, with the timer and the event list entry fed from
  the same resolved value.
- **Season:** when `autoSeasonBoostedOnly` is on and no booster is
  equipped, the `handleSeason` fallback could not tell that reason apart
  from "not enough energy" and applied its generic 15-17 minute wait.
  Observed in a real run: the fight was deferred by 16m31s while
  auto-equip put four boosters on under two minutes later. That case now
  retries after 60-120s, guarded on `autoEquipBoosters` being enabled so
  the short retry does not become pointless polling when no booster can
  ever arrive.

### v8.5.4 - "First/last troll with girl" no longer sticks on a finished troll

- With the troll target set to "First troll with girl" or "Last troll with
  girl", the bot could keep fighting a troll whose girls you had already
  finished, and Love Raids never got their turn. The list of which trolls still
  have girls was built once and kept for the whole browser session, so girls you
  completed afterwards were not taken into account. That list is now rebuilt from
  your current harem, so a finished troll is dropped and the bot moves on.

### v8.5.3 - Boss Bang runs all fights, collects rewards, and stays off when disabled

- When the bot entered the Boss Bang battle screen, another due timer could
  take over between fights and navigate away, so the battle screen vanished
  and the bot never came back to finish the run. The bot now holds the Boss
  Bang screens for the whole sequence and lets the game return to the event
  page after each fight, ending only once the event is completed.
- Boss Bang no longer starts a fight while the script is disabled. Opening the
  Boss Bang event page kicked off a fight from a page-display handler that did
  not check whether automation was on; that handler was removed, so the fight
  only runs through the normal (gated) automation.
- Boss Bang now collects the tiered milestone rewards from the event's progress
  bar. Boss Bang has three phases -- team build, fight, rewards -- and the
  rewards unlock once the boss is defeated, so reward collection runs as its own
  phase, independent of the fight setting and the fight cooldown. Rewards are
  collected with a plain button click like every other reward, then the bot
  returns home.

### v8.5.2 - Main and side quest no longer switch themselves off at the newest quest

- When you had reached the newest available main quest, the bot could
  navigate onto that final quest screen, fail to find a proceed button,
  and switch both the main-quest and side-quest auto-settings off - even
  right after you re-enabled them. This is the same self-disable that was
  addressed once before; it returned as soon as the game added quests
  beyond the last quest id the script knew about.
- The bot now recognizes when you are at or beyond the newest known quest
  and waits for new content instead of treating that screen as an error,
  so both auto-settings stay on. Other games already behaved this way.

### v8.5.1 - Team builder no longer counts the labyrinth Role blessing as a league blessing

- The game keeps two blessing sets per girl: `pvp_v3` (the two weekly
  league blessings) and `pvp_v4` (the same plus the weekly Role blessing,
  which only applies in the Love Labyrinth). The blessing helpers used to
  prefer `pvp_v4`, so every girl carrying only the Role blessing counted
  as blessed for league team building — inflating the "blessed" leader
  tiebreak, the blessed-girl counts in the info panel / mythic audit, and
  feeding a phantom percent group into the blessing detection.
- `BlessingService` now takes an explicit context: league lookups read
  `pvp_v3` only, labyrinth lookups read `pvp_v4` only, with no fallback
  across the two. The team builder always uses the league context.
- The game flags are mapped to speaking names: `can_be_blessed` →
  `can_be_blessed_league`, `can_be_blessed_pvp4` →
  `can_be_blessed_labyrinth`. An explicit `false` from the game is now
  respected instead of being overridden by the other set's data.
- Verified against anonymized account dumps (fixtures) and a live dump:
  the `pvp_v3`↔`pvp_v4` delta is exactly the weekly Role blessing.
  Detected league blessings and the built teams stay identical in the
  fixture weeks; only the blessed counts and diagnostics become accurate.

### v8.5.0 - Season focus: choose between all fights, event girl only, or girl + skin

- The Season switch "Ignore if no event girls" is now a three-way "Season
  focus" selector (issue #1793): "All fights" (no restriction), "Event girl"
  (only fight while the girl's shards are incomplete) and "Girl + skin"
  (fight while the girl or her skin can still be won).
- "Event girl" is the new mode: opponents whose girl reward is already fully
  owned (i.e. only her skin is left to win) are skipped. Skin detection uses
  the love-raid data parsed from the raids screen; when no raid data is
  available the reward is treated as a girl, so fights never get stuck on
  stale data.
- Existing settings are migrated automatically: enabled becomes "Girl +
  skin" (the previous behaviour), disabled becomes "All fights".
- New "MT hard" switch next to Max Tier: when enabled, Max Tier is a hard
  limit — no season fight past it regardless of the Season focus, and the
  focus filter applies to every fight below it. When disabled (default,
  previous behaviour) fights run unfiltered while climbing below Max Tier
  and a girl focus keeps fighting past Max Tier while wanted girl rewards
  are available.

### v8.4.0 - Penta Drill delay is now user-configurable ("PD Delay")

- New "PD Delay" field in the main menu (left column, under "Show tooltips"):
  the delay in seconds between Penta Drill actions — going to the opponent
  page, starting the fight and returning to the arena after the fight.
- Increase this if you see blank screens in Penta Drill on a slow connection
  (previously the delays were fixed and could only be changed by a release).
- Minimum 3 seconds, maximum 20 seconds, default 6 (matches the previous
  behaviour). The actual wait adds a random variance: a value between X and
  X+3 seconds is used, as before.
- The delay can also end early: as soon as the next page has finished
  loading, the script continues — so on fast connections the effective wait
  is often shorter than the configured value.

### v8.3.0 - Auto-equip mythic boosters into free mythic slots

- New "Mythic Slot" text field under Auto-Equip (issue #1781), styled like the
  normal Slot Config: enter a priority list of up to 5 mythic booster codes
  separated by `;` (e.g. `MB1;MB2;MB5;MB8;MB12`, MB1 Sandalwood … MB12 Shiny
  Aura). The game offers 5 mythic slots with at most one equipped booster per
  kind — every listed booster you own that is not equipped yet is placed into
  a free slot, in list order. Empty field = off (unchanged behaviour).
- Equipped mythic boosters are never replaced and nothing is bought — the
  script only equips what you already own (purchasing stays with the Auto-Buy
  filter).
- The Sandalwood auto-equip (+Event / +Mythic / +Raid Sandalwood) keeps
  control of MB1: while active, MB1 on the list is left to the Sandalwood
  logic and one mythic slot is kept free for it — the other listed boosters
  are still equipped alongside. Sandalwood behaviour is unchanged.
- Free mythic slots are re-checked promptly (within a few minutes) even when
  your normal boosters still have hours to run, so a wanted mythic booster
  gets equipped soon instead of waiting for the normal boosters to expire.
- Some differently named boosters grant the same in-game bonus and cannot be
  equipped together; the game refuses those with a conflict popup. The rest of
  the list is still equipped, the page reloads once to clear the popup (it
  cannot be closed programmatically) and the conflicting booster is remembered
  as blocked until the equipped mythic boosters change -- then it is re-tried
  automatically, without popping the conflict window every few minutes.
- The script now notices in real time when a mythic booster runs out of
  charges: fights burn the tracked counters (league/season/pantheon/troll/
  team-battle/Place-of-Power, matching each booster's kind), so a freed
  mythic slot -- and a booster that was waiting on a bonus conflict -- is
  picked up right away instead of waiting for the next market visit. As a
  safety net, while a booster waits on a conflict the auto-equip check runs
  at least hourly.

### v8.2.0 - Reward-ad auto-clicker, new pvp-arena battle page, pachinko display fix

- New "Auto reward ads" option (issue #1746, off by default). When enabled,
  the script clicks the Home-page reward ads for you: it presses "Try it now",
  closes the advertising tab that opens after a few seconds, confirms the
  reward with the game's OK button and reloads the page so the next ad can
  appear. It works through every available reward ad, one after the other.
- Ad blockers must be disabled for the ads to appear, and the browser should
  allow pop-ups for the game site. The feature never retries in a tight loop:
  if the ad tab cannot open, the confirm button never shows, or no ad is
  present, it simply logs the reason and waits for the next check window.
- **Season fights work again on the game's new battle page.** The game moved
  season/PvP fights to a new `pvp-arena` page, which the script did not
  recognize -- after a fight nothing was skipped or confirmed and the
  automation stalled on the result screen. The new page is now handled exactly
  like the old season battle page: the script takes over the result and
  returns to the Season arena.
- **No more stale pachinko page after a full auto-run** (issue #1799). After
  an auto-pachinko run finished, the pachinko page kept showing games as
  still playable even though the script had already played them (a refresh
  made them disappear -- a display-only desync, no missed play). The
  run-finished step now reloads the pachinko page once, the same way an F5
  would, so the page always matches what was actually played. Orb counting
  is unaffected.

### v8.1.7 - League no longer freezes on the result screen

- **League fights no longer freeze on the result panel.** After a single
  league fight the automation could get stuck on the fight-result screen
  instead of moving on to the next fight. It now hands the result screen
  over correctly and continues the session.

### v8.1.6 - Fights no longer interleave, import-cycle backbone broken

- Fight sessions stay together (issue #1796): the automation no longer hops
  to another activity between two fights of the same session. Previously,
  each single season/league/raid fight released its scheduler slot for one
  tick, and another module could grab it and navigate away (e.g. a full
  league-screen visit between every raid fight). A block now holds its slot
  until its own stop condition is reached -- energy exhausted, target
  rank/tier reached, or its cool-down timer armed.
- Six high-frequency import edges were untangled
  (config no longer imports feature modules, menu selects read shared
  constants from leaf files, cross-layer calls are injected at boot), which
  collapsed the frozen import-cycle baseline from 348 to 86. These cycles
  were the root cause of the historic boot crashes; every stage of this
  cleanup can only shrink the baseline, never grow it (see
  docs-internal/adr-002-import-cycle-reduction.md).

### v8.1.5 - Internal refactoring: typed globals, menu module split

- No functional changes. The game globals the script reads are now properly
  typed (so game API changes surface at compile time instead of at runtime),
  every explicit `any` is tracked by a lint ratchet that may only go down,
  and the 1000-line menu helper was split into seven focused modules without
  adding a single import cycle (baseline actually shrank 349 -> 348).

### v8.1.4 - Fix quest hanging on girl reward, missing survey permissions

- When a quest step awarded a girl, the reward popup stayed open and blocked
  the quest screen: the script kept clicking the proceed button underneath
  without ever advancing — and the stuck quest block starved the whole
  automation pipeline (no league/season/troll runs). Auto-quest now
  claims/closes an open reward popup first, then continues with the quest.
- The userscript header now grants `GM_xmlhttpRequest` and `GM_setClipboard`,
  which the survey feature's share/copy buttons need; without them both
  buttons would fail on the next survey activation. A new CI check keeps the
  grant list in sync with the GM APIs the code actually uses.
- Internal housekeeping: all `npm audit` findings in the build/test toolchain
  resolved and Dependabot enabled, dead Babel configuration removed, all
  ESLint errors fixed and a full blocking lint run added to CI, the bonus
  login script hardened (minimal `@match` list, security warning), and new
  tests for event girls, champions, league opponents and market shopping
  (coverage ratchet raised).

### v8.1.3 - Labyrinth: fill incomplete teams via auto-fill

- The labyrinth custom team builder now triggers the game's auto-fill
  whenever the team has fewer than 7 girls, before optimizing positions.
  Previously auto-fill only ran on a completely empty team, so a
  partially filled team (e.g. after wounded girls dropped out) could
  stay incomplete and the script got stuck retrying the team edit.
- Internal housekeeping: test coverage thresholds are now enforced,
  package metadata was corrected, build loaders moved to devDependencies,
  and dead minifier configuration was removed from the webpack config.

### v8.1.2 - Recover automatically when a page stalls on load
- If a game page opens but its data never finishes loading, the script now reloads that page automatically a few times to recover, instead of staying paused until you reload it by hand. A page that fails to load the scripts entirely still needs a manual reload.

### v8.1.1 - Fix inconsistent license metadata

- `package.json` claimed ISC and the userscript header claimed MIT, while the
  actual `LICENSE` file has been GPL-3.0 since 2020. Both now correctly
  declare GPL-3.0.

### v8.1.0 - Auto-clear temporary data on update

- Whenever the script updates to a new version, it now clears its
  temporary working data **once**, automatically (issue #1784). This is the
  same operation as the manual "Delete Temp Storage" button: your settings and
  preferences are fully preserved — only the internal timing/rotation state and
  caches are reset, so the script rebuilds them fresh on the new version. This
  avoids the post-update rotation loops that some updates could trigger (as seen
  with v8.0.0), without anyone having to press the button by hand.

### v8.0.0 - Major release: stability overhaul and smarter automation

This is the first public release since **v7.29.19**. It bundles a large
internal refactoring together with a long run of feature and stability work.
Everything you already use keeps working: **no settings are reset and no
features were removed** — the focus was making the script far more stable,
with a few areas made noticeably smarter.

#### Highlights since v7.29.19

- **Complete internal refactoring of the script.** Large parts of the codebase
  were rebuilt for long-term stability:
  - Strict **TypeScript** type-checking across the whole codebase (compiles
    with zero type errors)
  - **ESLint** integrated into the dev workflow to catch problems early
  - Automated **test suite** expanded to 1000+ tests, run on every build
  - Old **dependency cycles** (the import-loop tangle behind many crashes)
    broken up
  - **Centralized navigation** and an **AJAX-mutex** to prevent race conditions
  - A new **block-based run pipeline** so each task finishes its turn instead
    of ping-ponging
- **Much more stable.** The refactoring drained whole clusters of bugs: the
  Place of Power / league / quest navigation loops, recurring "Access
  forbidden" errors, and "script got stuck" situations after sleep or a
  backgrounded tab.
- **Smarter team building.** League and Edit Team selection were rebuilt to be
  blessing-, trait-, synergy- and leader-aware ("Current Best" / "Possible
  Best"), instead of just summing raw stats.
- **Better equipment handling.** Optimized slot-by-slot "Stuff Team" selection,
  Auto-Equip for legendary boosters, and Sandalwood proactive re-equip with a
  configurable shard threshold.
- **More control over fights.** Troll, Event and Raid are now three independent
  clusters, plus a "+Raid Stars" grade filter and a "+Girl Skins" option — fight
  only for the girls you actually care about.
- **Quality of life.** Reorderable function blocks (Block Order menu), Season
  Max Tier, a more responsive menu, a longer debug log, and new inspector /
  network-sniffer helper scripts for filing better bug reports.

#### Fixed

- **League "stay in target" cutoff follows the game's new promotion rule.**
  Kinkoid changed promotion (March 2026) so a player is promoted if they finish
  in the **higher** of the top 15% of the bracket **or** the top 20. The script
  hard-coded "top 20", which is correct for the usual ~100-player brackets but
  too cautious in larger ones. The cutoff is now derived from the bracket size,
  so "stay in target" stops at the right rank for any bracket. (Behaviour is
  unchanged for ~100-player brackets, where the rule still resolves to top 20.)

For the full, blow-by-blow history see the **v7.30.0 – v7.37.x** entries below.

### v7.37.12 - Champions no longer auto-disable after the script idles

#### Fixed

- **Champions stop auto-disabling on their own.** A long stretch where the script was not actively running (a backgrounded or frozen browser tab, the computer asleep, or a manual mouse pause) was wrongly counted as the champion run "making no progress". After enough of those false counts the champion handler disabled itself, showing "ERROR - re-activate" with a no-progress-timeout note. The progress check now ignores idle time and only counts time the script was actually working, so healthy runs survive long idle periods. The same fix protects other multi-step handlers (e.g. Places of Power).

### v7.37.11 - Startup no longer hangs on the non-game frame

#### Fixed

- **Startup hang fixed.** The script no longer gets stuck retrying for the game's player data in the page's non-game frame (the bare "/" wrapper), which could look like a freeze. It now skips that frame and runs only where the game actually loads.

#### Changed

- **Startup diagnostics.** The debug log now records the page and wait time while loading, and logs once when the game data has loaded successfully, to help track down startup issues.

### v7.37.10 - Stat upgrades no longer freeze the script

#### Fixed

- **Auto stat upgrades** no longer get stuck in an endless loop (for example after an account level-up) when a stat purchase does not register. The script now stops the retry loop instead of freezing, and logs details to help pin down the cause.

### v7.37.9 - Mouse pause and Pachinko cancel fixes

#### Fixed

- **Mouse pause** is now respected right after you manually open a page. Activity from just before the navigation carries over, and a short pause after each page load stops the bot from immediately navigating away from the page you just opened.
- **Mouse pause** now also writes a debug-log line while it holds automation, so you can confirm it is working.
- **Pachinko** no longer leaves the script frozen after you cancel a multi-orb run. Cancelling now resumes normal automation instead of stopping it until you reload the page.

### v7.37.8 - Main/side quest no longer self-disable at the latest quest

#### Fixed

- **Main and side quest** auto-settings no longer switch themselves off when you reach the newest available main quest. The bot now recognizes the latest quest and waits for new content instead of treating its screen as an error.

### v7.37.7 - Champions stop looping on finished event girls

#### Fixed

- **Champions** no longer get stuck re-opening the champions map every few seconds when a tracked event girl is no longer available on a champion. The bot now schedules the normal cooldown instead of rechecking on a loop.

### v7.37.6 - Labyrinth claims the marked relic

#### Fixed

- **Labyrinth** now claims the relic card it marks with the green arrow. Previously it could claim a different card than the one it highlighted.

### v7.37.5 - Season no longer stops early

#### Fixed

- **Season** could stop after the first few fights and arm a ~30 minute timer even though more fights were still available, so it looked like only one fight ran. The auto-fighter now keeps going through your remaining Season energy as intended.

### v7.37.4 - longer debug log

#### Changed

- The debug log now keeps up to 5000 entries (was 500), so a Save Debug capture covers a much longer run for troubleshooting.

### v7.37.3 - timing tweaks

#### Changed

- **Penta Drill** now waits longer after starting a fight, avoiding the occasional blank screen when the next step was clicked before the server had responded.
- **Stuff Team** paces the equipment clicks more slowly (about half a second between clicks) for steadier, more human-like equipping.
- **Auto-equip boosters** re-check on a tighter randomized schedule (15-45 minutes) instead of up to 2 hours.

### v7.37.2 - Pornstar Harem boss mapping fix

#### Fixed

- **Caty Campbell (Pornstar Harem world 27)** is now recognised by the troll fighter. Her world had no ID mapping and resolved to the wrong opponent.

### v7.37.1 - new Pornstar Harem boss

#### Added

- **New boss "Marie McCray"** added to Pornstar Harem (world 28), including her three reward girls so the troll fighter recognises and tracks them.

### v7.37.0 - block-based pipeline + block reordering

#### Added

- **Block Order menu.** A new "Block Order" button opens a popup where you reorder the script's functions by drag or with up/down arrows. A couple of infrastructure blocks are fixed in place and shown greyed out; "Restore default" puts everything back. Your order is saved and survives reloads and sessions.
- **Pipeline Diagnostics toggle** (menu, off by default) that enables extra per-step logging for bug reports. The basic pipeline trace is always logged.

#### Changed

- **Reworked the run loop into a block-based pipeline with reload-safe run state.** Functions that share a timer (e.g. Season fight/collect, or Place of Power vs Club Champion) no longer ping-pong back and forth without getting work done: a block now holds its turn from start to finish and then hands over.

#### Fixed

- Long-running tasks (a full Place of Power run, a large Champion team build) are no longer cut off partway through.

### v7.36.0 - codebase review & hardening pass (interim milestone)

#### Changed

- **Internal review and hardening across the whole script, with no visible change to day-to-day behaviour.** The action scheduler and the high-risk modules were reviewed and consolidated, and the entire codebase now compiles under strict type-checking. This is an interim checkpoint ahead of the upcoming scheduling rework.

#### Fixed

- The battle-animation auto-skip no longer throws an error when the skip button is not present on the page.

#### Removed

- Dropped an unused, dead test toolchain (no user impact).

### v7.35.62 - pachinko orb over-consumption fix

#### Fixed

- **Auto-pachinko no longer spends more orbs than requested.** On fast runs the on-screen orb counter could lag behind the server, so the routine kept pulling after it had already reached the requested number and used up extra orbs. The stop count now follows the server's reported orb total, so a run of N stops exactly at N.

#### Changed

- The pachinko log now records the start of a run (selected type, target, available) and a clear finish line with the number of orbs spent, making runs easier to review afterwards.

### v7.35.59 - raid girl skin endless-fight fix

#### Fixed

- **An already-won raid girl no longer traps the bot in an endless troll fight.** After a raid girl reached 100 shards, the post-fight reward was not being read on the battle-result page, so the script never noticed she was finished and kept fighting the same raid troll. The reward popup is now parsed again before the next fight, so the raid selector clears as soon as the girl is complete.
### v7.35.58 - loop-module review (Quest, Contest, Daily Goals, Champion, Place of Power)

#### Fixed

- A locked Place of Power no longer traps the bot in an endless "navigating to powerplace" cycle. When a spot cannot be entered, the bot now records it after the second attempt and moves on instead of retrying every tick. This also removes one of the access-forbidden triggers at its root, since the rapid retry loop was part of what provoked the server.
- A quest step that requires an outfit change no longer spins forever on an unrecognised state. Auto-quest now bails out cleanly and asks you to proceed that screen manually, the same way it already handles other quest steps it cannot complete on its own.
- Multi-tier contest finishes collect their rewards across consecutive ticks instead of doing a full page reload after every single reward.
- Daily-goals detection no longer wipes its own cache when the bot passes through the missions or contests pages. Previously the cached goal list was cleared on those pages, so the pantheon daily-goal booster override could report "no active goal" between two daily-goals visits. The override now fires reliably.

#### Changed

- Internal hardening with no visible behaviour change: number-coercion on the champion auto-team configuration values, defensive error handling in the daily-goals collector, and removal of a small amount of dead code.

### v7.35.57 - StorageHelper review, league timer refresh, expired-event loop fix

#### Fixed

- The league info row in the pInfo overlay refreshes its timer even when the bot cannot fight right now (no challenge tokens, no booster equipped). Earlier versions left the row stuck on "No timer" until the next successful league battle wrote a fresh timer.
- The script no longer reload-loops to an event tab the game has already closed. A registry entry whose game-side end is in the past is now dropped from storage before the trigger fires, so a stale entry left over from a long-running browser tab cannot drive the bot into a permanent /event.html reload cycle.
- A few rare crash paths in the storage layer are no longer fatal:
  - setStoredValue tolerates non-Error throws that previously killed an AutoLoop tick.
  - The kobanUsing master-switch lookup no longer recurses, so a registry typo cannot produce a stack overflow inside every storage read.
  - The storage-quota cleanup no longer writes while it cleans, removing the amplifier when a non-log temp value (e.g. a large HaremSize) hits the quota.

#### Changed

- The 33 AutoLoop pipeline handlers now run in a new user-facing priority sequence: salary first, then shop / boosters / harem-size / missions, the resource collectors, daily goals, champion ticket, place of power, club champion / champion / love raid / troll battle, boss bang, league / season / quest, pantheon, penta drill, labyrinth, generic battle, go-home. Pure data move -- handler behaviour itself is unchanged.
- The settings-storage UI helper file was reorganised internally (lint baseline cleared, edge cases tightened around setting defaults and per-tab toggle, prefix-migration kept dormant but documented). No user-visible behaviour change beyond the points above.
- A long-standing typo in the page-detection storage key (`Setting_unkownPagesList` → `Setting_unknownPagesList`) is corrected. The key only carried diagnostic data, so the rename starts the new key fresh on the next reload.

### v7.35.55 - AutoLoop refactor and league/booster hotfixes

#### Fixed

- League auto-fight chains through all available tokens again. A recent game change had caused the bot to idle for the full token-refresh window after spending only part of the available tokens.
- Auto-equip boosters no longer waits on a redundant market visit after a successful equip; the freshness stamp on the booster status is updated as soon as the equip AJAX completes.
- Quest battles triggered from handleQuest are now properly awaited, removing a small race window between the battle AJAX and the next loop tick.

#### Changed

- AutoLoop internal cleanups: dead module-level busy state and unused ctx.eventParsed field removed, scheduler pipeline only runs on truly idle ticks, ESLint baseline on the AutoLoop core files cleared.

### v7.35.54 - PageHelper review and league timer fix

- **The league info popup shows the timer again.** After a league fight, the popup info row reads the actual remaining time instead of "No timer", the debug panel can reset it, and the AutoLoop no longer re-fires every tick when challenge energy is just above the threshold.
- **Transient missing-DOM states no longer disable the script.** A tab redraw or a slow first paint that briefly drops the game root element used to silently set master and autoLoop to false; the script now tolerates the gap and retries on the next tick.
- **Pop-tab detection is hardened against future game updates** that might ship an empty pop list array or 0-based pop indices, both of which would have produced wrong page IDs.
- Internal: PageHelper was refactored across the five review axes -- pure-read semantics, decoupled from the Place-of-Power module, Activities sub-tab resolution moved to a small data table, ~125 circular dependencies removed. No user-facing behaviour change beyond the items above.

### v7.35.53 - More robust page navigation and reload handling

- **Same race protection as the v7.35.48 PoP fix, now applied across the script.** Direct `location.reload()` and direct URL changes scattered across League battles, Penta Drill battles, Champion ticket purchase, Season opponent refresh + fight, Missions gift refresh, Harem girl popup, Team module equip / unequip, the debug-menu reload buttons, the settings-import path, and the Forbidden-detection backoff now all wait for in-flight game requests to finish before changing the page.
- **Practical effect.** Large accounts and slow connections should hit the rare "Access forbidden" page noticeably less often during automated runs, because the same anti-burst protection that already shields PoP and the post-mutex modules now shields the rest of the navigation flow too.
- Internal: the page-navigation service was rewritten to a smaller, more predictable shape (centralised reload/href helpers, no recursive special-cases, decoupled from the quest module). No user-facing behaviour change there beyond the protection above.

### v7.35.52 - Compatibility fixes for game API changes

- **Background.** Kinkoid recently changed the shape of two game API values that the script reads from the page (the homepage event banners and the girl roster object). Without the script update the script logged TypeError exceptions on every AutoLoop tick.
- **Auto Troll girl priority restored.** The "fight the troll that drops a missing girl" priority quietly fell back to a default troll picker because the new girl roster shape made the lookup throw. The lookup is back, troll-with-girls priority works again on the new API.
- **Quieter console.** The event-banner timer redraw on the home page now skips silently when the banner element is not in the DOM, instead of throwing on every tick. The timer was cosmetic only; no functionality changes.

### v7.35.51 - Internal cleanup, no behaviour change

- Removed the v7.35.50 marker scaffolding around the Champion and Troll race-protection changes now that those modules have been confirmed stable in the wild. Boss Bang keeps its scaffolding for the next time the event is active.

### v7.35.50 - PoP claim race protection extended to Boss Bang, Troll, Champion

- **Same race protection as v7.35.48 PoP fix, now applied to Boss Bang, Troll, and Champion.** Each state-changing action in these modules now serialises through a single mutex and waits for the server to commit before triggering the next request. No behaviour change on small accounts; on large accounts these modules should now also avoid the rare "Access forbidden" page during long auto-collect or auto-fight runs. Applied pro-actively along the lines of the same architectural decision behind v7.35.48.

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

[//]: # (formatting-cleanup)
