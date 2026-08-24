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

// Client-side romanization is DISABLED.
//
// It worked, but only by downloading the full kuromoji dictionary into the
// browser: 16.96 MB gzipped, 95.61 MB uncompressed, decompressed and turned
// into a trie ON THE MAIN THREAD. That starves the requestAnimationFrame loop
// and visibly stalls the karaoke wipe while it loads - and it serves ~54 of
// 34,950 tracks (0.15%) of this library.
//
// Neither provider-side option covers it either. Measured 2026-08-24:
//   - LRCLIB's API exposes no romanization field at all (only plainLyrics,
//     syncedLyrics, lyricsfile and metadata).
//   - nd-lyrics' includeRomanization/includeTranslations returned 0 of 6 on
//     CJK tracks across lrclib/netease/qqmusic/kugou. Those flags sit beside
//     mediaUserToken and storefront in the manifest - they are Apple Music only.
//
// The code is left intact rather than deleted: the plan is to precompute
// romaji server-side (kuromoji works perfectly in Node) and serve it as a
// `pronunciation` track, which the renderer already understands. Flip this to
// true only if the dictionary ever moves off the main thread.
const ROMANIZATION_ENABLED = false

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
    if (!ROMANIZATION_ENABLED) return
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
    // A server-supplied pronunciation track still renders; only the local
    // kuromoji path is switched off.
    canRomanize:
      ROMANIZATION_ENABLED && !!lyrics && !lyrics.hasRomanization && shouldRomanize(lyrics?.lines),
    canTranslate: !!lyrics && !lyrics.hasTranslation && lyrics.lines.length > 0,
  }
}

export default useLyricsEnrichment
