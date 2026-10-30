const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');

// ── Helper: recursive directory copy (dereferences symlinks/junctions) ─────
function copyDir(from, to, ignored = ['node_modules', '.next', '.git', 'dist-desktop', 'win-unpacked']) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (ignored.includes(entry.name)) continue;
    const s = path.join(from, entry.name);
    const d = path.join(to, entry.name);
    try {
      const stat = fs.statSync(s);
      if (stat.isDirectory()) {
        copyDir(s, d, ignored);
      } else {
        fs.copyFileSync(s, d);
      }
    } catch {
      // ignore unreadable/locked temporary files
    }
  }
}

// ── 1. Generate SQLite Prisma client ─────────────────────────────────────────
const sqliteSchema = path.resolve(ROOT, 'packages/database/prisma/schema.sqlite.prisma');
const templateDb   = path.resolve(__dirname, 'template.db');
const localPrismaClientPkg = path.resolve(__dirname, 'node_modules/@prisma/client');
const destGeneratedClient = path.join(localPrismaClientPkg, 'generated-client');

const hasExistingSqliteClient = fs.existsSync(destGeneratedClient) && fs.existsSync(templateDb);

console.log('[prebuild] Step 1 — Checking / Generating SQLite Prisma client...');
let prismaGenerated = false;
try {
  execSync(`npx prisma generate --schema="${sqliteSchema}"`, {
    cwd: ROOT,
    stdio: 'inherit',
  });
  console.log('[prebuild] Prisma client generated.');
  prismaGenerated = true;
} catch (err) {
  if (hasExistingSqliteClient) {
    console.warn('[prebuild] ⚠️  Notice: Root prisma generate skipped (file locked by running dev server). Using existing local SQLite Prisma client.');
  } else {
    console.error('[prebuild] ERROR: prisma generate failed:', err.message);
    process.exit(1);
  }
}

// ── 2. Create template.db ─────────────────────────────────────────────────────
if (prismaGenerated || !fs.existsSync(templateDb)) {
  console.log('[prebuild] Step 2 — Creating template SQLite database...');
  if (fs.existsSync(templateDb)) fs.unlinkSync(templateDb);
  try {
    execSync(`npx prisma db push --skip-generate --schema="${sqliteSchema}"`, {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: `file:${templateDb}` },
    });
    console.log('[prebuild] template.db created at:', templateDb);
  } catch (err) {
    console.error('[prebuild] ERROR: prisma db push failed:', err.message);
    process.exit(1);
  }
} else {
  console.log('[prebuild] Step 2 — Using existing template.db');
}

// ── 3 & 4. Copy & patch Prisma client (only if regenerated) ─────────────────
if (prismaGenerated) {
  const rootPrismaClientPkg = path.resolve(ROOT, 'node_modules/@prisma/client');
  console.log('[prebuild] Step 3 — Copying @prisma/client to local node_modules...');
  if (fs.existsSync(localPrismaClientPkg)) {
    fs.rmSync(localPrismaClientPkg, { recursive: true, force: true });
  }
  copyDir(rootPrismaClientPkg, localPrismaClientPkg);
  console.log('[prebuild] @prisma/client local copy ready.');

  const rootGeneratedClient = path.resolve(ROOT, 'node_modules/.prisma/client');
  console.log('[prebuild] Step 4 — Embedding generated client as generated-client/...');
  if (fs.existsSync(destGeneratedClient)) {
    fs.rmSync(destGeneratedClient, { recursive: true, force: true });
  }
  copyDir(rootGeneratedClient, destGeneratedClient);
  console.log('[prebuild] generated-client/ embedded in local @prisma/client.');

  // Step 5 — Patching local @prisma/client entry points
  console.log('[prebuild] Step 5 — Patching local @prisma/client entry points...');
  const targets = [localPrismaClientPkg];
  const filesToPatch = ['default.js', 'index.js', 'edge.js', 'wasm.js'];
  for (const targetPkg of targets) {
    for (const fname of filesToPatch) {
      const fpath = path.join(targetPkg, fname);
      if (!fs.existsSync(fpath)) continue;
      let content = fs.readFileSync(fpath, 'utf8');
      const original = content;
      content = content
        .replace(/require\('\.prisma\/client\/default'\)/g, "require('./generated-client/default')")
        .replace(/require\('\.prisma\/client\/edge'\)/g, "require('./generated-client/edge')")
        .replace(/require\('\.prisma\/client\/index-browser'\)/g, "require('./generated-client/index-browser')")
        .replace(/require\('\.prisma\/client\/wasm'\)/g, "require('./generated-client/wasm')");
      if (content !== original) {
        fs.writeFileSync(fpath, content);
        console.log(`[prebuild]   ✓ Patched: ${fpath}`);
      }
    }
  }
} else {
  console.log('[prebuild] Steps 3-5 — Preserving validated SQLite Prisma client in desktop package.');
}

// ── 5.5 Copy workspace dependencies: @tally packages & node runtime deps ──────
console.log('[prebuild] Step 5.5 — Ensuring @tally and runtime dependencies are present in desktop...');
const localTallyPkg = path.resolve(__dirname, 'node_modules/@tally');
const packagesToSync = ['api', 'database'];
fs.mkdirSync(localTallyPkg, { recursive: true });
for (const pkgName of packagesToSync) {
  const src = path.resolve(ROOT, 'node_modules/@tally', pkgName);
  const dest = path.resolve(localTallyPkg, pkgName);
  if (fs.existsSync(src)) {
    if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
    copyDir(src, dest);
  }
}
console.log('[prebuild] @tally packages synced.');

const runtimeDeps = ['dotenv', 'express', 'cors'];
for (const dep of runtimeDeps) {
  const src = path.resolve(ROOT, 'node_modules', dep);
  const dest = path.resolve(__dirname, 'node_modules', dep);
  if (fs.existsSync(src) && !fs.existsSync(dest)) {
    copyDir(src, dest);
  }
}

// ── 6. Copy apps/web/out → apps/desktop/web/out ──────────────────────────────
const webSrc  = path.resolve(ROOT, 'apps/web/out');
const webDest = path.resolve(__dirname, 'web/out');

console.log('[prebuild] Step 6 — Copying apps/web/out ...');
if (!fs.existsSync(webSrc)) {
  console.error('[prebuild] ERROR: apps/web/out not found. Run `npm run build` first.');
  process.exit(1);
}
if (fs.existsSync(webDest)) fs.rmSync(webDest, { recursive: true, force: true });
copyDir(webSrc, webDest);
console.log('[prebuild] web/out copied.');

console.log('\n[prebuild] ✅ All prebuild steps complete.\n');
