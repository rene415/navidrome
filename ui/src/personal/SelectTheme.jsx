import { useEffect, useState } from 'react'
import { SelectInput, useTranslate } from 'react-admin'
import { useDispatch, useSelector } from 'react-redux'
import { AUTO_THEME_ID } from '../consts'
import { useThemeRegistry, isDanglingId } from '../themes/store/registry'
import { isInstalledId } from '../themes/store/store'
import ThemeStoreDialog from '../themes/store/ThemeStoreDialog'
import { HelpMsg } from './HelpMsg'
import { docsUrl, openInNewTab } from '../utils'
import { changeTheme } from '../actions'

const helpKey = '_help'
// Same sentinel pattern the help entry already uses: a dropdown value that
// performs an action instead of selecting a theme.
const storeKey = '_store'

export const SelectTheme = (props) => {
  const translate = useTranslate()
  const dispatch = useDispatch()
  const currentTheme = useSelector((state) => state.theme)
  // Bundled themes plus anything installed from a registry.
  const themes = useThemeRegistry()
  const [storeOpen, setStoreOpen] = useState(false)

  // Uninstalling the selected theme leaves its id persisted in redux. Reset it
  // so the dropdown does not sit on a choice that no longer exists - the
  // rendered theme already falls back to AUTO, and this makes the stored value
  // agree with what is on screen.
  useEffect(() => {
    if (isDanglingId(currentTheme)) {
      dispatch(changeTheme(AUTO_THEME_ID))
    }
  }, [currentTheme, dispatch])

  const themeChoices = [
    {
      id: AUTO_THEME_ID,
      name: 'Auto',
    },
  ]
  themeChoices.push(
    ...Object.keys(themes).map((key) => {
      // Mark themes installed from a registry. A store theme may carry the same
      // themeName as a bundled one - they cannot collide internally because
      // installed ids are namespaced, but two identical labels in the dropdown
      // read as a duplication bug.
      const name = themes[key].themeName
      return {
        id: key,
        name: isInstalledId(key)
          ? translate('themeStore.installedLabel', { name })
          : name,
      }
    }),
  )
  themeChoices.push({
    id: storeKey,
    name: translate('themeStore.browse'),
  })
  themeChoices.push({
    id: helpKey,
    name: <HelpMsg caption={'Create your own'} />,
  })
  return (
    <>
    <SelectInput
      {...props}
      source="theme"
      label={translate('menu.personal.options.theme')}
      defaultValue={currentTheme}
      translateChoice={false}
      choices={themeChoices}
      onChange={(event) => {
        if (event.target.value === helpKey) {
          openInNewTab(docsUrl('/docs/developers/creating-themes/'))
          return
        }
        if (event.target.value === storeKey) {
          setStoreOpen(true)
          return
        }
        dispatch(changeTheme(event.target.value))
      }}
    />
    <ThemeStoreDialog open={storeOpen} onClose={() => setStoreOpen(false)} />
    </>
  )
}
