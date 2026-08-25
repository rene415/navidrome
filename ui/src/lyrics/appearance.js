// Appearance settings for the lyrics view.
//
// Every option here is a CSS custom property swap rather than new rendering
// logic - the view already drives colour and size from tokens, so this module
// only decides which values those tokens carry.
//
// The defaults reproduce the previous hard-coded appearance exactly (white
// highlight, unscaled type, 0.62em translation at 0.82 alpha). Opening the
// panel with no saved settings must look identical to before this existed.

const STORAGE_KEY = 'bl-appearance'

// Highlight presets carry an RGB TRIPLE, not a finished colour, because the
// view composes alpha on top of it: sung words sit at 0.74 and the syllable
// currently sounding rises to 1.0. Storing "rgb(...)" or a hex would force
// each preset to restate that relationship, and the moment one preset got it
// wrong the sweep would go invisible in that preset only. As a triple, the
// alpha maths stays in the stylesheet and holds for every preset by
// construction.
export const HIGHLIGHTS = [
  { id: 'white', rgb: '255, 255, 255' },
  { id: 'ice', rgb: '125, 211, 252' },
  { id: 'mint', rgb: '110, 231, 168' },
  { id: 'gold', rgb: '252, 211, 77' },
  { id: 'rose', rgb: '244, 164, 200' },
]

// Multiplies the view's fluid clamp() rather than replacing it, so the type
// stays responsive to viewport width at every size.
export const TEXT_SIZES = [
  { id: 's', scale: 0.85 },
  { id: 'm', scale: 1 },
  { id: 'l', scale: 1.15 },
  { id: 'xl', scale: 1.32 },
]

// Relative to the lyric line, so the translation scales with the base size
// instead of drifting out of proportion when the base changes.
export const TRANSLATION_SIZES = [
  { id: 's', em: 0.5 },
  { id: 'm', em: 0.62 },
  { id: 'l', em: 0.76 },
]

// Alpha only. The translation deliberately does not take the highlight colour:
// it sits directly under the lyric line, and matching colours makes the two
// compete instead of reading as primary and secondary.
export const TRANSLATION_TONES = [
  { id: 'muted', alpha: 0.6 },
  { id: 'normal', alpha: 0.82 },
  { id: 'bright', alpha: 1 },
]

export const DEFAULTS = {
  highlight: 'white',
  textSize: 'm',
  translationSize: 'm',
  translationTone: 'normal',
}

const pick = (list, id, fallbackId) =>
  list.find((x) => x.id === id) || list.find((x) => x.id === fallbackId)

export const loadAppearance = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const saved = JSON.parse(raw)
    // Merged key by key rather than spread wholesale: a stale value from an
    // older build (or a hand-edited entry) would otherwise reach the stylesheet
    // and resolve to nothing, leaving text transparent. Unknown ids fall back.
    return {
      highlight: pick(HIGHLIGHTS, saved.highlight, DEFAULTS.highlight).id,
      textSize: pick(TEXT_SIZES, saved.textSize, DEFAULTS.textSize).id,
      translationSize: pick(
        TRANSLATION_SIZES,
        saved.translationSize,
        DEFAULTS.translationSize,
      ).id,
      translationTone: pick(
        TRANSLATION_TONES,
        saved.translationTone,
        DEFAULTS.translationTone,
      ).id,
    }
  } catch {
    // Corrupt JSON or a storage-denied browser must not take the panel down.
    return { ...DEFAULTS }
  }
}

export const saveAppearance = (settings) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Private-mode quota failures are not worth surfacing; the setting simply
    // does not persist past this session.
  }
}

export const isDefault = (settings) =>
  Object.keys(DEFAULTS).every((k) => settings[k] === DEFAULTS[k])

// Settings -> the custom properties the stylesheet reads.
export const appearanceVars = (settings) => ({
  '--bl-hl-rgb': pick(HIGHLIGHTS, settings.highlight, DEFAULTS.highlight).rgb,
  '--bl-scale': pick(TEXT_SIZES, settings.textSize, DEFAULTS.textSize).scale,
  '--bl-secondary-em': pick(
    TRANSLATION_SIZES,
    settings.translationSize,
    DEFAULTS.translationSize,
  ).em,
  '--bl-secondary-alpha': pick(
    TRANSLATION_TONES,
    settings.translationTone,
    DEFAULTS.translationTone,
  ).alpha,
})
