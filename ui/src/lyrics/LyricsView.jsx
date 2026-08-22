import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslate } from 'react-admin'
import { useLyrics } from './useLyrics'
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

const LyricsView = ({ audioInstance, trackId }) => {
  const translate = useTranslate()
  const { loading, lyrics } = useLyrics(trackId)

  const [showTranslation, setShowTranslation] = useState(true)
  const [showRomanization, setShowRomanization] = useState(true)

  const rootRef = useRef(null)
  const lineRefs = useRef([])
  const segRefs = useRef([])
  const activeRef = useRef(-1)
  const frameRef = useRef(0)

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
  useEffect(() => {
    activeRef.current = -1
    lineRefs.current = []
    segRefs.current = []
    if (rootRef.current) rootRef.current.scrollTop = 0
  }, [trackId, lyrics])

  const seekTo = useCallback(
    (ms) => {
      if (!audioInstance || ms === null) return
      try {
        audioInstance.currentTime = Math.max(0, ms / 1000)
      } catch {
        // Seeking can throw while the element is still loading; ignore and let
        // the next user action retry.
      }
    },
    [audioInstance],
  )

  useEffect(() => {
    if (!lyrics || !audioInstance || !lyrics.synced) return undefined

    const lines = lyrics.lines
    const offset = lyrics.offsetMs || 0

    const tick = () => {
      frameRef.current = requestAnimationFrame(tick)

      const t = (audioInstance.currentTime || 0) * 1000 - offset
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
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [lyrics, audioInstance, timedSegments])

  if (loading) {
    return <div className="bl-status">{translate('resources.song.lyrics.loading')}</div>
  }

  if (!lyrics) {
    return <div className="bl-status">{translate('resources.song.lyrics.notFound')}</div>
  }

  return (
    <>
      {(lyrics.hasTranslation || lyrics.hasRomanization) && (
        <div className="bl-toolbar">
          {lyrics.hasRomanization && (
            <button
              type="button"
              className="bl-chip"
              aria-pressed={showRomanization}
              onClick={() => setShowRomanization((v) => !v)}
            >
              {translate('resources.song.lyrics.romanization')}
            </button>
          )}
          {lyrics.hasTranslation && (
            <button
              type="button"
              className="bl-chip"
              aria-pressed={showTranslation}
              onClick={() => setShowTranslation((v) => !v)}
            >
              {translate('resources.song.lyrics.translation')}
            </button>
          )}
        </div>
      )}

      <div className="bl-root" ref={rootRef}>
        {lyrics.lines.map((line, lineIndex) => {
          const variants = line.variants.length
            ? line.variants
            : [{ agentId: '', role: '', segments: [{ text: line.value, timed: false }] }]

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
                  {variant.segments.map((seg, segIndex) =>
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
                  )}
                </span>

                {variantIndex === 0 && showRomanization && line.romanization && (
                  <span className="bl-secondary bl-romanization">{line.romanization}</span>
                )}
                {variantIndex === 0 && showTranslation && line.translation && (
                  <span className="bl-secondary bl-translation">{line.translation}</span>
                )}
              </div>
            )
          })
        })}
      </div>
    </>
  )
}

export default LyricsView
