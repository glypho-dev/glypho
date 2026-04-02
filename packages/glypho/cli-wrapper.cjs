#!/usr/bin/env node
// Thin proxy to @glypho/cli — works when @glypho/cli is co-installed.
import("@glypho/cli/dist/index.js").catch(e => {
  if (e.code === "ERR_MODULE_NOT_FOUND") {
    console.error("glypho CLI requires @glypho/cli. Install it with:\n  npm install @glypho/cli");
    process.exit(1);
  }
  throw e;
});
