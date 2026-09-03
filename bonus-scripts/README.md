# Bonus scripts

Optional standalone userscripts. None of them are required for HHAuto itself.

| Script | Purpose |
|---|---|
| `HHAuto-Login.user.js` | Auto-fills the ChibiPass login form and clicks the "enter game" button on the game landing page. |
| `HHAuto_debug_inspector.user.js` | Debugging aid for inspecting HHAuto state. |
| `HHAuto_network_sniffer.user.js` | Debugging aid for observing the game's network traffic. |

## Security note: HHAuto-Login

The login script stores your game credentials **in plain text** in the
userscript source. Anyone with access to your browser profile, userscript
manager, or a synced/backed-up copy of either can read them and take over
your account. Use it on private, single-user machines only, never share or
sync the filled-in file, and use a unique password for the game. The
`@match` list is kept to the login page plus the game landing pages on
purpose — remove the domains you do not play, and do not widen the list.

### Manual test plan (after changes to the script)

1. Install the script, fill in `userEmail` / `userPass`.
2. Log out of the game and open the game domain root (e.g. `https://www.hentaiheroes.com/`).
3. The ChibiPass form is served into an iframe of that same page, not as a
   separate redirect. It must be filled and submitted automatically ("Login
   sent" in the console of the `connect.chibipass.com` frame).
4. Back on the landing page, the "enter game" button must be clicked automatically ("Entered the game." in the console).
5. Verify the script does **not** run inside the game (no console entries on `/home.html`).
