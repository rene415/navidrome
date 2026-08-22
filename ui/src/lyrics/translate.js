// Translation for lyric lines via a self-hosted LibreTranslate instance.
//
// No free lyrics provider in the chain supplies a `translation` track, so the
// text is translated on demand instead. The endpoint is expected to be
// self-hosted on the same network, so lyric lines never leave it — that is the
// whole reason for preferring LibreTranslate over a hosted API here.

const DEFAULT_ENDPOINT = 'http://localhost:5555'
const CACHE_PREFIX = 'bl-tr:'
const CACHE_LIMIT = 400

export const getEndpoint = () =>
  window.localStorage.getItem('bl-translate-endpoint') || DEFAULT_ENDPOINT

export const setEndpoint = (value) => {
  if (value) window.localStorage.setItem('bl-translate-endpoint', value)
  else window.localStorage.removeItem('bl-translate-endpoint')
}

// Small non-cryptographic hash (FNV-1a). Only needs to be stable and cheap;
// it keys a local cache, nothing more.
const hash = (str) => {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

const cacheKey = (trackKey, target) => `${CACHE_PREFIX}${target}:${trackKey}`

const readCache = (trackKey, target) => {
  try {
    const raw = window.localStorage.getItem(cacheKey(trackKey, target))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const writeCache = (trackKey, target, values) => {
  try {
    const keys = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (k && k.startsWith(CACHE_PREFIX)) keys.push(k)
    }
    // Cheap bound on cache growth: drop a chunk once over the limit rather
    // than tracking exact LRU order across sessions.
    if (keys.length >= CACHE_LIMIT) {
      keys.slice(0, Math.ceil(CACHE_LIMIT / 4)).forEach((k) => window.localStorage.removeItem(k))
    }
    window.localStorage.setItem(cacheKey(trackKey, target), JSON.stringify(values))
  } catch {
    // Storage full or disabled: translation still works, just uncached.
  }
}

export const detectTargetLanguage = () => {
  const nav = (navigator.language || 'en').split('-')[0]
  return nav || 'en'
}

// Translates an array of line strings, preserving array positions.
// Blank entries are skipped and returned blank.
export const translateLines = async (values, target, sourceHint) => {
  const nonEmpty = values.map((v, i) => [i, v]).filter(([, v]) => v && v.trim())
  if (nonEmpty.length === 0) return new Array(values.length).fill('')

  const trackKey = hash(values.join('\n'))
  const cached = readCache(trackKey, target)
  if (cached && cached.length === values.length) return cached

  const endpoint = getEndpoint().replace(/\/+$/, '')
  const payload = {
    q: nonEmpty.map(([, v]) => v),
    source: sourceHint || 'auto',
    target,
    format: 'text',
  }

  const response = await fetch(`${endpoint}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`translate failed: ${response.status}`)
  }

  const data = await response.json()
  // LibreTranslate mirrors the request shape: an array in, an array out.
  const translated = Array.isArray(data.translatedText)
    ? data.translatedText
    : [data.translatedText]

  const out = new Array(values.length).fill('')
  nonEmpty.forEach(([originalIndex], i) => {
    out[originalIndex] = translated[i] || ''
  })

  writeCache(trackKey, target, out)
  return out
}

export const checkAvailable = async () => {
  try {
    const endpoint = getEndpoint().replace(/\/+$/, '')
    const r = await fetch(`${endpoint}/languages`, { method: 'GET' })
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

export default translateLines
