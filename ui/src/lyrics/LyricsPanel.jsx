import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslate } from 'react-admin'
import LyricsView from './LyricsView'
import LyricsDock from './LyricsDock'
import { useLyrics } from './useLyrics'
import { useLyricsEnrichment } from './useLyricsEnrichment'
import { detectTargetLanguage } from './translate'
import { getOverrideText, setOverrideText } from './lyricsOverride'
import './lyricsPanel.css'

// The lyrics panel is deliberately a sibling of <ReactJkMusicPlayer> rather
// than a replacement for its built-in `showLyric` widget: that widget lives in
// the third-party navidrome-music-player package and only understands a flat
// LRC string, which cannot express word-level cues, agents or the
// translation/pronunciation tracks. Overlaying leaves the vendored player
// untouched.
//
// Fetching and enrichment live HERE rather than in LyricsView so the dock can
// drive them; LyricsView is a pure renderer.

const offsetKey = (trackId) => `bl-offset:${trackId}`

const readOffset = (trackId) => {
  if (!trackId) return 0
  const raw = window.localStorage.getItem(offsetKey(trackId))
  const n = raw === null ? NaN : Number(raw)
  return Number.isFinite(n) ? n : 0
}

const LyricsPanel = ({ open, onClose, audioInstance, trackId, title, artist, cover }) => {
  const translate = useTranslate()

  // Bumping this re-runs the lyrics lookup so a saved override takes effect
  // immediately, without needing to reopen the panel or change track.
  const [overrideVersion, setOverrideVersion] = useState(0)
  const { loading, lyrics } = useLyrics(open ? trackId : null, overrideVersion)

  const overrideText = trackId ? getOverrideText(trackId) : ''
  const hasOverride = !!overrideText

  const saveOverride = useCallback(
    (text) => {
      setOverrideText(trackId, text)
      setOverrideVersion((v) => v + 1)
    },
    [trackId],
  )

  const removeOverride = useCallback(() => {
    setOverrideText(trackId, '')
    setOverrideVersion((v) => v + 1)
  }, [trackId])

  const [showTranslation, setShowTranslation] = useState(false)
  const [showRomanization, setShowRomanization] = useState(false)
  const [targetLang, setTargetLang] = useState(detectTargetLanguage)
  const [offsetMs, setOffsetMs] = useState(0)
  const [speed, setSpeed] = useState(1)

  const { romaji, translation, canRomanize, canTranslate } = useLyricsEnrichment(lyrics, {
    romanize: showRomanization,
    translate: showTranslation,
    targetLang,
  })

  // Per-track sync nudge. Providers are frequently a beat early or late, and a
  // track that is consistently off is otherwise unusable.
  useEffect(() => {
    setOffsetMs(readOffset(trackId))
  }, [trackId])

  const applyOffset = useCallback(
    (next) => {
      const clamped = Math.max(-10000, Math.min(10000, next))
      setOffsetMs(clamped)
      if (!trackId) return
      if (clamped === 0) window.localStorage.removeItem(offsetKey(trackId))
      else window.localStorage.setItem(offsetKey(trackId), String(clamped))
    },
    [trackId],
  )

  const applySpeed = useCallback(
    (next) => {
      setSpeed(next)
      if (audioInstance) audioInstance.playbackRate = next
    },
    [audioInstance],
  )

  // Escape closes the panel. Without this the overlay is a trap: it covers the
  // song list and the only way out is the small × in the corner.
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    // Capture phase so the player's own global hotkeys cannot swallow it first.
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onClose])

  const searchQuery = useMemo(
    () => [artist, title].filter(Boolean).join(' '),
    [artist, title],
  )

  if (!open || !trackId) return null

  return (
    <div
      className="bl-panel"
      role="dialog"
      aria-modal="false"
      aria-label={translate('resources.song.lyrics.showLyrics')}
    >
      {/* Blurred album art. Sits behind a translucent scrim so the library
       * underneath stays readable - the panel tints the app rather than
       * blacking it out. */}
      {cover && (
        <div
          className="bl-panel__art"
          style={{ backgroundImage: `url(${cover})` }}
          aria-hidden="true"
        />
      )}
      <div className="bl-panel__scrim" aria-hidden="true" />

      <div className="bl-panel__content">
        <div className="bl-panel-head">
          <div className="bl-panel-title">
            <strong>{title}</strong>
            <span>{artist}</span>
          </div>
          <button
            type="button"
            className="bl-panel-close"
            onClick={onClose}
            aria-label={translate('ra.action.close')}
          >
            &times;
          </button>
        </div>

        {(translation.loading || romaji.loading) && (
          <div className="bl-panel__status" role="status" aria-live="polite">
            <span className="bl-panel__spinner" aria-hidden="true" />
            {translation.loading
              ? translate('resources.song.lyrics.translatingTo', {
                  lang: targetLang,
                })
              : translate('resources.song.lyrics.romanizing')}
          </div>
        )}

        <LyricsView
          audioInstance={audioInstance}
          trackId={trackId}
          lyrics={lyrics}
          loading={loading}
          offsetMs={offsetMs}
          showTranslation={showTranslation}
          showRomanization={showRomanization}
          romajiValues={romaji.values}
          translationValues={translation.values}
        />

        <LyricsDock
          canRomanize={canRomanize}
          canTranslate={canTranslate}
          showRomanization={showRomanization}
          showTranslation={showTranslation}
          onToggleRomanization={() => setShowRomanization((v) => !v)}
          onToggleTranslation={() => setShowTranslation((v) => !v)}
          targetLang={targetLang}
          onTargetLang={setTargetLang}
          offsetMs={offsetMs}
          onOffset={applyOffset}
          speed={speed}
          onSpeed={applySpeed}
          romajiLoading={romaji.loading}
          translationLoading={translation.loading}
          searchQuery={searchQuery}
          overrideText={overrideText}
          hasOverride={hasOverride}
          onSaveOverride={saveOverride}
          onClearOverride={removeOverride}
        />
      </div>
    </div>
  )
}

export default LyricsPanel
