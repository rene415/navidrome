// The single validation chokepoint for any theme that did not ship in the
// bundle. Everything installed from a registry, a file, or a paste goes through
// here and nowhere else.
//
// v1 policy is CURATED-ONLY: we review every theme in our registry, so this does
// not attempt to sanitize hostile CSS. It enforces the structural rules that
// keep a theme *data* rather than *code*, which is the part that must never be
// relaxed. When community submissions open, the property allow-list and url()
// blocking belong here too — one function to harden, not a scattering of
// assumptions across the UI.

// Ceilings chosen to be far above any real theme (the largest bundled theme is
// a few hundred lines) while bounding pathological input.
const MAX_BYTES = 512 * 1024
const MAX_DEPTH = 24
const MAX_STYLESHEET_BYTES = 256 * 1024

// Top-level keys a theme may define. Anything else is rejected rather than
// ignored, so a theme relying on an unsupported key fails loudly at install
// time instead of silently doing nothing.
const ALLOWED_TOP_LEVEL = new Set([
  'themeName',
  'palette',
  'typography',
  'overrides',
  'props',
  'shape',
  'player',
  'spacing',
])

const ALLOWED_PLAYER = new Set(['theme', 'stylesheet'])

export class ThemeValidationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ThemeValidationError'
  }
}

const fail = (msg) => {
  throw new ThemeValidationError(msg)
}

// Depth-first structural scan. The critical rule is the function check: a theme
// containing a function is executable code, and "install a theme" must never
// mean "run a stranger's code".
const scan = (value, depth, path) => {
  if (depth > MAX_DEPTH) fail(`too deeply nested at ${path}`)

  const t = typeof value
  if (value === null) return
  if (t === 'string' || t === 'number' || t === 'boolean') return

  if (t === 'function') fail(`functions are not allowed (at ${path})`)
  if (t === 'symbol' || t === 'bigint' || t === 'undefined') {
    fail(`unsupported value type "${t}" at ${path}`)
  }

  if (Array.isArray(value)) {
    value.forEach((v, i) => scan(v, depth + 1, `${path}[${i}]`))
    return
  }

  // Reject anything that is not a plain object: class instances, Date, Map and
  // friends do not survive JSON transport anyway, and their prototypes are a
  // way to smuggle behaviour past the function check.
  const proto = Object.getPrototypeOf(value)
  if (proto !== Object.prototype && proto !== null) {
    fail(`only plain objects are allowed (at ${path})`)
  }
  for (const key of Object.keys(value)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      fail(`forbidden key "${key}" at ${path}`)
    }
    scan(value[key], depth + 1, path ? `${path}.${key}` : key)
  }
}

export const validateTheme = (input) => {
  if (typeof input === 'string') {
    if (input.length > MAX_BYTES) fail('theme is too large')
    try {
      input = JSON.parse(input)
    } catch {
      fail('not valid JSON')
    }
  }

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    fail('a theme must be a JSON object')
  }

  scan(input, 0, '')

  if (typeof input.themeName !== 'string' || !input.themeName.trim()) {
    fail('themeName is required and must be a non-empty string')
  }
  if (input.themeName.length > 64) fail('themeName is too long')

  for (const key of Object.keys(input)) {
    if (!ALLOWED_TOP_LEVEL.has(key)) fail(`unsupported top-level key "${key}"`)
  }

  if (input.player !== undefined) {
    if (typeof input.player !== 'object' || input.player === null) {
      fail('player must be an object')
    }
    for (const key of Object.keys(input.player)) {
      if (!ALLOWED_PLAYER.has(key)) fail(`unsupported player key "${key}"`)
    }
    const sheet = input.player.stylesheet
    if (sheet !== undefined) {
      if (typeof sheet !== 'string') fail('player.stylesheet must be a string')
      if (sheet.length > MAX_STYLESHEET_BYTES) fail('player.stylesheet is too large')
    }
  }

  // Normalised copy: strips any non-enumerable or prototype trickery that
  // survived the scan, and guarantees what we persist is plain JSON.
  return JSON.parse(JSON.stringify(input))
}

export const __limits = { MAX_BYTES, MAX_DEPTH, MAX_STYLESHEET_BYTES }
export default validateTheme
