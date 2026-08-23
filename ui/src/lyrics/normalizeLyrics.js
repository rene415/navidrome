// Turns an OpenSubsonic songLyrics v2 payload (getLyricsBySongId?enhanced=true)
// into a flat render model.
//
// Two things about the wire format drive the shape of this file:
//
//  1. cueLine[] is a PARALLEL array, not nested inside line[]. Each entry
//     carries `index`, pointing back at line[index]. A single index may appear
//     more than once when several agents (duet voices, background vocals) sing
//     the same line, so the join is one-to-many.
//
//  2. cue.byteStart/byteEnd are offsets into the UTF-8 *bytes* of the cue
//     line's value, which diverge from JavaScript string indices for anything
//     outside the BMP or, more relevantly here, for CJK text. Slicing with them
//     directly corrupts non-Latin lyrics, so they are mapped to string indices
//     before use.

const MAIN = 'main'
const TRANSLATION = 'translation'
const PRONUNCIATION = 'pronunciation'

// Builds byteOffset -> JS string index lookup for a UTF-8 encoded string.
// The map is one entry longer than the byte length so an exclusive end offset
// at the very end of the string resolves to str.length.
const utf8IndexMap = (str) => {
  const map = []
  let byte = 0
  let i = 0
  while (i < str.length) {
    const cp = str.codePointAt(i)
    const units = cp > 0xffff ? 2 : 1
    const bytes = cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4
    for (let b = 0; b < bytes; b++) map[byte + b] = i
    byte += bytes
    i += units
  }
  map[byte] = str.length
  return map
}

// Splits a cue line into an ordered run of segments covering the whole string.
// Timed segments come from cues; the untimed text between them (spaces,
// punctuation) is preserved verbatim so the rendered line reads identically to
// the plain value.
const buildSegments = (value, cues) => {
  if (!value) return []
  if (!cues || cues.length === 0) {
    return [{ text: value, timed: false }]
  }

  const map = utf8IndexMap(value)
  const resolve = (byteOffset, fallback) => {
    const idx = map[byteOffset]
    return typeof idx === 'number' ? idx : fallback
  }

  const timed = []
  for (const cue of cues) {
    if (cue == null || typeof cue.start !== 'number') continue
    const from = resolve(cue.byteStart, -1)
    const to = resolve(cue.byteEnd + 1, -1)
    // Trust the offsets only when they describe a sane, in-bounds range whose
    // text matches the cue's own value; otherwise fall back to the cue value.
    const usable =
      from >= 0 && to > from && to <= value.length && value.slice(from, to) === cue.value
    timed.push({
      start: cue.start,
      end: typeof cue.end === 'number' ? cue.end : null,
      text: cue.value,
      from: usable ? from : null,
      to: usable ? to : null,
    })
  }

  if (timed.length === 0) return [{ text: value, timed: false }]

  // If any offset was unusable we cannot reliably interleave gap text, so emit
  // the cues alone separated by single spaces.
  if (timed.some((t) => t.from === null)) {
    const segments = []
    timed.forEach((t, i) => {
      if (i > 0) segments.push({ text: ' ', timed: false })
      segments.push({ text: t.text, timed: true, start: t.start, end: t.end })
    })
    return segments
  }

  timed.sort((a, b) => a.from - b.from)

  const segments = []
  let cursor = 0
  for (const t of timed) {
    if (t.from > cursor) {
      segments.push({ text: value.slice(cursor, t.from), timed: false })
    }
    segments.push({ text: t.text, timed: true, start: t.start, end: t.end })
    cursor = t.to
  }
  if (cursor < value.length) {
    segments.push({ text: value.slice(cursor), timed: false })
  }
  return segments
}

// How long a line plausibly takes to sing, when no cue data says so.
// Roughly 95ms per character, clamped to a sane range. Only ever used as an
// upper bound against the next line's start, so it can never push a line past
// its successor.
const estimateSungMs = (text) => {
  const chars = (text || '').trim().length
  if (!chars) return 1200
  return Math.min(8000, Math.max(900, chars * 95))
}

const kindOf = (lyric) => {
  const kind = (lyric.kind || '').trim()
  return kind === '' ? MAIN : kind
}

// Aligns a secondary track (translation / romanization) to the main lines.
// Equal line counts are the common case and align by index. Otherwise, when
// both sides are synced, each main line takes the secondary line whose start is
// nearest within tolerance. Anything else is left unaligned rather than guessed.
const alignSecondary = (mainLines, secondary) => {
  if (!secondary || !secondary.line || secondary.line.length === 0) return []

  const values = secondary.line.map((l) => (l && l.value) || '')

  if (values.length === mainLines.length) return values

  if (!secondary.synced) return []

  const TOLERANCE_MS = 1200
  return mainLines.map((line) => {
    if (typeof line.start !== 'number') return ''
    let best = ''
    let bestDelta = Infinity
    for (const candidate of secondary.line) {
      if (!candidate || typeof candidate.start !== 'number') continue
      const delta = Math.abs(candidate.start - line.start)
      if (delta < bestDelta) {
        bestDelta = delta
        best = candidate.value || ''
      }
    }
    return bestDelta <= TOLERANCE_MS ? best : ''
  })
}

export const normalizeLyrics = (lyricsList) => {
  const tracks = (lyricsList && lyricsList.structuredLyrics) || []
  if (tracks.length === 0) return null

  const main = tracks.find((t) => kindOf(t) === MAIN) || tracks[0]
  if (!main || !main.line || main.line.length === 0) return null

  const translation = tracks.find((t) => kindOf(t) === TRANSLATION)
  const romanization = tracks.find((t) => kindOf(t) === PRONUNCIATION)

  const agents = main.agents || []
  const roleById = new Map(agents.map((a) => [a.id, a.role]))

  // Group cue lines by the main-line index they belong to.
  const cuesByIndex = new Map()
  for (const cueLine of main.cueLine || []) {
    if (!cueLine) continue
    const list = cuesByIndex.get(cueLine.index) || []
    list.push(cueLine)
    cuesByIndex.set(cueLine.index, list)
  }

  const lines = main.line.map((line, index) => {
    const cueLines = cuesByIndex.get(index) || []
    const variants = cueLines.map((cl) => ({
      agentId: cl.agentId || '',
      role: roleById.get(cl.agentId) || '',
      start: typeof cl.start === 'number' ? cl.start : null,
      end: typeof cl.end === 'number' ? cl.end : null,
      value: cl.value || '',
      segments: buildSegments(cl.value || '', cl.cue),
    }))

    const start =
      typeof line.start === 'number'
        ? line.start
        : variants.length && variants[0].start !== null
          ? variants[0].start
          : null

    const end = variants.reduce(
      (acc, v) => (v.end !== null && (acc === null || v.end > acc) ? v.end : acc),
      null,
    )

    return {
      index,
      start,
      end,
      value: line.value || '',
      variants,
      agentId: variants.length ? variants[0].agentId : '',
      translation: '',
      romanization: '',
    }
  })

  // Fill missing line ends.
  //
  // Snapping a line's end to the next line's start (the obvious approach) is
  // wrong for line-level-only lyrics: it means every line is treated as sung
  // right up until the next one begins, so the computed silence between them is
  // always exactly zero and a 45-second instrumental break becomes invisible.
  // That silently affected every track without word cues - about a third of the
  // library. Estimate the sung duration instead, bounded by the next start.
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].end !== null) continue
    const nextStart = i + 1 < lines.length ? lines[i + 1].start : null
    if (lines[i].start === null) {
      lines[i].end = nextStart
      continue
    }
    const estimated = lines[i].start + estimateSungMs(lines[i].value)
    lines[i].end =
      typeof nextStart === 'number' ? Math.min(nextStart, estimated) : estimated
  }

  const translationValues = alignSecondary(lines, translation)
  const romanizationValues = alignSecondary(lines, romanization)
  lines.forEach((line, i) => {
    line.translation = translationValues[i] || ''
    line.romanization = romanizationValues[i] || ''
  })

  const hasWordTiming = lines.some((l) =>
    l.variants.some((v) => v.segments.some((s) => s.timed)),
  )

  return {
    synced: !!main.synced,
    hasWordTiming,
    hasTranslation: translationValues.some(Boolean),
    hasRomanization: romanizationValues.some(Boolean),
    offsetMs: typeof main.offset === 'number' ? main.offset : 0,
    lang: main.lang || '',
    displayArtist: main.displayArtist || '',
    displayTitle: main.displayTitle || '',
    agents,
    lines,
  }
}

export const __testables = { utf8IndexMap, buildSegments, alignSecondary }

export default normalizeLyrics
