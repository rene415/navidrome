import { baseUrl } from '../utils'

// Client-side romanization for Japanese lyrics.
//
// No free lyrics provider in the chain publishes a `pronunciation` track (that
// is effectively Apple Music TTML only), so romaji is generated locally
// instead. kuroshiro + kuromoji need an 18 MB dictionary, which is why every
// part of this module is lazy: nothing is fetched until a track that actually
// contains kanji or kana is opened.

const HAS_KANA = /[぀-ゟ゠-ヿ]/
const HAS_KANJI = /[一-龯]/
// Hangul and CJK-only text is deliberately excluded: kuromoji is a Japanese
// morphological analyzer and produces nonsense for Chinese or Korean.
const HAS_HANGUL = /[가-힯]/

export const looksJapanese = (text) => {
  if (!text) return false
  if (HAS_HANGUL.test(text)) return false
  // Kana is the reliable signal. Bare kanji could equally be Chinese, so it
  // only counts when kana appears somewhere in the same body of text.
  return HAS_KANA.test(text)
}

// Whether a whole lyric is worth romanizing: enough of its lines must look
// Japanese that the extra download is justified.
export const shouldRomanize = (lines) => {
  if (!lines || lines.length === 0) return false
  const sample = lines
    .map((l) => l.value || '')
    .join('')
    .slice(0, 4000)
  return looksJapanese(sample) && (HAS_KANJI.test(sample) || HAS_KANA.test(sample))
}

let converterPromise = null

const loadConverter = () => {
  if (converterPromise) return converterPromise

  converterPromise = (async () => {
    const [kuroshiroMod, analyzerMod] = await Promise.all([
      import('kuroshiro'),
      import('kuroshiro-analyzer-kuromoji'),
    ])
    // Both packages are pre-ESM and interop differently depending on bundler,
    // so unwrap defensively rather than assuming a default export.
    const Kuroshiro = kuroshiroMod.default?.default || kuroshiroMod.default || kuroshiroMod
    const KuromojiAnalyzer =
      analyzerMod.default?.default || analyzerMod.default || analyzerMod

    const instance = new Kuroshiro()
    // The dictionary is served as a static asset out of ui/public, so it must
    // go through baseUrl to survive a subpath deployment.
    await instance.init(new KuromojiAnalyzer({ dictPath: baseUrl('/kuromoji/dict') }))
    return instance
  })().catch((err) => {
    // Let a later attempt retry rather than caching a permanent failure.
    converterPromise = null
    throw err
  })

  return converterPromise
}

// Romanizes an array of line strings, preserving array positions. Returns an
// array of the same length; entries that could not be converted come back ''.
export const romanizeLines = async (values) => {
  const converter = await loadConverter()
  const out = new Array(values.length).fill('')

  for (let i = 0; i < values.length; i++) {
    const value = values[i]
    if (!value || !looksJapanese(value)) continue
    try {
      out[i] = await converter.convert(value, {
        to: 'romaji',
        mode: 'spaced',
        romajiSystem: 'hepburn',
      })
    } catch {
      // One bad line should not sink the whole track.
      out[i] = ''
    }
  }
  return out
}

export default romanizeLines
