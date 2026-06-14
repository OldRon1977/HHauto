#!/usr/bin/env node
/**
 * Top-level storage-key gate.
 *
 * Fails when a module evaluates `HHStoredVarPrefixKey` at MODULE TOP LEVEL
 * (outside any function/method/accessor body), e.g.
 *
 *   const KEY = HHStoredVarPrefixKey + TK.something;  // <- crashes
 *
 * Such a statement runs at module-load time. If the module is reached early
 * inside an import cycle before config/HHStoredVars finished initializing, it
 * throws a TDZ ReferenceError ("Cannot access 'HHStoredVarPrefixKey' before
 * initialization") and the whole userscript fails to boot.
 *
 * The safe form computes the key at call time, inside a function:
 *
 *   function key() { return HHStoredVarPrefixKey + TK.something; }
 *
 * Background: lesson zirkulaerer-import-tdz-crash (boot-TDZ on Frank-account,
 * v7.35.50) and the v7.36.9 boot-TDZ fix (BlockRunStore/BlockDisabledState).
 *
 * Usage:
 *   node scripts/check-toplevel-storage-key.mjs          # check mode (CI)
 *   node scripts/check-toplevel-storage-key.mjs --list   # list all top-level hits
 *
 * Exit codes:
 *   0  no top-level usages outside the allowlist
 *   1  top-level usage(s) found (CI must fail)
 *   2  internal error (typescript missing, no files, ...)
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, relative, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const srcRoot = resolve(repoRoot, "src");

const TARGET = "HHStoredVarPrefixKey";

// Files allowed to reference HHStoredVarPrefixKey at module top level.
// Keep this list minimal and justify every entry.
const ALLOWLIST = new Set([
  // Defines the constant itself: every `export const X = HHStoredVarPrefixKey
  // + "..."` here runs after HHStoredVarPrefixKey is declared in the same
  // module, so there is no TDZ risk within this file.
  "src/config/HHStoredVars.ts",
  // FORBIDDEN_COUNT_KEY / FORBIDDEN_LAST_AT_KEY are top level here. This was
  // the original TDZ crash source (issue #1598), fixed in v7.35.48 by the
  // setter pattern: AjaxTracker no longer statically imports ForbiddenBackoff,
  // so this module is only reached via StartService -- late in boot, after
  // config/HHStoredVars has initialized. Accepted weakness (lesson
  // zirkulaerer-import-tdz-crash, rule 4). Do NOT re-add a static
  // AjaxTracker -> ForbiddenBackoff import or the TDZ returns here unguarded.
  "src/Service/ForbiddenBackoff.ts",
]);

function listTsFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listTsFiles(full));
    else if (name.endsWith(".ts")) out.push(full);
  }
  return out;
}

async function main() {
  const listMode = process.argv.includes("--list");
  let ts;
  try {
    ({ default: ts } = await import("typescript"));
  } catch (err) {
    console.error(`[toplevel-key] cannot load typescript: ${err.message}`);
    process.exit(2);
  }

  let files;
  try {
    files = listTsFiles(srcRoot);
  } catch (err) {
    console.error(`[toplevel-key] cannot scan ${srcRoot}: ${err.message}`);
    process.exit(2);
  }
  if (files.length === 0) {
    console.error(`[toplevel-key] no .ts files under ${srcRoot}`);
    process.exit(2);
  }

  const isFunctionLike = (node) =>
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node) ||
    ts.isConstructorDeclaration(node);

  const hits = [];
  for (const file of files) {
    const rel = relative(repoRoot, file).split(sep).join("/");
    const text = readFileSync(file, "utf8");
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.ES2019, true);

    const visit = (node, inFunction, inImport) => {
      let nowInFn = inFunction || isFunctionLike(node);
      let nowInImport = inImport || ts.isImportDeclaration(node) || ts.isExportDeclaration(node);

      if (ts.isIdentifier(node) && node.text === TARGET && !nowInImport) {
        // Skip the defining declaration name itself (LHS of the const).
        const parent = node.parent;
        const isDeclName = parent && ts.isVariableDeclaration(parent) && parent.name === node;
        if (!nowInFn && !isDeclName) {
          const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
          hits.push({ rel, line: line + 1 });
        }
      }
      node.forEachChild((c) => visit(c, nowInFn, nowInImport));
    };
    visit(sf, false, false);
  }

  if (listMode) {
    console.log(`[toplevel-key] ${hits.length} top-level usage(s) of ${TARGET}:`);
    for (const h of hits) console.log(`  ${h.rel}:${h.line}`);
    process.exit(0);
  }

  const violations = hits.filter((h) => !ALLOWLIST.has(h.rel));
  if (violations.length > 0) {
    console.error(`[toplevel-key] FAIL: ${violations.length} top-level usage(s) of ${TARGET} outside the allowlist:`);
    for (const v of violations) console.error(`  + ${v.rel}:${v.line}`);
    console.error(`[toplevel-key] Move the key computation into a function (call-time), e.g.`);
    console.error(`  function key() { return ${TARGET} + TK.something; }`);
    console.error(`[toplevel-key] See lesson zirkulaerer-import-tdz-crash. If a top-level use is`);
    console.error(`[toplevel-key] genuinely safe, add the file to ALLOWLIST with justification.`);
    process.exit(1);
  }

  console.log(`[toplevel-key] OK: no top-level ${TARGET} usage outside the allowlist (${hits.length} allowlisted/none).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(`[toplevel-key] unexpected error: ${err.stack || err.message}`);
  process.exit(2);
});
