#!/usr/bin/env node
/**
 * Codemod: rewrite barrel-style imports to direct file imports.
 *
 * Walks every .ts file under src/, examines each import declaration,
 * and resolves any module specifier that points to a folder index.ts
 * ("barrel"). For each named import, it traces the symbol back to the
 * actual source file via ts-morph type-checker analysis, then rewrites
 * the import declaration to reference that file directly.
 *
 * Side-effect-only imports (no named bindings) and namespace imports
 * (import * as X) on barrels are reported but not rewritten -- they
 * carry intent that direct imports cannot replicate, and the repo has
 * none of them today.
 *
 * Default exports on barrels do not exist in this repo (every barrel
 * is "export * from"), so default-import handling is left out.
 *
 * Usage:
 *   node scripts/drop-barrel-imports.mjs
 *
 * Idempotent: rerunning on a fully-migrated tree is a no-op.
 */
import { Project, SyntaxKind, Node } from "ts-morph";
import { dirname, relative, resolve, posix } from "node:path";
import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const project = new Project({
  tsConfigFilePath: resolve(repoRoot, "tsconfig.json"),
  skipAddingFilesFromTsConfig: false,
});

const checker = project.getTypeChecker();

/** Returns true if the resolved module path is a folder index.ts (a barrel). */
function isBarrelModule(sourceFile) {
  if (!sourceFile) return false;
  const fp = sourceFile.getFilePath();
  return fp.endsWith("/index.ts") || fp.endsWith("\\index.ts");
}

/** Compute a relative import path (no .ts extension, posix slashes). */
function makeRelativeSpecifier(fromFile, toFile) {
  const fromDir = dirname(fromFile);
  let rel = relative(fromDir, toFile).replace(/\\/g, "/");
  rel = rel.replace(/\.ts$/, "");
  if (!rel.startsWith(".")) rel = "./" + rel;
  return rel;
}

/**
 * For each named import on a barrel, find the actual source file via the
 * symbol\'s declaration. Group by source file so we can write one new import
 * declaration per resolved file.
 */
function resolveNamedBindings(importDecl, namedBindings) {
  /** @type {Map<string, Array<{name: string, alias?: string, isTypeOnly: boolean}>>} */
  const byFile = new Map();
  /** @type {Array<{name: string, reason: string}>} */
  const unresolved = [];

  for (const named of namedBindings) {
    const nameNode = named.getNameNode();
    const symbol = checker.getSymbolAtLocation(nameNode);
    if (!symbol) {
      unresolved.push({ name: named.getName(), reason: "no symbol" });
      continue;
    }
    const aliased = symbol.getAliasedSymbol() ?? symbol;
    const decls = aliased.getDeclarations();
    if (decls.length === 0) {
      unresolved.push({ name: named.getName(), reason: "no declarations" });
      continue;
    }
    const decl = decls[0];
    const declFile = decl.getSourceFile().getFilePath();
    if (declFile.endsWith("/index.ts") || declFile.endsWith("\\index.ts")) {
      unresolved.push({ name: named.getName(), reason: `aliased symbol still points at barrel ${declFile}` });
      continue;
    }
    if (!byFile.has(declFile)) byFile.set(declFile, []);
    byFile.get(declFile).push({
      name: named.getName(),
      alias: named.getAliasNode()?.getText(),
      isTypeOnly: named.isTypeOnly(),
    });
  }
  return { byFile, unresolved };
}

let totalRewritten = 0;
let totalSkipped = 0;
const skippedReports = [];

for (const sf of project.getSourceFiles()) {
  const filePath = sf.getFilePath();
  if (!filePath.includes(`${posix.sep}src${posix.sep}`) && !filePath.includes("\\src\\")) continue;
  if (filePath.endsWith("/index.ts") || filePath.endsWith("\\index.ts")) continue;

  let dirty = false;
  for (const importDecl of [...sf.getImportDeclarations()]) {
    const moduleSrc = importDecl.getModuleSpecifierSourceFile();
    if (!isBarrelModule(moduleSrc)) continue;

    const named = importDecl.getNamedImports();
    const ns = importDecl.getNamespaceImport();
    const def = importDecl.getDefaultImport();

    if (!named.length && !ns && !def) {
      // side-effect import on a barrel - none expected, but log if found
      skippedReports.push(`${filePath}: side-effect import from barrel ${importDecl.getModuleSpecifierValue()}`);
      totalSkipped++;
      continue;
    }
    if (ns) {
      skippedReports.push(`${filePath}: namespace import (import * as ${ns.getText()}) from barrel ${importDecl.getModuleSpecifierValue()}`);
      totalSkipped++;
      continue;
    }
    if (def) {
      skippedReports.push(`${filePath}: default import (${def.getText()}) from barrel ${importDecl.getModuleSpecifierValue()}`);
      totalSkipped++;
      continue;
    }

    const { byFile, unresolved } = resolveNamedBindings(importDecl, named);
    if (unresolved.length) {
      for (const u of unresolved) {
        skippedReports.push(`${filePath}: cannot resolve ${u.name} (${u.reason})`);
      }
      totalSkipped++;
      continue;
    }
    const isTypeOnlyDecl = importDecl.isTypeOnly();

    // Build new import statements grouped by target file.
    const newImports = [];
    for (const [declFile, items] of byFile) {
      const spec = makeRelativeSpecifier(filePath, declFile);
      newImports.push({
        moduleSpecifier: spec,
        isTypeOnly: isTypeOnlyDecl,
        namedImports: items.map((it) => ({
          name: it.name,
          alias: it.alias,
          isTypeOnly: it.isTypeOnly && !isTypeOnlyDecl,
        })),
      });
    }

    // Sort by module specifier for stable output.
    newImports.sort((a, b) => a.moduleSpecifier.localeCompare(b.moduleSpecifier));

    // Replace original import with the first new one (in place), insert the rest after.
    const originalIndex = importDecl.getChildIndex();
    importDecl.remove();
    sf.insertImportDeclarations(originalIndex, newImports);
    dirty = true;
    totalRewritten++;
  }

  if (dirty) {
    sf.saveSync();
  }
}

console.log(`Rewrote ${totalRewritten} barrel import declarations.`);
console.log(`Skipped ${totalSkipped} cases:`);
for (const line of skippedReports) console.log(`  - ${line}`);
