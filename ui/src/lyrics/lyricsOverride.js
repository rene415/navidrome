// Local lyric overrides.
//
// The music share is read-only, so `.lrc` sidecars can never be written next to
// the audio (Navidrome resolves sidecars against the media file's own library
// path — a file anywhere else is never looked for). The plugin also caches
// aggressively, so a wrong provider match sticks effectively forever.
//
// A client-side override is therefore the ONLY way to correct a bad match on
// this kind of setup. Overrides are stored raw so they can be re-parsed and
// edited later, and they take precedence over anything the server returns.

const PREFIX = 'bl-override:'

const key = (trackId) => `${PREFIX}${trackId}`

export const getOverrideText = (trackId) => {
  if (!trackId) return ''
  try {
    return window.localStorage.getItem(key(trackId)) || ''
  } catch {
    return ''
  }
}

export const setOverrideText = (trackId, text) => {
  if (!trackId) return
  try {
    if (text && text.trim()) window.localStorage.setItem(key(trackId), text)
    else window.localStorage.removeItem(key(trackId))
  } catch {
    // Storage full or disabled: the override simply does not persist.
  }
}

export const clearOverride = (trackId) => setOverrideText(trackId, '')

export const listOverrides = () => {
  const out = []
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (k && k.startsWith(PREFIX)) out.push(k.slice(PREFIX.length))
    }
  } catch {
    // ignore
  }
  return out
}

// LRC metadata headers: [ar:], [ti:], [al:], [by:], [offset:], [length:] etc.
// These are not lyrics and must not become lines. [offset:] is honoured.
const META_TAG = /^\s*\[([a-zA-Z]+):([^\]]*)\]\s*$/

// [mm:ss.xx] or [mm:ss:xx] - a line may carry several, meaning a repeated line.
const LINE_TAG = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g
// <mm:ss.xx> - enhanced LRC word timing.
const WORD_TAG = /<(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?>/g

const toMs = (m, s, frac) => {
  let ms = Number(m) * 60000 + Number(s) * 1000
  if (frac !== undefined && frac !== null && frac !== '') {
    // Two digits means centiseconds, three means milliseconds.
    ms += frac.length === 3 ? Number(frac) : Number(frac.padEnd(2, '0')) * 10
  }
  return ms
}

// Splits an enhanced-LRC line body into timed word segments. Text before the
// first <tag> is untimed and rides along as a plain segment.
const parseWordSegments = (body) => {
  WORD_TAG.lastIndex = 0
  const marks = []
  let m
  while ((m = WORD_TAG.exec(body)) !== null) {
    marks.push({ at: m.index, len: m[0].length, ms: toMs(m[1], m[2], m[3]) })
  }
  if (marks.length === 0) return null

  const segments = []
  const lead = body.slice(0, marks[0].at)
  if (lead) segments.push({ text: lead, timed: false })

  for (let i = 0; i < marks.length; i++) {
    const from = marks[i].at + marks[i].len
    const to = i + 1 < marks.length ? marks[i + 1].at : body.length
    const text = body.slice(from, to)
    if (!text) continue
    segments.push({
      text,
      timed: true,
      start: marks[i].ms,
      end: i + 1 < marks.length ? marks[i + 1].ms : null,
    })
  }
  return segments.length ? segments : null
}

// Parses user-pasted lyrics into the SAME render model normalizeLyrics
// produces, so the renderer needs no special case. Accepts enhanced LRC
// (word-level), plain LRC (line-level) and untimed plain text.
export const parseUserLyrics = (text) => {
  if (!text || !text.trim()) return null

  const rawLines = text.replace(/\r\n?/g, '\n').split('\n')
  const parsed = []
  let fileOffsetMs = 0

  for (const raw of rawLines) {
    // Metadata header, not a lyric line.
    const meta = META_TAG.exec(raw)
    if (meta) {
      if (meta[1].toLowerCase() === 'offset') {
        const n = parseInt(meta[2].trim(), 10)
        if (Number.isFinite(n)) fileOffsetMs = n
      }
      continue
    }

    LINE_TAG.lastIndex = 0
    const stamps = []
    let m
    while ((m = LINE_TAG.exec(raw)) !== null) stamps.push(toMs(m[1], m[2], m[3]))

    const body = raw.replace(LINE_TAG, '')
    const wordSegments = parseWordSegments(body)
    const plain = body.replace(WORD_TAG, '').trim()

    if (stamps.length === 0) {
      // Skip metadata headers like [ar:...] that left nothing behind, but keep
      // genuinely blank lines out too.
      if (!plain) continue
      parsed.push({ start: null, value: plain, segments: wordSegments })
      continue
    }
    for (const start of stamps) {
      parsed.push({ start, value: plain, segments: wordSegments })
    }
  }

  if (parsed.length === 0) return null

  const timed = parsed.filter((l) => l.start !== null)
  const synced = timed.length > 0
  if (synced) {
    parsed.sort((a, b) => {
      if (a.start === null && b.start === null) return 0
      if (a.start === null) return 1
      if (b.start === null) return -1
      return a.start - b.start
    })
  }

  const lines = parsed.map((l, index) => {
    const segments = l.segments || [{ text: l.value, timed: false }]
    return {
      index,
      start: l.start,
      end: null,
      value: l.value,
      variants: [
        {
          agentId: '',
          role: '',
          start: l.start,
          end: null,
          value: l.value,
          segments,
        },
      ],
      agentId: '',
      translation: '',
      romanization: '',
    }
  })

  // Fill line ends from the next line's start so the wipe has something to
  // decay against, and close open word segments the same way.
  for (let i = 0; i < lines.length; i++) {
    if (i + 1 < lines.length) lines[i].end = lines[i + 1].start
    lines[i].variants[0].end = lines[i].end
    const segs = lines[i].variants[0].segments
    for (let j = 0; j < segs.length; j++) {
      if (segs[j].timed && segs[j].end === null) {
        const next = segs.slice(j + 1).find((sg) => sg.timed)
        segs[j].end = next ? next.start : lines[i].end
      }
    }
  }

  return {
    synced,
    hasWordTiming: lines.some((l) => l.variants[0].segments.some((s) => s.timed)),
    hasTranslation: false,
    hasRomanization: false,
    offsetMs: fileOffsetMs,
    lang: 'xxx',
    displayArtist: '',
    displayTitle: '',
    agents: [],
    lines,
    isOverride: true,
  }
}

export const getOverride = (trackId) => parseUserLyrics(getOverrideText(trackId))

export default getOverride
