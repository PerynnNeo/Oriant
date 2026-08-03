/**
 * Run `next build` / `next start` against a separate output directory so they
 * never clobber the dev server's `.next` (which produces the confusing
 * "__webpack_modules__[moduleId] is not a function" runtime error).
 *
 *   npm run build   →  next build  into .next-build   (local only)
 *   npm start       →  next start  from .next-build   (local only)
 *
 * On a hosted/CI build (Vercel, etc.) there is no dev server to protect and
 * the platform's Next.js builder expects the default `.next`, so the split is
 * disabled there — otherwise Vercel reports ".next was not found". An
 * explicit NEXT_DIST_DIR always wins.
 *
 * Invokes Next's CLI through Node directly (no npx/.cmd shell hop, which
 * Windows refuses to spawn), so it behaves the same on every platform.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import path from "node:path";

const command = process.argv[2];
if (!["build", "start"].includes(command)) {
  console.error("Usage: node scripts/next-prod.mjs <build|start> [...args]");
  process.exit(1);
}

// resolve the installed next package, then its CLI entry point
const require = createRequire(import.meta.url);
let cli;
try {
  const pkgJson = require.resolve("next/package.json");
  const candidate = path.join(path.dirname(pkgJson), "dist", "bin", "next");
  if (!existsSync(candidate)) throw new Error(`not found at ${candidate}`);
  cli = candidate;
} catch (err) {
  console.error("Could not locate the Next.js CLI — run `npm install` first.");
  console.error(String(err));
  process.exit(1);
}

// Hosted/CI builds must use the default `.next`; only split locally.
const isHosted = Boolean(process.env.VERCEL || process.env.CI);
const distDir = process.env.NEXT_DIST_DIR || (isHosted ? "" : ".next-build");

const env = { ...process.env };
if (distDir) env.NEXT_DIST_DIR = distDir;
else delete env.NEXT_DIST_DIR;

const child = spawn(process.execPath, [cli, command, ...process.argv.slice(3)], {
  stdio: "inherit",
  env,
});

child.on("exit", (code, signal) => process.exit(signal ? 1 : code ?? 0));
child.on("error", (err) => {
  console.error(`Failed to run "next ${command}":`, err.message);
  process.exit(1);
});
