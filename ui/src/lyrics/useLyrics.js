import { useEffect, useState } from 'react'
import subsonic from '../subsonic'
import { normalizeLyrics } from './normalizeLyrics'
import { getOverride } from './lyricsOverride'

// Lyrics for a track never change between fetches, so a process-lifetime cache
// keyed by track id keeps skipping back and forth in a queue from re-hitting
// the server (and, behind it, the provider chain).
const cache = new Map()
const MAX_CACHE_ENTRIES = 200

const readCache = (trackId) => cache.get(trackId)

const writeCache = (trackId, value) => {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    // Map preserves insertion order, so the first key is the oldest.
    const oldest = cache.keys().next().value
    cache.delete(oldest)
  }
  cache.set(trackId, value)
}

export const useLyrics = (trackId, overrideVersion = 0) => {
  const [state, setState] = useState({
    loading: false,
    lyrics: null,
    error: null,
  })

  useEffect(() => {
    if (!trackId) {
      setState({ loading: false, lyrics: null, error: null })
      return
    }

    // A local override wins over anything the server returns. On a read-only
    // share with an aggressively caching plugin, this is the only way to
    // correct a wrong provider match.
    const override = getOverride(trackId)
    if (override) {
      setState({ loading: false, lyrics: override, error: null })
      return
    }

    if (cache.has(trackId)) {
      setState({ loading: false, lyrics: readCache(trackId), error: null })
      return
    }

    let cancelled = false
    setState({ loading: true, lyrics: null, error: null })

    subsonic
      .getLyricsBySongId(trackId)
      .then((response) => {
        const payload = response?.json?.['subsonic-response']
        if (payload?.status === 'failed') {
          throw new Error(payload?.error?.message || 'subsonic error')
        }
        const lyrics = normalizeLyrics(payload?.lyricsList)
        writeCache(trackId, lyrics)
        if (!cancelled) setState({ loading: false, lyrics, error: null })
      })
      .catch((error) => {
        // A miss is the common case, not an exception worth surfacing loudly:
        // most tracks simply have no lyrics at any provider. Cache the null so
        // we do not re-query on every replay.
        writeCache(trackId, null)
        if (!cancelled) setState({ loading: false, lyrics: null, error })
      })

    return () => {
      cancelled = true
    }
  }, [trackId, overrideVersion])

  return state
}

export const clearLyricsCache = () => cache.clear()

export default useLyrics
