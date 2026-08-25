// Generates a publishable theme registry from the bundled Navidrome themes.
//
// This doubles as format validation: every theme is put through the SAME
// validateTheme() the store uses at install time. A theme that fails here would
// fail for a user, so the generator refuses to publish it rather than shipping
// something the client will reject.
//
// Usage:  node build-registry.mjs <ui-src-dir> <out-dir>

import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const uiSrc = resolve(process.argv[2])
const outDir = resolve(process.argv[3])
const themesDir = join(uiSrc, 'themes')
const tmpDir = join(outDir, '.tmp')
const esbuild = join(uiSrc, '..', 'node_modules', '.bin', 'esbuild')

rmSync(outDir, { recursive: true, force: true })
mkdirSync(tmpDir, { recursive: true })

// Themes import their .css.js companions, so each needs bundling before it can
// be evaluated standalone.
const bundle = (file) => {
  const out = join(tmpDir, file.replace(/\.js$/, '.mjs'))
  execFileSync(esbuild, [
    join(themesDir, file),
    '--bundle',
    '--format=esm',
    '--platform=node',
    '--log-level=error',
    `--outfile=${out}`,
  ])
  return out
}

// Colour strip shown in the browse list, so the UI need not fetch every theme.
const preview = (t) => {
  const dark = t.palette?.type === 'dark'
  return {
    bg: t.palette?.background?.default || (dark ? '#303030' : '#fafafa'),
    surface: t.palette?.background?.paper || (dark ? '#424242' : '#ffffff'),
    accent: t.palette?.primary?.main || '#888888',
    text: t.palette?.text?.primary || (dark ? '#ffffff' : '#111111'),
  }
}

// Only actual theme modules. The themes folder also holds the registration
// index, the useCurrentTheme hook and test files, none of which are themes.
const skip = new Set(['index.js', 'useCurrentTheme.js'])
const files = readdirSync(themesDir)
  .filter(
    (f) =>
      f.endsWith('.js') &&
      !f.endsWith('.css.js') &&
      !f.endsWith('.test.js') &&
      !skip.has(f),
  )
  .sort()

// The validator is the store's own, imported rather than reimplemented - the
// whole point is that publish-time and install-time rules cannot drift.
const validatorSrc = join(themesDir, 'store', 'validate.js')
const validatorOut = join(tmpDir, 'validate.mjs')
execFileSync(esbuild, [validatorSrc, '--bundle', '--format=esm', '--platform=node',
  '--log-level=error', `--outfile=${validatorOut}`])
const { validateTheme } = await import(pathToFileURL(validatorOut).href)

const entries = []
const rejected = []

for (const file of files) {
  const id = file.replace(/\.js$/, '')
  let theme
  try {
    const mod = await import(pathToFileURL(bundle(file)).href)
    theme = mod.default
  } catch (e) {
    rejected.push({ id, reason: 'could not evaluate: ' + String(e.message).slice(0, 90) })
    continue
  }
  // JSON round-trip first: functions vanish here, which is exactly what the
  // registry format requires. If a theme depended on them at runtime it would
  // fail validation below rather than silently ship broken.
  let plain
  try {
    plain = JSON.parse(JSON.stringify(theme))
  } catch (e) {
    rejected.push({ id, reason: 'not serialisable: ' + String(e.message).slice(0, 90) })
    continue
  }
  try {
    const clean = validateTheme(plain)
    writeFileSync(join(outDir, `${id}.json`), JSON.stringify(clean, null, 2) + '\n')
    entries.push({
      id,
      name: clean.themeName,
      author: 'Navidrome contributors',
      description: `${clean.palette?.type === 'dark' ? 'Dark' : 'Light'} theme`,
      preview: preview(clean),
      url: `./${id}.json`,
    })
  } catch (e) {
    rejected.push({ id, reason: e.message })
  }
}

writeFileSync(
  join(outDir, 'index.json'),
  JSON.stringify({ version: 1, themes: entries }, null, 2) + '\n',
)
rmSync(tmpDir, { recursive: true, force: true })

console.log(`published ${entries.length} of ${files.length} themes -> ${outDir}`)
if (rejected.length) {
  console.log('\nrejected (would also fail at install time):')
  for (const r of rejected) console.log(`  ${r.id}: ${r.reason}`)
}
