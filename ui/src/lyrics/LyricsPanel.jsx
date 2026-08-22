import React from 'react'
import { useTranslate } from 'react-admin'
import LyricsView from './LyricsView'
import './lyricsPanel.css'

// The lyrics panel is deliberately a sibling of <ReactJkMusicPlayer> rather
// than a replacement for its built-in `showLyric` widget: that widget lives in
// the third-party navidrome-music-player package and only understands a flat
// LRC string, which cannot express word-level cues, agents or the
// translation/pronunciation tracks. Overlaying leaves the vendored player
// untouched.
const LyricsPanel = ({ open, onClose, audioInstance, trackId, title, artist }) => {
  const translate = useTranslate()

  if (!open || !trackId) return null

  return (
    <div className="bl-panel" role="dialog" aria-label={translate('resources.song.lyrics.showLyrics')}>
      <div className="bl-panel-head">
        <div className="bl-panel-title">
          <strong>{title}</strong>
          <span>{artist}</span>
        </div>
        <button type="button" className="bl-panel-close" onClick={onClose} aria-label="Close">
          &times;
        </button>
      </div>
      <LyricsView audioInstance={audioInstance} trackId={trackId} />
    </div>
  )
}

export default LyricsPanel
