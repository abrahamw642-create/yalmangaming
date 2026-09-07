/**
 * Regression check for the PC compatibility engine.
 *
 *   npm run test:compat
 *
 * The engine in `src/lib/compatibility.ts` decides what customers are allowed
 * to buy, so it is worth protecting independently of the UI. Node cannot import
 * the TypeScript source directly (its type-stripping mode requires explicit
 * file extensions on relative imports, which the app-style source does not
 * use), so this compiles the two relevant modules to a scratch directory with
 * tsc and runs the assertions against the compiled output.
 */

import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const out = mkdtempSync(join(tmpdir(), "yalman-compat-"));

try {
  execFileSync(
    process.execPath,
    [
      join(root, "node_modules", "typescript", "bin", "tsc"),
      join(root, "src", "lib", "compatibility.ts"),
      join(root, "src", "lib", "types.ts"),
      "--outDir",
      out,
      "--module",
      "commonjs",
      "--target",
      "es2022",
      "--moduleResolution",
      "node",
      "--skipLibCheck",
      "--strict",
    ],
    { stdio: "inherit" },
  );

  copyFileSync(
    join(here, "compatibility-assertions.cjs"),
    join(out, "assertions.cjs"),
  );

  const require = createRequire(join(out, "noop.cjs"));
  require(join(out, "assertions.cjs"));
} finally {
  rmSync(out, { recursive: true, force: true });
}
