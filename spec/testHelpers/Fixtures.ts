import * as fs from "fs";
import * as path from "path";

/**
 * Loader for static JSON fixtures under spec/fixtures/<modulePath>/<name>.json.
 *
 * Synchronous on purpose: Jest test setup runs in Node, not in the browser,
 * and a synchronous read keeps tests easy to reason about.
 *
 * @param modulePath  Subdirectory under spec/fixtures (e.g. "league").
 * @param name        Fixture file basename without the .json extension.
 * @returns           Parsed JSON content as `unknown`. Callers narrow the type.
 */
export function loadFixture(modulePath: string, name: string): unknown {
    const fixturePath = path.join(__dirname, "..", "fixtures", modulePath, `${name}.json`);
    const raw = fs.readFileSync(fixturePath, "utf-8");
    return JSON.parse(raw);
}
