import { validateTheme, ThemeValidationError } from './validate'

// Installed-theme storage. localStorage for v1: no server changes, works
// entirely in the UI layer. Themes therefore do not follow a user across
// devices — the same limitation as the lyric overrides. The read/write helpers
// are deliberately the only place that touches storage, so a server backend can
// replace them later without the UI knowing.

const PREFIX = 'nd-theme-store:'

// Installed ids are namespaced so they can never collide with a bundled theme
// key such as `SpotifyTheme`. Bundled themes win by construction rather than by
// precedence rules, which removes a whole class of ambiguity.
export const INSTALLED_PREFIX = 'store:'

export const toInstalledId = (id) => `${INSTALLED_PREFIX}${id}`
export const isInstalledId = (id) =>
  typeof id === 'string' && id.startsWith(INSTALLED_PREFIX)
export const toRawId = (id) =>
  isInstalledId(id) ? id.slice(INSTALLED_PREFIX.length) : id

const storageKey = (rawId) => `${PREFIX}${rawId}`

const safeParse = (raw) => {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// Returns { [installedId]: themeObject } for everything currently installed.
// A record that fails to parse is skipped rather than thrown, so one corrupt
// entry cannot make the whole theme selector unusable.
export const listInstalled = () => {
  const out = {}
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (!key || !key.startsWith(PREFIX)) continue
      const record = safeParse(window.localStorage.getItem(key))
      if (!record || !record.theme || typeof record.theme.themeName !== 'string') {
        continue
      }
      out[toInstalledId(key.slice(PREFIX.length))] = record.theme
    }
  } catch {
    // localStorage unavailable (private mode, disabled): behave as if nothing
    // is installed rather than breaking the selector.
  }
  return out
}

export const getInstalledMeta = (rawId) => {
  try {
    const record = safeParse(window.localStorage.getItem(storageKey(rawId)))
    if (!record) return null
    return {
      id: rawId,
      installedId: toInstalledId(rawId),
      name: record.theme?.themeName,
      author: record.author || '',
      source: record.source || '',
      installedAt: record.installedAt || null,
    }
  } catch {
    return null
  }
}

export const listInstalledMeta = () =>
  Object.keys(listInstalled())
    .map((id) => getInstalledMeta(toRawId(id)))
    .filter(Boolean)

// Validates then persists. Throws ThemeValidationError on bad input so callers
// can show the reason rather than a generic failure.
export const installTheme = (rawId, themeInput, meta = {}) => {
  if (typeof rawId !== 'string' || !/^[a-zA-Z0-9._-]{1,64}$/.test(rawId)) {
    throw new ThemeValidationError(
      'theme id must be 1-64 chars of letters, digits, dot, dash or underscore',
    )
  }
  const theme = validateTheme(themeInput)
  const record = {
    version: 1,
    theme,
    author: typeof meta.author === 'string' ? meta.author : '',
    source: typeof meta.source === 'string' ? meta.source : '',
    installedAt: new Date().toISOString(),
  }
  try {
    window.localStorage.setItem(storageKey(rawId), JSON.stringify(record))
  } catch {
    throw new ThemeValidationError(
      'could not save the theme — browser storage is full or unavailable',
    )
  }
  return toInstalledId(rawId)
}

export const removeTheme = (rawId) => {
  try {
    window.localStorage.removeItem(storageKey(toRawId(rawId)))
  } catch {
    // nothing to do
  }
}

export const isInstalled = (rawId) => {
  try {
    return window.localStorage.getItem(storageKey(toRawId(rawId))) !== null
  } catch {
    return false
  }
}

// --- registry ------------------------------------------------------------
// The registry URL is configuration, not a constant. Upstream is unlikely to
// accept a PR that points Navidrome's UI at a third party's server, so this
// defaults to empty (feature off) and a self-hoster points it wherever they
// like. Ours becomes one option rather than the option.
export const getRegistryUrl = () => {
  try {
    return window.localStorage.getItem('nd-theme-registry') || ''
  } catch {
    return ''
  }
}

export const setRegistryUrl = (url) => {
  try {
    if (url) window.localStorage.setItem('nd-theme-registry', url)
    else window.localStorage.removeItem('nd-theme-registry')
  } catch {
    // ignore
  }
}

export const fetchRegistryIndex = async (url = getRegistryUrl()) => {
  if (!url) throw new Error('no theme registry configured')
  const response = await fetch(url, { credentials: 'omit' })
  if (!response.ok) throw new Error(`registry returned ${response.status}`)
  const index = await response.json()
  if (!index || typeof index !== 'object' || !Array.isArray(index.themes)) {
    throw new Error('registry index is malformed')
  }
  return index.themes
    .filter((t) => t && typeof t.id === 'string' && typeof t.url === 'string')
    .map((t) => ({
      id: t.id,
      name: typeof t.name === 'string' ? t.name : t.id,
      author: typeof t.author === 'string' ? t.author : '',
      description: typeof t.description === 'string' ? t.description : '',
      preview: t.preview && typeof t.preview === 'object' ? t.preview : null,
      url: t.url,
    }))
}

// Fetches one theme from the registry and installs it. Validation happens in
// installTheme, so a hostile or malformed payload never reaches storage.
export const installFromRegistry = async (entry) => {
  const response = await fetch(entry.url, { credentials: 'omit' })
  if (!response.ok) throw new Error(`theme fetch returned ${response.status}`)
  const body = await response.json()
  return installTheme(entry.id, body, {
    author: entry.author,
    source: entry.url,
  })
}

export { ThemeValidationError }
