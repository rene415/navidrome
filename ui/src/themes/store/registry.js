import { useCallback, useEffect, useMemo, useState } from 'react'
import bundledThemes from '../index'
import { AUTO_THEME_ID } from '../../consts'
import {
  listInstalled,
  isInstalledId,
  toRawId,
  isInstalled,
  THEME_STORE_CHANGED,
} from './store'

// Single lookup point for "every theme this user can select", bundled or
// installed. useCurrentTheme and SelectTheme both consult this instead of the
// static import, which is the only change the theme engine needs to support
// installed themes.

// Bundled themes keep their bare ids (`SpotifyTheme`); installed themes are
// namespaced `store:<id>`. Collision is therefore structurally impossible and
// bundled always wins by construction - no precedence rule to reason about.
export const getAllThemes = () => ({ ...bundledThemes, ...listInstalled() })

export const getBundledThemes = () => bundledThemes

// Resolves a stored theme id to a theme object, or null if it no longer exists.
export const resolveTheme = (id) => {
  if (!id || id === AUTO_THEME_ID) return null
  const all = getAllThemes()
  return all[id] || null
}

// True when the id refers to an installed theme that has since been removed.
// The selector persists an id, so uninstalling the active theme leaves a
// dangling reference that must be handled deliberately.
export const isDanglingId = (id) =>
  isInstalledId(id) && !isInstalled(toRawId(id))

// What to fall back to when the selected theme no longer exists.
//
// Deliberately AUTO rather than DarkTheme: silently landing on a specific theme
// the user never chose is confusing and looks like a bug, whereas Auto is what
// a first-run user gets and visibly follows the OS preference.
export const FALLBACK_THEME_ID = AUTO_THEME_ID

export const resolveThemeIdOrFallback = (id) => {
  if (!id || id === AUTO_THEME_ID) return AUTO_THEME_ID
  const all = getAllThemes()
  return all[id] ? id : FALLBACK_THEME_ID
}

// Merged bundled + installed themes, refreshed when the installed set changes.
// Reading localStorage inside a redux selector would re-run on every store
// update; this reads once and then only on an actual install or removal.
export const useThemeRegistry = () => {
  const [installed, setInstalled] = useState(() => listInstalled())

  const refresh = useCallback(() => setInstalled(listInstalled()), [])

  useEffect(() => {
    window.addEventListener(THEME_STORE_CHANGED, refresh)
    // 'storage' fires when another tab installs a theme, so open tabs stay
    // consistent without a reload.
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(THEME_STORE_CHANGED, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [refresh])

  return useMemo(() => ({ ...bundledThemes, ...installed }), [installed])
}

export default getAllThemes
