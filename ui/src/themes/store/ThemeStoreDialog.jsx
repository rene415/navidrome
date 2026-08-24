import React, { useCallback, useEffect, useState } from 'react'
import { useTranslate } from 'react-admin'
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
import {
  fetchRegistryIndex,
  getRegistryUrl,
  setRegistryUrl,
  installFromRegistry,
  removeTheme,
  isInstalled,
  listInstalledMeta,
  toRawId,
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
}))

// Order matters only for looks: darkest to lightest reads as a palette strip.
const SWATCH_KEYS = ['bg', 'surface', 'accent', 'text']

const ThemeStoreDialog = ({ open, onClose }) => {
  const translate = useTranslate()
  const classes = useStyles()

  const [url, setUrl] = useState(getRegistryUrl())
  const [entries, setEntries] = useState([])
  const [installed, setInstalled] = useState([])
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

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
                {here ? (
                  <Button size="small" onClick={() => onRemove(entry.id, entry.name)}>
                    {translate('themeStore.remove')}
                  </Button>
                ) : (
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
