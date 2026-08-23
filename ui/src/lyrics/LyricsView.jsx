import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslate } from 'react-admin'
import './lyrics.css'

// How far ahead of the active line to keep the scroll position, as a fraction
// of the viewport height. Keeping the active line above centre leaves the
// upcoming lines visible, which is what makes it readable while singing along.
const SCROLL_ANCHOR = 0.42

// Binary search for the last line whose start is <= t.
const findActiveIndex = (lines, t) => {
  let lo = 0
  let hi = lines.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const start = lines[mid].start
    if (start === null || start > t) {
      hi = mid - 1
    } else {
      found = mid
      lo = mid + 1
    }
  }
  return found
}

const LyricsView = ({
  audioInstance,
  trackId,
  lyrics,
  loading,
  offsetMs = 0,
  showTranslation,
  showRomanization,
  romajiValues = [],
  translationValues = [],
}) => {
  const translate = useTranslate()

  const rootRef = useRef(null)
  const lineRefs = useRef([])
  // Secondary (translation / romanization) lines share this map, keyed
  // "sec-<line>-<kind>". They have no per-word timing, so they are swept as a
  // whole line across the line's duration.
  const segRefs = useRef([])
  const activeRef = useRef(-1)

  // Instrumental breaks. A silent stretch between sung lines currently shows
  // nothing at all, which reads as the lyrics having stalled. Better Lyrics
  // renders a marker row for exactly this. Anything shorter than this is not
  // worth interrupting the flow for.
  const GAP_MS = 4500

  const renderItems = useMemo(() => {
    if (!lyrics) return []
    const items = []
    lyrics.lines.forEach((line, i) => {
      const prev = i > 0 ? lyrics.lines[i - 1] : null
      const from = prev ? prev.end : 0
      if (line.start !== null && from !== null && line.start - from >= GAP_MS) {
        items.push({ kind: 'gap', key: `gap-${i}`, start: from, end: line.start, at: i })
      }
      items.push({ kind: 'line', key: `line-${i}`, line, index: i })
    })
    return items
  }, [lyrics])

  // Flat list of every timed segment with the line it belongs to, so the frame
  // loop can walk one array instead of descending the tree each tick.
  const timedSegments = useMemo(() => {
    if (!lyrics) return []
    const out = []
    lyrics.lines.forEach((line, lineIndex) => {
      line.variants.forEach((variant, variantIndex) => {
        variant.segments.forEach((seg, segIndex) => {
          if (seg.timed) {
            out.push({
              key: `${lineIndex}-${variantIndex}-${segIndex}`,
              lineIndex,
              start: seg.start,
              end: seg.end,
            })
          }
        })
      })
    })
    return out
  }, [lyrics])

  // Reset per-track scroll and cached indices.
  //
  // Deliberately does NOT clear lineRefs/segRefs. React populates ref callbacks
  // during render, which happens BEFORE effects run - clearing them here wiped
  // every reference the frame loop depends on, so the wipe never advanced and
  // no line was ever marked active. React already nulls the callback for any
  // element it unmounts, so stale keys clean themselves up.
  useEffect(() => {
    activeRef.current = -1
    if (rootRef.current) rootRef.current.scrollTop = 0
  }, [trackId, lyrics])

  const seekTo = useCallback(
    (ms) => {
      if (!audioInstance || ms === null) return
      try {
        audioInstance.currentTime = Math.max(0, (ms + offsetMs) / 1000)
      } catch {
        // Seeking can throw while the element is still loading; ignore and let
        // the next user action retry.
      }
    },
    [audioInstance, offsetMs],
  )

  useEffect(() => {
    if (!lyrics || !audioInstance || !lyrics.synced) return undefined

    // Force the first frame to re-evaluate every line. Without this a sync
    // nudge that does not happen to cross a line boundary leaves the classes
    // stale, which reads as "the offset did nothing".
    activeRef.current = -2

    const lines = lyrics.lines
    const gapList = renderItems.filter((it) => it.kind === 'gap')
    const baseOffset = lyrics.offsetMs || 0

    // Frame id and cancellation are LOCAL to this effect run, not a shared ref.
    // offsetMs is a dependency, so nudging the sync stepper tears this effect
    // down and rebuilds it on every click. With a single shared ref, a fast
    // series of clicks let one run cancel another run's pending frame and the
    // loop died outright - 344 segments rendered and nothing driving them.
    let raf = 0
    let cancelled = false

    const tick = () => {
      if (cancelled) return
      raf = requestAnimationFrame(tick)

      // User nudge is added on top of any offset the lyric itself declares.
      const t = (audioInstance.currentTime || 0) * 1000 - baseOffset - offsetMs
      const active = findActiveIndex(lines, t)

      if (active !== activeRef.current) {
        const previous = activeRef.current
        activeRef.current = active

        lineRefs.current.forEach((el, i) => {
          if (!el) return
          el.style.setProperty('--bl-d', String(Math.abs(i - active)))
          el.classList.toggle('bl-active', i === active)
          el.classList.toggle('bl-past', active >= 0 && i < active)
        })

        const target = lineRefs.current[active]
        if (target && rootRef.current && active !== previous) {
          const root = rootRef.current
          const top =
            target.offsetTop - root.clientHeight * SCROLL_ANCHOR + target.clientHeight / 2
          root.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
        }
      }

      // Advance the wipe on every timed segment of the active line. Segments on
      // other lines are pinned to fully sung or fully unsung, which costs one
      // property write and keeps back-seeks correct.
      for (const seg of timedSegments) {
        const el = segRefs.current[seg.key]
        if (!el) continue

        let p
        if (seg.lineIndex !== active) {
          p = seg.lineIndex < active ? 1 : 0
        } else if (t < seg.start) {
          p = 0
        } else if (seg.end === null || seg.end <= seg.start) {
          p = 1
        } else {
          p = Math.min(1, Math.max(0, (t - seg.start) / (seg.end - seg.start)))
        }

        el.style.setProperty('--bl-p', p.toFixed(3))
        el.dataset.lit = p > 0 && p < 1 ? '1' : '0'
      }

      // Lines with no word timing get a whole-line sweep rather than a bare
      // colour switch, so a line-sync-only track (about a third of the library)
      // reads as deliberate instead of broken next to word-timed ones.
      for (let i = 0; i < lines.length; i++) {
        const el = segRefs.current[`whole-${i}`]
        if (!el) continue
        const line = lines[i]
        let p
        if (i !== active) {
          p = i < active ? 1 : 0
        } else if (line.start === null || line.end === null || line.end <= line.start) {
          p = 1
        } else {
          p = Math.min(1, Math.max(0, (t - line.start) / (line.end - line.start)))
        }
        el.style.setProperty('--bl-p', p.toFixed(3))
      }

      // Instrumental markers count down through the silence.
      for (const g of gapList) {
        const el = segRefs.current[g.key]
        if (!el) continue
        let p = 0
        if (t >= g.end) p = 1
        else if (t > g.start) p = (t - g.start) / (g.end - g.start)
        el.style.setProperty('--bl-p', p.toFixed(3))
        el.classList.toggle('bl-gap--active', t >= g.start && t < g.end)
      }

      // Sweep the secondary lines across the whole line duration. Translations
      // are generated per line and carry no word timing, so a single sweep is
      // the honest maximum precision available for them.
      for (let i = 0; i < lines.length; i++) {
        const romajiEl = segRefs.current[`sec-${i}-romaji`]
        const translationEl = segRefs.current[`sec-${i}-translation`]
        if (!romajiEl && !translationEl) continue
        const line = lines[i]
        let p
        if (i !== active) {
          p = i < active ? 1 : 0
        } else if (line.start === null || line.end === null || line.end <= line.start) {
          p = 1
        } else {
          p = Math.min(1, Math.max(0, (t - line.start) / (line.end - line.start)))
        }
        const v = p.toFixed(3)
        if (romajiEl) romajiEl.style.setProperty('--bl-p', v)
        if (translationEl) translationEl.style.setProperty('--bl-p', v)
      }
    }

    raf = requestAnimationFrame(tick)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [lyrics, audioInstance, timedSegments, renderItems, offsetMs])

  if (loading) {
    return <div className="bl-status">{translate('resources.song.lyrics.loading')}</div>
  }

  if (!lyrics) {
    return <div className="bl-status">{translate('resources.song.lyrics.notFound')}</div>
  }

  return (
    <div className="bl-root" ref={rootRef}>
      {renderItems.map((item) => {
        if (item.kind === 'gap') {
          return (
            <div
              key={item.key}
              className="bl-gap"
              ref={(el) => {
                segRefs.current[item.key] = el
              }}
              onClick={() => seekTo(item.end)}
              aria-hidden="true"
            >
              <span className="bl-gap__dot" />
              <span className="bl-gap__dot" />
              <span className="bl-gap__dot" />
            </div>
          )
        }

        const { line, index: lineIndex } = item
        const variants = line.variants.length
          ? line.variants
          : [{ agentId: '', role: '', segments: [{ text: line.value, timed: false }] }]

        const romajiText = line.romanization || romajiValues[lineIndex]
        const translationText = line.translation || translationValues[lineIndex]

        return variants.map((variant, variantIndex) => {
          const hasTiming = variant.segments.some((s) => s.timed)
          const classes = ['bl-line']
          if (!hasTiming) classes.push('bl-lineonly')
          if (variant.role === 'bg') classes.push('bl-bg')

          return (
            <div
              key={`${lineIndex}-${variantIndex}`}
              className={classes.join(' ')}
              ref={(el) => {
                // Only the first variant carries the line's scroll/active
                // state; extra agent variants ride along with it.
                if (variantIndex === 0) lineRefs.current[lineIndex] = el
              }}
              onClick={() => seekTo(line.start)}
              style={{ '--bl-d': Math.abs(lineIndex) }}
            >
              <span>
                {hasTiming ? (
                  variant.segments.map((seg, segIndex) =>
                    seg.timed ? (
                      <span
                        key={segIndex}
                        className="bl-seg"
                        ref={(el) => {
                          segRefs.current[`${lineIndex}-${variantIndex}-${segIndex}`] = el
                        }}
                      >
                        {seg.text}
                      </span>
                    ) : (
                      <span key={segIndex}>{seg.text}</span>
                    ),
                  )
                ) : (
                  // No word timing: sweep the whole line over its duration so
                  // it reads as deliberate rather than broken.
                  <span
                    className="bl-seg"
                    ref={(el) => {
                      if (variantIndex === 0) segRefs.current[`whole-${lineIndex}`] = el
                    }}
                  >
                    {variant.segments.map((seg) => seg.text).join('')}
                  </span>
                )}
              </span>

              {variantIndex === 0 && showRomanization && romajiText && (
                <span
                  className="bl-secondary bl-romanization bl-seg"
                  ref={(el) => {
                    segRefs.current[`sec-${lineIndex}-romaji`] = el
                  }}
                >
                  {romajiText}
                </span>
              )}
              {variantIndex === 0 && showTranslation && translationText && (
                <span
                  className="bl-secondary bl-translation bl-seg"
                  ref={(el) => {
                    segRefs.current[`sec-${lineIndex}-translation`] = el
                  }}
                >
                  {translationText}
                </span>
              )}
            </div>
          )
        })
      })}
    </div>
  )
}

export default LyricsView
