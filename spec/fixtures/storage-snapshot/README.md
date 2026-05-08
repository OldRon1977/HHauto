# storage-snapshot fixtures

## Source

- Log: `INPUT/HH_DebugLog_1778140621437.log` (HHAuto v7.35.25 export)
- Capture context: ``HHAuto`` user-script writes a debug snapshot of all
  registered ``HHStoredVars`` keys to a JSON file. Format is a flat
  object with prefix-encoded keys: ``localStorage.<key>`` /
  ``sessionStorage.<key>``.
- This fixture stores 21 keys covering distinct value shapes used as
  inputs for the storage-migration helpers tests.

## File

- `setting-snapshot.json` -- 21 entries selected from the log.

## Selection rationale

One sample per value shape that the storage helpers (`safeJsonParse`,
`isJSON`, `getStoredJSON`) have to survive without crashing:

- boolean strings (e.g. `"false"`, `"true"`)
- integer strings (e.g. `"500000000"`, `"20000"`)
- semicolon-separated lists (e.g. `"B1;B2;B3;B4"`,
  `"1;2;3;4;5;6;7;8;9;10;..."`)
- JSON-array strings (e.g. `"[]"`)
- custom multi-segment strings (e.g.
  `"140-320/Sleep:28800-30400|Active:250-460|..."`)
- sessionStorage temp entries (e.g.
  `"HHAuto_Temp_sandalwoodMaxUsages": "11"`)

## Redactions

None. The HHAuto debug log carries Setting / Temp values only -- no
hero name, no IDs, no auth tokens. The 21 selected keys were
spot-checked against the PII inventory: each value is either a
boolean string, a number string, a delimiter-separated list of fixed
tokens (booster IDs, filter indices), an empty JSON literal, or a
configuration string with no personal identifiers.

## Consumers

- `src/Helper/StorageHelper.ts`:
  - `getStoredValue(key)` -- raw lookup against `HHStoredVars`
  - `getStoredJSON(key, default, reviver?)` -- delegates to
    `safeJsonParse`
- `src/Utils/Utils.ts`:
  - `isJSON(str)` -- regex-based pre-check
  - `safeJsonParse(json, default, reviver?)` -- try/catch wrapper

The schema test reads each entry, sets it on the corresponding
`window.localStorage` / `window.sessionStorage`, then exercises the
reader for that key plus generic edge cases (missing key, empty
string, malformed JSON).

## How to refresh

If a fresh debug log is captured later (e.g. after a new HHAuto
release introduces new keys):

1. Pick the most recent file in `INPUT/HH_DebugLog_*.log`.
2. Re-pick keys that cover the listed value shapes; if a new shape
   class appears (e.g. nested JSON object instead of a primitive
   string), document it here and add a sample.
3. Verify the snapshot still passes the migration spec.
