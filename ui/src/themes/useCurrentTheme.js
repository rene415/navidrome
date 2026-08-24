import { useSelector } from 'react-redux'
import useMediaQuery from '@material-ui/core/useMediaQuery'
import { AUTO_THEME_ID } from '../consts'
import config from '../config'
import { useEffect, useMemo } from 'react'
import { useThemeRegistry, isDanglingId } from './store/registry'

const useCurrentTheme = () => {
  // Runs above the ThemeProvider carrying the prop below, so it needs its own noSsr or the
  // auto theme renders dark first and flips.
  const prefersLightMode = useMediaQuery('(prefers-color-scheme: light)', {
    noSsr: true,
  })
  // Bundled themes merged with anything installed from a registry. Selecting
  // only the id from redux and resolving outside the selector keeps this from
  // re-reading installed themes on every store update.
  const themes = useThemeRegistry()
  const themeId = useSelector((state) => state.theme)

  const theme = useMemo(() => {
    // A theme that was installed and has since been removed leaves a dangling
    // id behind. Treat it as AUTO rather than silently landing on a specific
    // theme the user never chose.
    const effectiveId =
      themeId && !isDanglingId(themeId) ? themeId : AUTO_THEME_ID

    if (effectiveId === AUTO_THEME_ID) {
      return prefersLightMode ? themes.LightTheme : themes.DarkTheme
    }
    const themeName =
      Object.keys(themes).find((t) => t === effectiveId) ||
      Object.keys(themes).find(
        (t) => themes[t].themeName === config.defaultTheme,
      ) ||
      'DarkTheme'
    return themes[themeName]
  }, [themes, themeId, prefersLightMode])

  useEffect(() => {
    const styles = document.getElementsByTagName('style')
    let style
    for (let i = 0; i < styles.length; i++) {
      if (styles[i].id === 'nd-player-style-override') {
        style = styles[i]
      }
    }
    // Optional chaining is load-bearing: `player` is required of bundled
    // themes by convention but optional for installed ones, and an installed
    // theme without it would otherwise throw the moment it is selected.
    if (theme.player?.stylesheet) {
      if (style === undefined) {
        style = document.createElement('style')
        style.id = 'nd-player-style-override'
        style.innerHTML = theme.player.stylesheet
        document.head.appendChild(style)
      } else {
        style.innerHTML = theme.player.stylesheet
      }
    } else {
      if (style !== undefined) {
        document.head.removeChild(style)
      }
    }

    // Set body background color to match theme (fixes white background on pull-to-refresh)
    const isDark = theme.palette?.type === 'dark'
    const bgColor =
      theme.palette?.background?.default || (isDark ? '#303030' : '#fafafa')
    document.body.style.backgroundColor = bgColor
  }, [theme])

  // We never server-render, so let media queries resolve on the first render: the default
  // defers them to an effect, which makes every mount paint the wrong breakpoint and reflow.
  return useMemo(
    () => ({
      ...theme,
      props: { ...theme.props, MuiUseMediaQuery: { noSsr: true } },
    }),
    [theme],
  )
}

export default useCurrentTheme
