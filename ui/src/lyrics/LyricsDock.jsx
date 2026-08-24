import React, { useEffect, useRef, useState } from 'react'
import { useTranslate } from 'react-admin'
import './lyricsDock.css'

// Bottom-right pill control, modelled on the Better Lyrics dock we inspected:
// a compact always-visible row that expands into a panel. Their dock carried a
// source cycler, a source picker showing "1/2", and a timing offset stepper.
//
// We cannot offer the source picker - Subsonic's getLyricsBySongId returns only
// the winning result, and providerMode:"sync" discards the losing providers
// before Navidrome ever sees them. So the slot is spent on the controls we can
// actually honour, and the layout leaves room for more.

const LANGUAGES = [
  ['en', 'English'],
  ['es', 'Español'],
  ['ja', '日本語'],
  ['fr', 'Français'],
  ['de', 'Deutsch'],
  ['ko', '한국어'],
  ['zh-Hans', '中文'],
]

const SPEEDS = [0.75, 0.9, 1, 1.1, 1.25, 1.5]

const LyricsDock = ({
  canRomanize,
  canTranslate,
  showRomanization,
  showTranslation,
  onToggleRomanization,
  onToggleTranslation,
  targetLang,
  onTargetLang,
  offsetMs,
  onOffset,
  speed,
  onSpeed,
  romajiLoading,
  translationLoading,
  searchQuery,
  overrideText,
  hasOverride,
  onSaveOverride,
  onClearOverride,
}) => {
  const translate = useTranslate()
  const [open, setOpen] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const rootRef = useRef(null)

  // Clicking anywhere outside collapses the dock. Without this the panel stays
  // open over the lyrics until you happen to hit the trigger again.
  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false)
        setShowHelp(false)
      }
    }
    // Escape collapses the dock first, so it does not close the whole panel
    // out from under someone who only meant to dismiss this menu.
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
        setShowHelp(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  const offsetLabel = `${offsetMs > 0 ? '+' : ''}${(offsetMs / 1000).toFixed(1)}s`

  return (
    <div className={`bl-dock ${open ? 'bl-dock--open' : ''}`} ref={rootRef}>
      {open && (
        <div className="bl-dock__panel">
          {/* --- language / secondary tracks --- */}
          {(canTranslate || canRomanize) && (
            <div className="bl-dock__group">
              <div className="bl-dock__label">
                {translate('resources.song.lyrics.language')}
              </div>
              <div className="bl-dock__row">
                {canRomanize && (
                  <button
                    type="button"
                    className="bl-dock__chip"
                    aria-pressed={showRomanization}
                    onClick={onToggleRomanization}
                  >
                    {translate('resources.song.lyrics.romanization')}
                    {romajiLoading ? ' …' : ''}
                  </button>
                )}
                {canTranslate && (
                  <button
                    type="button"
                    className="bl-dock__chip"
                    aria-pressed={showTranslation}
                    onClick={onToggleTranslation}
                  >
                    {translationLoading
                      ? translate('resources.song.lyrics.translating')
                      : translate('resources.song.lyrics.translation')}
                  </button>
                )}
              </div>
              {canTranslate && showTranslation && (
                <select
                  className="bl-dock__select"
                  value={targetLang}
                  onChange={(e) => onTargetLang(e.target.value)}
                  aria-label={translate('resources.song.lyrics.language')}
                >
                  {LANGUAGES.map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* --- timing offset: providers are often consistently early/late --- */}
          <div className="bl-dock__group">
            <div className="bl-dock__label">
              {translate('resources.song.lyrics.sync')}
              <button
                type="button"
                className="bl-dock__info"
                aria-expanded={showHelp}
                aria-label={translate('resources.song.lyrics.syncHelp')}
                onClick={() => setShowHelp((v) => !v)}
              >
                i
              </button>
            </div>
            {showHelp && (
              <p className="bl-dock__help">
                {translate('resources.song.lyrics.syncHelp')}
              </p>
            )}
            <div className="bl-dock__stepper">
              <button type="button" onClick={() => onOffset(offsetMs - 250)} aria-label="-0.25s">
                −
              </button>
              <span className="bl-dock__value">{offsetLabel}</span>
              <button type="button" onClick={() => onOffset(offsetMs + 250)} aria-label="+0.25s">
                +
              </button>
              {offsetMs !== 0 && (
                <button type="button" className="bl-dock__reset" onClick={() => onOffset(0)}>
                  {translate('resources.song.lyrics.reset')}
                </button>
              )}
            </div>
          </div>

          {/* --- playback speed --- */}
          <div className="bl-dock__group">
            <div className="bl-dock__label">
              {translate('resources.song.lyrics.speed')}
            </div>
            <div className="bl-dock__row">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="bl-dock__chip bl-dock__chip--tight"
                  aria-pressed={speed === s}
                  onClick={() => onSpeed(s)}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>

          {/* --- local override: the only fix for a wrong match on a
                   read-only share, where sidecars cannot be written --- */}
          <div className="bl-dock__group">
            <div className="bl-dock__label">
              {translate('resources.song.lyrics.fix')}
              {hasOverride && <span className="bl-dock__pill">●</span>}
            </div>
            {!editing ? (
              <div className="bl-dock__row">
                <button
                  type="button"
                  className="bl-dock__chip"
                  onClick={() => {
                    setDraft(overrideText || '')
                    setEditing(true)
                  }}
                >
                  {hasOverride
                    ? translate('resources.song.lyrics.editOverride')
                    : translate('resources.song.lyrics.addOverride')}
                </button>
                {hasOverride && (
                  <button
                    type="button"
                    className="bl-dock__chip"
                    onClick={onClearOverride}
                  >
                    {translate('resources.song.lyrics.removeOverride')}
                  </button>
                )}
              </div>
            ) : (
              <>
                <textarea
                  className="bl-dock__textarea"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={translate('resources.song.lyrics.overridePlaceholder')}
                  spellCheck={false}
                  rows={7}
                />
                <p className="bl-dock__help">
                  {translate('resources.song.lyrics.overrideHelp')}
                </p>
                <div className="bl-dock__row">
                  <button
                    type="button"
                    className="bl-dock__chip"
                    aria-pressed
                    onClick={() => {
                      onSaveOverride(draft)
                      setEditing(false)
                    }}
                  >
                    {translate('ra.action.save')}
                  </button>
                  <button
                    type="button"
                    className="bl-dock__chip"
                    onClick={() => setEditing(false)}
                  >
                    {translate('ra.action.cancel')}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* --- look the track up at the sources ---
               Deliberately phrased as "look up", not "this came from X":
               Subsonic's getLyricsBySongId does not carry provider
               attribution, and providerMode:"sync" discards the losing
               providers before Navidrome ever sees them, so which one actually
               supplied a given lyric is genuinely unknown to the client.
               LRCLIB is listed first because it is community-editable, so a
               wrong or untimed lyric can be corrected at the source. */}
          {searchQuery && (
            <div className="bl-dock__group">
              <div className="bl-dock__label">
                {translate('resources.song.lyrics.sources')}
              </div>
              <div className="bl-dock__row">
                {[
                  ['LRCLIB', `https://lrclib.net/search?q=${encodeURIComponent(searchQuery)}`],
                  ['NetEase', `https://music.163.com/#/search/m/?s=${encodeURIComponent(searchQuery)}`],
                  ['Genius', `https://genius.com/search?q=${encodeURIComponent(searchQuery)}`],
                ].map(([name, href]) => (
                  <a
                    key={name}
                    className="bl-dock__chip bl-dock__chip--link"
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {name}
                  </a>
                ))}
              </div>
              <p className="bl-dock__help">
                {translate('resources.song.lyrics.sourcesHelp')}
              </p>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        className="bl-dock__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={translate('resources.song.lyrics.options')}
      >
        <span className="bl-dock__trigger-dot" />
        {translate('resources.song.lyrics.options')}
        {offsetMs !== 0 && <span className="bl-dock__badge">{offsetLabel}</span>}
      </button>
    </div>
  )
}

export default LyricsDock
