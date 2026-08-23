// Translation for lyric lines via a self-hosted LibreTranslate instance.
//
// No free lyrics provider in the chain supplies a `translation` track, so the
// text is translated on demand instead. The endpoint is expected to be
// self-hosted on the same network, so lyric lines never leave it — that is the
// whole reason for preferring LibreTranslate over a hosted API here.

// Must NOT be localhost. This code runs in the visitor's browser, not on the
// server, so 'localhost' resolves to whatever machine is viewing the page and
// the request dies with a connection refused. Default to the host serving
// Navidrome, which is where the LibreTranslate container also lives.
const DEFAULT_ENDPOINT = `${window.location.protocol}//${window.location.hostname}:5555`
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
//
// Lines are sent INDIVIDUALLY, not as one array, and this is deliberate.
// LibreTranslate runs language detection once per request: pass an array with
// source:"auto" and it detects a single language for the whole batch and
// applies it to every element. Bilingual lyrics are common - a Japanese song
// with English hooks is the normal case here - and batching made every English
// line get force-translated *from* Japanese, yielding mangled output or silent
// passthrough. Verified against the running instance: a plainly English string
// inside a Japanese batch was reported as detected "ja".
//
// One request per line costs more round-trips, so they run with bounded
// concurrency. A line already in the target language is returned untouched.
const CONCURRENCY = 6

const translateOne = async (endpoint, text, target) => {
  const response = await fetch(`${endpoint}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: text, source: 'auto', target, format: 'text' }),
  })
  if (!response.ok) throw new Error(`translate failed: ${response.status}`)
  const data = await response.json()

  const detected = Array.isArray(data.detectedLanguage)
    ? data.detectedLanguage[0]
    : data.detectedLanguage
  const lang = detected && detected.language

  // Already in the target language: keep the original rather than round-trip
  // it through the model, which mangles short lines.
  if (lang && target && lang.split('-')[0] === target.split('-')[0]) return ''

  const out = Array.isArray(data.translatedText) ? data.translatedText[0] : data.translatedText
  return typeof out === 'string' ? out : ''
}

export const translateLines = async (values, target, sourceHint) => {
  const nonEmpty = values.map((v, i) => [i, v]).filter(([, v]) => v && v.trim())
  if (nonEmpty.length === 0) return new Array(values.length).fill('')

  const trackKey = hash(values.join('\n'))
  const cached = readCache(trackKey, target)
  if (cached && cached.length === values.length) return cached

  const endpoint = getEndpoint().replace(/\/+$/, '')
  const out = new Array(values.length).fill('')

  let cursor = 0
  const worker = async () => {
    for (;;) {
      const next = cursor++
      if (next >= nonEmpty.length) return
      const [index, text] = nonEmpty[next]
      try {
        out[index] = await translateOne(endpoint, text, target)
      } catch {
        // One failed line must not sink the whole track.
        out[index] = ''
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, nonEmpty.length) }, worker),
  )

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
