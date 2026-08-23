import { useEffect, useRef, useState } from 'react'
import { romanizeLines, shouldRomanize } from './romanize'
import { translateLines, detectTargetLanguage } from './translate'

// Fills in the two tracks no free lyrics provider supplies.
//
// Navidrome models `kind=translation` and `kind=pronunciation` as first-class
// lyric tracks and serves them faithfully — but across a 44-track probe of this
// library, LRCLIB / NetEase / QQ Music / KuGou returned neither, on any track.
// That data effectively only exists in Apple Music's TTML. So when the server
// has nothing, these are generated on the client instead: romaji locally via
// kuromoji, translation via a self-hosted LibreTranslate on the LAN.
//
// Both are opt-in per track and start only when the user turns the chip on, so
// the 18 MB dictionary and the translation round-trip are never paid for by
// someone who just wants the karaoke wipe.

const idleState = { values: [], loading: false, error: null, available: false }

export const useLyricsEnrichment = (lyrics, { romanize, translate, targetLang }) => {
  const [romaji, setRomaji] = useState(idleState)
  const [translation, setTranslation] = useState(idleState)

  // Guards against a slow conversion for a previous track landing after the
  // user has already skipped to the next one.
  const tokenRef = useRef(0)

  useEffect(() => {
    tokenRef.current += 1
    setRomaji(idleState)
    setTranslation(idleState)
  }, [lyrics])

  // Changing the target language must discard the previous result. The fetch
  // effect below refuses to run while `values` is populated (that guard is what
  // stops it re-fetching forever), so without this reset a language switch kept
  // showing the old language's text and never requested the new one.
  useEffect(() => {
    tokenRef.current += 1
    setTranslation(idleState)
  }, [targetLang])

  // --- romanization -------------------------------------------------------
  useEffect(() => {
    if (!lyrics || lyrics.hasRomanization) return
    if (!shouldRomanize(lyrics.lines)) return
    if (!romanize || romaji.loading || romaji.values.length) return

    const token = tokenRef.current
    setRomaji({ values: [], loading: true, error: null, available: true })

    romanizeLines(lyrics.lines.map((l) => l.value || ''))
      .then((values) => {
        if (token !== tokenRef.current) return
        setRomaji({ values, loading: false, error: null, available: true })
      })
      .catch((error) => {
        if (token !== tokenRef.current) return
        setRomaji({ values: [], loading: false, error, available: true })
      })
  }, [lyrics, romanize, romaji.loading, romaji.values.length])

  // --- translation --------------------------------------------------------
  useEffect(() => {
    if (!lyrics || lyrics.hasTranslation) return
    if (!translate || translation.loading || translation.values.length) return

    const token = tokenRef.current
    const target = targetLang || detectTargetLanguage()
    setTranslation({ values: [], loading: true, error: null, available: true })

    translateLines(
      lyrics.lines.map((l) => l.value || ''),
      target,
      // The providers report lang as "xxx" (unknown) for every track in this
      // library, so there is no usable hint to pass through — let the server
      // detect it.
      'auto',
    )
      .then((values) => {
        if (token !== tokenRef.current) return
        setTranslation({ values, loading: false, error: null, available: true })
      })
      .catch((error) => {
        if (token !== tokenRef.current) return
        setTranslation({ values: [], loading: false, error, available: true })
      })
  }, [lyrics, translate, targetLang, translation.loading, translation.values.length])

  return {
    romaji,
    translation,
    // Whether the chips should be offered at all for this track.
    canRomanize: !!lyrics && !lyrics.hasRomanization && shouldRomanize(lyrics?.lines),
    canTranslate: !!lyrics && !lyrics.hasTranslation && lyrics.lines.length > 0,
  }
}

export default useLyricsEnrichment
