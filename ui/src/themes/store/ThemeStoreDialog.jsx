import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslate } from 'react-admin'
import { useSelector } from 'react-redux'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
  makeStyles,
} from '@material-ui/core'
import bundledThemes from '../index'
import { AUTO_THEME_ID } from '../../consts'
import {
  listInstalled,
  fetchRegistryIndex,
  getRegistryUrl,
  setRegistryUrl,
  installFromRegistry,
  removeTheme,
  isInstalled,
  listInstalledMeta,
  toRawId,
  exportTheme,
  downloadTheme,
} from './store'

const useStyles = makeStyles((theme) => ({
  paper: { maxWidth: '44em' },
  intro: { marginBottom: '1rem', opacity: 0.75 },
  urlRow: { display: 'flex', gap: '0.5rem', alignItems: 'flex-end', marginBottom: '1rem' },
  list: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.9rem',
    padding: '0.7rem 0.85rem',
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
  },
  swatches: { display: 'flex', flexShrink: 0, borderRadius: 6, overflow: 'hidden' },
  swatch: { width: 22, height: 44 },
  meta: { flex: '1 1 auto', minWidth: 0 },
  name: { fontWeight: 600 },
  sub: { opacity: 0.7, fontSize: '0.82rem' },
  status: { opacity: 0.7, fontSize: '0.8rem', marginTop: '0.75rem' },
  included: { opacity: 0.55, fontSize: '0.78rem', whiteSpace: 'nowrap' },
  exportRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    marginTop: '1rem',
    paddingTop: '0.85rem',
    borderTop: `1px solid ${theme.palette.divider}`,
  },
  exportHint: { opacity: 0.6, fontSize: '0.76rem' },
  exportBox: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '0.72rem',
  },
}))

// Order matters only for looks: darkest to lightest reads as a palette strip.
const SWATCH_KEYS = ['bg', 'surface', 'accent', 'text']

// Themes that ship with Navidrome, by display name. A registry may legitimately
// list a theme that is already bundled - ours does, because it was seeded from
// them - and offering to "install" one is misleading: the user already has it,
// and installing only produces a second entry with the same name.
//
// Matched on themeName rather than id: bundled keys are like `DraculaTheme`
// while a registry id is like `dracula`, so ids will not line up.
const bundledNames = new Set(
  Object.values(bundledThemes)
    .map((t) => t && t.themeName)
    .filter(Boolean),
)

const ThemeStoreDialog = ({ open, onClose }) => {
  const translate = useTranslate()
  const classes = useStyles()

  const [url, setUrl] = useState(getRegistryUrl())
  const [entries, setEntries] = useState([])
  const [installed, setInstalled] = useState([])
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [exported, setExported] = useState('')

  // The theme currently applied, resolved the same way useCurrentTheme does.
  // AUTO is not itself a theme, so it resolves to whichever of Light/Dark is
  // actually on screen.
  const themeId = useSelector((state) => state.theme)
  const allThemes = useMemo(
    () => ({ ...bundledThemes, ...listInstalled() }),
    [],
  )
  const activeTheme = useMemo(() => {
    if (!themeId || themeId === AUTO_THEME_ID) {
      const prefersLight =
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: light)').matches
      return prefersLight ? bundledThemes.LightTheme : bundledThemes.DarkTheme
    }
    return allThemes[themeId] || bundledThemes.DarkTheme
  }, [themeId, allThemes])

  const onExport = useCallback(() => {
    try {
      const json = exportTheme(activeTheme)
      setExported(json)
      const slug = (activeTheme.themeName || 'theme')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
      downloadTheme(activeTheme, slug + '.json')
      setStatus(
        translate('themeStore.exported', { name: activeTheme.themeName }),
      )
    } catch (e) {
      // A theme that cannot be exported would also fail to install, so say why.
      setStatus(translate('themeStore.exportFailed', { error: e.message }))
    }
  }, [activeTheme, translate])

  const refreshInstalled = useCallback(() => setInstalled(listInstalledMeta()), [])

  const load = useCallback(
    async (target) => {
      if (!target) {
        setEntries([])
        setStatus(translate('themeStore.noRegistry'))
        return
      }
      setBusy(true)
      setStatus(translate('themeStore.loading'))
      try {
        const list = await fetchRegistryIndex(target)
        setEntries(list)
        setStatus(
          list.length
            ? translate('themeStore.found', { count: list.length })
            : translate('themeStore.empty'),
        )
      } catch (e) {
        setEntries([])
        // Surface the reason: a wrong URL and an unreachable host fail very
        // differently and the user can only fix one of them.
        setStatus(translate('themeStore.loadFailed', { error: e.message }))
      } finally {
        setBusy(false)
      }
    },
    [translate],
  )

  useEffect(() => {
    if (!open) return
    refreshInstalled()
    load(getRegistryUrl())
  }, [open, load, refreshInstalled])

  const onUseRegistry = () => {
    setRegistryUrl(url.trim())
    load(url.trim())
  }

  const onInstall = async (entry) => {
    setBusy(true)
    try {
      await installFromRegistry(entry)
      refreshInstalled()
      setStatus(translate('themeStore.installed', { name: entry.name }))
    } catch (e) {
      setStatus(translate('themeStore.installFailed', { error: e.message }))
    } finally {
      setBusy(false)
    }
  }

  const onRemove = (rawId, name) => {
    removeTheme(rawId)
    refreshInstalled()
    setStatus(translate('themeStore.removed', { name }))
  }

  // Installed themes whose id is not in the current index - kept visible so a
  // theme can always be removed, even if its registry is gone or changed.
  const orphans = installed.filter((m) => !entries.some((e) => e.id === m.id))

  return (
    <Dialog open={open} onClose={onClose} fullWidth classes={{ paper: classes.paper }}>
      <DialogTitle>{translate('themeStore.title')}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" className={classes.intro}>
          {translate('themeStore.intro')}
        </Typography>

        <div className={classes.urlRow}>
          <TextField
            fullWidth
            label={translate('themeStore.registryUrl')}
            placeholder="https://example.com/themes/index.json"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <Button onClick={onUseRegistry} disabled={busy} color="primary">
            {translate('themeStore.load')}
          </Button>
        </div>

        <div className={classes.list}>
          {entries.map((entry) => {
            const here = isInstalled(entry.id)
            const bundled = !here && bundledNames.has(entry.name)
            return (
              <div key={entry.id} className={classes.card}>
                <div className={classes.swatches}>
                  {SWATCH_KEYS.map((k) => (
                    <div
                      key={k}
                      className={classes.swatch}
                      style={{ background: entry.preview?.[k] || 'transparent' }}
                    />
                  ))}
                </div>
                <div className={classes.meta}>
                  <div className={classes.name}>{entry.name}</div>
                  <div className={classes.sub}>
                    {[entry.author, entry.description].filter(Boolean).join(' — ')}
                  </div>
                </div>
                {here && (
                  <Button size="small" onClick={() => onRemove(entry.id, entry.name)}>
                    {translate('themeStore.remove')}
                  </Button>
                )}
                {bundled && (
                  <Typography variant="body2" className={classes.included}>
                    {translate('themeStore.included')}
                  </Typography>
                )}
                {!here && !bundled && (
                  <Button
                    size="small"
                    color="primary"
                    disabled={busy}
                    onClick={() => onInstall(entry)}
                  >
                    {translate('themeStore.install')}
                  </Button>
                )}
              </div>
            )
          })}

          {orphans.map((m) => (
            <div key={m.id} className={classes.card}>
              <div className={classes.meta}>
                <div className={classes.name}>{m.name}</div>
                <div className={classes.sub}>{translate('themeStore.notInRegistry')}</div>
              </div>
              <Button size="small" onClick={() => onRemove(toRawId(m.id), m.name)}>
                {translate('themeStore.remove')}
              </Button>
            </div>
          ))}
        </div>

        <div className={classes.exportRow}>
          <Button size="small" onClick={onExport}>
            {translate('themeStore.exportCurrent', {
              name: activeTheme.themeName || '',
            })}
          </Button>
          <Typography variant="body2" className={classes.exportHint}>
            {translate('themeStore.exportHint')}
          </Typography>
        </div>

        {exported && (
          <TextField
            fullWidth
            multiline
            minRows={6}
            maxRows={14}
            value={exported}
            variant="outlined"
            InputProps={{ readOnly: true, className: classes.exportBox }}
            onFocus={(e) => e.target.select()}
          />
        )}

        {status && (
          <Typography variant="body2" className={classes.status}>
            {status}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{translate('ra.action.close')}</Button>
      </DialogActions>
    </Dialog>
  )
}

export default ThemeStoreDialog
