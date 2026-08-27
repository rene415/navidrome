import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useInterval } from '../common'
import { useDispatch, useSelector } from 'react-redux'
import { useMediaQuery } from '@material-ui/core'
import { ThemeProvider } from '@material-ui/core/styles'
import {
  createMuiTheme,
  useAuthState,
  useDataProvider,
  useTranslate,
} from 'react-admin'
import ReactGA from 'react-ga'
import { GlobalHotKeys } from 'react-hotkeys'
import ReactJkMusicPlayer from 'navidrome-music-player'
import 'navidrome-music-player/assets/index.css'
import './volumeCollapse.css'
import './progressBar.css'
import useCurrentTheme from '../themes/useCurrentTheme'
import config from '../config'
import useStyle from './styles'
import AudioTitle from './AudioTitle'
import {
  clearQueue,
  currentPlaying,
  refreshQueue,
  setPlayMode,
  setTranscodingProfile,
  setVolume,
  syncQueue,
} from '../actions'
import PlayerToolbar from './PlayerToolbar'
import LyricsPanel from '../lyrics/LyricsPanel'
import { sendNotification } from '../utils'
import subsonic from '../subsonic'
import locale from './locale'
import { keyMap } from '../hotkeys'
import keyHandlers from './keyHandlers'
import { calculateGain } from '../utils/calculateReplayGain'
import { detectBrowserProfile, decisionService } from '../transcode'

const Player = () => {
  const theme = useCurrentTheme()
  const translate = useTranslate()
  const playerTheme = theme.player?.theme || 'dark'
  const dataProvider = useDataProvider()
  const playerState = useSelector((state) => state.player)
  const dispatch = useDispatch()
  const [currentTrackId, setCurrentTrackId] = useState(null)
  const [heartbeatTrackId, setHeartbeatTrackId] = useState(null)
  const lastPositionMsRef = useRef(0)
  const currentTrackIdRef = useRef(null)
  const stoppedRef = useRef(false)
  const [audioInstance, setAudioInstance] = useState(null)
  const [lyricsOpen, setLyricsOpen] = useState(false)
  // Which panel, if any, is pinned to the side as a column: 'lyrics' | 'queue'.
  const [dock, setDock] = useState(null)
  // The double-click listener is registered once, so it cannot close over
  // `dock` - it would always read null.
  const dockRef = useRef(null)
  const isDesktop = useMediaQuery('(min-width:810px)')
  const isMobilePlayer =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    )

  const { authenticated } = useAuthState()

  // Keep a ref to playerState so the mount effect can read the latest value
  // without re-triggering on every queue/position change
  const playerStateRef = useRef(playerState)
  playerStateRef.current = playerState

  currentTrackIdRef.current = currentTrackId

  useInterval(
    () => {
      if (heartbeatTrackId && !stoppedRef.current) {
        subsonic.reportPlayback(
          heartbeatTrackId,
          lastPositionMsRef.current,
          'playing',
        )
      }
    },
    heartbeatTrackId ? config.playbackReportIntervalMs : null,
  )

  // Detect browser codec profile and eagerly resolve transcode URLs for the
  // persisted queue once on mount (e.g. after a browser refresh)
  useEffect(() => {
    const profile = detectBrowserProfile()
    decisionService.setProfile(profile)
    dispatch(setTranscodingProfile(profile))

    const state = playerStateRef.current
    const currentIdx = state.savedPlayIndex || 0
    const trackIds = state.queue
      .slice(currentIdx, currentIdx + 4)
      .filter((item) => !item.isRadio && item.trackId)
      .map((item) => item.trackId)

    if (trackIds.length === 0) {
      dispatch(refreshQueue())
      return
    }

    Promise.allSettled(
      trackIds.map((id) =>
        decisionService.resolveStreamUrl(id).then((url) => [id, url]),
      ),
    ).then((results) => {
      const resolvedUrls = {}
      results.forEach((r) => {
        if (r.status === 'fulfilled') {
          resolvedUrls[r.value[0]] = r.value[1]
        }
      })
      dispatch(refreshQueue(resolvedUrls))
    })
  }, [dispatch])

  // Pre-fetch transcode decisions for next 2-3 songs when queue or position changes
  useEffect(() => {
    if (!playerState.queue.length) return

    const currentIdx = playerState.savedPlayIndex || 0
    const nextSongIds = playerState.queue
      .slice(currentIdx + 1, currentIdx + 4)
      .filter((item) => !item.isRadio)
      .map((item) => item.trackId)

    if (nextSongIds.length > 0) {
      decisionService.prefetchDecisions(nextSongIds)
    }
  }, [playerState.queue, playerState.savedPlayIndex])

  const visible = authenticated && playerState.queue.length > 0
  const isRadio = playerState.current?.isRadio || false
  const classes = useStyle({
    isRadio,
    visible,
    enableCoverAnimation: config.enableCoverAnimation,
  })
  const showNotifications = useSelector(
    (state) => state.settings.notifications || false,
  )
  const gainInfo = useSelector((state) => state.replayGain)
  const [context, setContext] = useState(null)
  const [gainNode, setGainNode] = useState(null)

  useEffect(() => {
    if (
      context === null &&
      audioInstance &&
      config.enableReplayGain &&
      'AudioContext' in window &&
      (gainInfo.gainMode === 'album' || gainInfo.gainMode === 'track')
    ) {
      const ctx = new AudioContext()
      // we need this to support radios in firefox
      audioInstance.crossOrigin = 'anonymous'
      const source = ctx.createMediaElementSource(audioInstance)
      const gain = ctx.createGain()

      source.connect(gain)
      gain.connect(ctx.destination)

      setContext(ctx)
      setGainNode(gain)
    }
  }, [audioInstance, context, gainInfo.gainMode])

  useEffect(() => {
    if (gainNode) {
      const current = playerState.current || {}
      const song = current.song || {}

      const numericGain = calculateGain(gainInfo, song)
      gainNode.gain.setValueAtTime(numericGain, context.currentTime)
    }
  }, [audioInstance, context, gainNode, playerState, gainInfo])

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (playerState.current?.uuid && audioInstance && !audioInstance.paused) {
        e.preventDefault()
        e.returnValue = ''
      }
    }

    const handlePageHide = () => {
      if (currentTrackIdRef.current && !playerState.current?.isRadio) {
        stoppedRef.current = true
        try {
          subsonic.reportPlaybackKeepalive(
            currentTrackIdRef.current,
            lastPositionMsRef.current,
            'stopped',
          )
        } catch {
          // fetch/sendBeacon may throw; ignore
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('pagehide', handlePageHide)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('pagehide', handlePageHide)
    }
  }, [playerState, audioInstance])

  const defaultOptions = useMemo(
    () => ({
      theme: playerTheme,
      bounds: 'body',
      playMode: playerState.mode,
      mode: 'full',
      loadAudioErrorPlayNext: false,
      autoPlayInitLoadPlayList: true,
      clearPriorAudioLists: false,
      showDestroy: true,
      showDownload: false,
      // The vendored lyrics widget only understands a flat LRC string, so it
      // cannot show word timing, agents, or a translation track. Two buttons
      // that look equivalent but do different things is worse than one - the
      // enhanced view has its own control (onToggleLyrics below).
      showLyric: false,
      showReload: false,
      toggleMode: !isDesktop,
      glassBg: false,
      showThemeSwitch: false,
      showMediaSession: true,
      restartCurrentOnPrev: true,
      quietUpdate: true,
      defaultPosition: {
        top: 300,
        left: 120,
      },
      volumeFade: { fadeIn: 200, fadeOut: 200 },
      renderAudioTitle: (audioInfo, isMobile) => (
        <AudioTitle
          audioInfo={audioInfo}
          gainInfo={gainInfo}
          isMobile={isMobile}
        />
      ),
      locale: locale(translate),
      sortableOptions: { delay: 200, delayOnTouchOnly: true },
    }),
    [gainInfo, isDesktop, playerTheme, translate, playerState.mode],
  )

  // The lyrics panel blurs the cover across the whole viewport, so it needs a
  // far larger source than the player bar does. playerReducer builds
  // current.cover at size 300 for the transport controls; reusing that
  // thumbnail meant a 300px image stretched over a 2560px backdrop, which is
  // why it looked visibly worse than the artwork everywhere else.
  const lyricsCover = useMemo(() => {
    const current = playerState.current || {}
    if (!current.trackId || current.isRadio) return current.cover
    return subsonic.getCoverArtUrl(
      {
        id: current.trackId,
        updatedAt: current.song?.updatedAt,
        album: current.song?.album,
      },
      1000,
    )
    // Depends on playerState, not playerState.current: the latter is mutable,
    // so mutating it would not re-run this memo. Matches how `options` below
    // declares its dependency.
  }, [playerState])

  const options = useMemo(() => {
    const current = playerState.current || {}
    return {
      ...defaultOptions,
      audioLists: playerState.queue.map((item) => item),
      playIndex: playerState.playIndex,
      autoPlay:
        playerState.queue.length > 0 &&
        playerState.autoPlay !== false &&
        (playerState.clear || playerState.playIndex === 0),
      clearPriorAudioLists: playerState.clear,
      extendsContent: (
        <PlayerToolbar
          id={current.trackId}
          isRadio={current.isRadio}
          lyricsOpen={lyricsOpen}
          onToggleLyrics={() => setLyricsOpen((v) => !v)}
        />
      ),
      defaultVolume: isMobilePlayer ? 1 : playerState.volume,
      showMediaSession: !current.isRadio,
    }
  }, [playerState, defaultOptions, isMobilePlayer, lyricsOpen])

  const onAudioListsChange = useCallback(
    (_, audioLists, audioInfo) => dispatch(syncQueue(audioInfo, audioLists)),
    [dispatch],
  )

  const onAudioProgress = useCallback((info) => {
    if (info.ended) {
      document.title = 'Navidrome'
    }
    if (!info.isRadio && info.currentTime != null) {
      lastPositionMsRef.current = Math.floor(info.currentTime * 1000)
    }
  }, [])

  const onAudioVolumeChange = useCallback(
    // sqrt to compensate for the logarithmic volume
    (volume) => dispatch(setVolume(Math.sqrt(volume))),
    [dispatch],
  )

  const onAudioPlay = useCallback(
    (info) => {
      if (context && context.state !== 'running') {
        context.resume()
      }

      dispatch(currentPlaying(info))
      if (info.duration) {
        const song = info.song
        document.title = `${song.title} - ${song.artist} - Navidrome`
        if (!info.isRadio) {
          const posMs = Math.floor(info.currentTime * 1000)
          lastPositionMsRef.current = posMs
          const isNewTrack = info.trackId !== currentTrackId
          if (isNewTrack) {
            subsonic
              .reportPlayback(info.trackId, posMs, 'starting')
              .then(() =>
                subsonic.reportPlayback(info.trackId, posMs, 'playing'),
              )
            setCurrentTrackId(info.trackId)
          } else {
            subsonic.reportPlayback(info.trackId, posMs, 'playing')
          }
          setHeartbeatTrackId(info.trackId)
        }
        if (config.gaTrackingId) {
          ReactGA.event({
            category: 'Player',
            action: 'Play song',
            label: `${song.title} - ${song.artist}`,
          })
        }
        if (showNotifications) {
          sendNotification(
            song.title,
            `${song.artist} - ${song.album}`,
            info.cover,
          )
        }
      }
    },
    [context, dispatch, showNotifications, currentTrackId],
  )

  const onAudioPlayTrackChange = useCallback(() => {
    if (currentTrackId) {
      subsonic.reportPlayback(
        currentTrackId,
        lastPositionMsRef.current,
        'stopped',
      )
    }
    setHeartbeatTrackId(null)
    setCurrentTrackId(null)
  }, [currentTrackId])

  const onAudioPause = useCallback(
    (info) => {
      dispatch(currentPlaying(info))
      if (!info.isRadio && currentTrackId) {
        const posMs = Math.floor(info.currentTime * 1000)
        lastPositionMsRef.current = posMs
        subsonic.reportPlayback(currentTrackId, posMs, 'paused')
      }
      setHeartbeatTrackId(null)
    },
    [dispatch, currentTrackId],
  )

  const onAudioEnded = useCallback(
    (currentPlayId, audioLists, info) => {
      if (currentTrackId && !info.isRadio) {
        const posMs = Math.floor((info.duration || 0) * 1000)
        subsonic.reportPlayback(currentTrackId, posMs, 'stopped')
      }
      setHeartbeatTrackId(null)
      setCurrentTrackId(null)
      dispatch(currentPlaying(info))
      dataProvider
        .getOne('keepalive', { id: info.trackId })
        // eslint-disable-next-line no-console
        .catch((e) => console.log('Keepalive error:', e))
    },
    [dispatch, dataProvider, currentTrackId],
  )

  const onCoverClick = useCallback((mode, audioLists, audioInfo) => {
    if (mode === 'full' && audioInfo?.song?.albumId) {
      window.location.href = `#/album/${audioInfo.song.albumId}/show`
    }
  }, [])

  const onAudioError = useCallback(
    (error, currentPlayId, audioLists, audioInfo) => {
      // Invalidate all cached decisions — token may be stale
      decisionService.invalidateAll()

      // Pre-fetch decisions for upcoming songs with fresh tokens
      const currentIdx = playerState.queue.findIndex(
        (item) => item.uuid === currentPlayId,
      )
      if (currentIdx >= 0) {
        const nextSongIds = playerState.queue
          .slice(currentIdx + 1, currentIdx + 4)
          .filter((item) => !item.isRadio)
          .map((item) => item.trackId)
        if (nextSongIds.length > 0) {
          decisionService.prefetchDecisions(nextSongIds)
        }
      }
    },
    [playerState.queue],
  )

  const onBeforeDestroy = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (currentTrackId && !playerStateRef.current?.current?.isRadio) {
        subsonic.reportPlayback(
          currentTrackId,
          lastPositionMsRef.current,
          'stopped',
        )
      }
      setHeartbeatTrackId(null)
      setCurrentTrackId(null)
      dispatch(clearQueue())
      reject()
    })
  }, [dispatch, currentTrackId])

  if (!visible) {
    document.title = 'Navidrome'
  }

  const handlers = useMemo(
    () => keyHandlers(audioInstance, playerState),
    [audioInstance, playerState],
  )

  useEffect(() => {
    if (isMobilePlayer && audioInstance) {
      audioInstance.volume = 1
    }
  }, [isMobilePlayer, audioInstance])

  // Report every seek (including programmatic ones the library does not surface
  // via onAudioSeeked, e.g. restartCurrentOnPrev). Debounce coalesces drag
  // bursts into one report at the final position.
  useEffect(() => {
    if (!audioInstance) return
    let timer = null
    const flush = () => {
      timer = null
      if (
        !currentTrackIdRef.current ||
        playerStateRef.current?.current?.isRadio
      ) {
        return
      }
      const posMs = Math.floor((audioInstance.currentTime || 0) * 1000)
      const state = audioInstance.paused ? 'paused' : 'playing'
      subsonic.reportPlayback(currentTrackIdRef.current, posMs, state)
    }
    const handleSeeked = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(flush, 250)
    }
    audioInstance.addEventListener('seeked', handleSeeked)
    return () => {
      if (timer) clearTimeout(timer)
      audioInstance.removeEventListener('seeked', handleSeeked)
    }
  }, [audioInstance])

  // Double-clicking a panel's own button pins it to the side as a column,
  // the way the navigation drawer sits. Double-clicking again unpins it.
  //
  // Delegated rather than bound to the buttons, because the transport's queue
  // button belongs to the vendored player and is remounted as tracks change.
  useEffect(() => {
    const onDoubleClick = (e) => {
      const el = e.target instanceof Element ? e.target : null
      if (!el) return
      const which = el.closest('[data-testid="lyrics-button"]')
        ? 'lyrics'
        : el.closest('.audio-lists-btn')
          ? 'queue'
          : null
      if (!which) return
      const unpinning = dockRef.current === which
      setDock(unpinning ? null : which)
      if (unpinning) return

      // Only one panel occupies the side rail, so pinning one has to put the
      // other away. Without this the previously pinned panel stayed mounted
      // underneath and the newer one simply covered it.
      //
      // A double click also delivers two single clicks, which toggle the target
      // twice and leave it closed, so the pinned panel is re-opened here.
      const queueShowing = () =>
        !!document.querySelector('.audio-lists-panel.show')
      const toggleQueue = () =>
        document.querySelector('.nd-player .audio-lists-btn')?.click()

      if (which === 'lyrics') {
        setLyricsOpen(true)
        if (queueShowing()) toggleQueue()
      } else {
        setLyricsOpen(false)
        window.setTimeout(() => {
          if (!queueShowing()) toggleQueue()
        }, 0)
      }
    }
    document.addEventListener('dblclick', onDoubleClick)
    return () => document.removeEventListener('dblclick', onDoubleClick)
  }, [])

  // Published as an attribute so a theme can lay the pinned panel out however
  // it likes - the behaviour lives here, the appearance stays in CSS.
  useEffect(() => {
    dockRef.current = dock
    const root = document.documentElement
    if (dock) root.setAttribute('data-nd-dock', dock)
    else root.removeAttribute('data-nd-dock')
    return () => root.removeAttribute('data-nd-dock')
  }, [dock])

  // Dismiss the lyrics card and the play queue on Escape, or when the pointer
  // goes down outside them.
  //
  // This lives here rather than in a theme because it is behaviour, not
  // appearance - CSS cannot observe a click landing elsewhere. It is written so
  // that it changes nothing for themes whose lyrics panel is full-screen: there,
  // .bl-panel covers the viewport, so a pointerdown can never land outside it.
  //
  // Clicks inside the transport are deliberately exempt. The bar is part of the
  // same cluster as the panels, and pausing a track should not dismiss the
  // lyrics you were reading.
  useEffect(() => {
    const closeQueue = () => {
      if (!document.querySelector('.audio-lists-panel.show')) return false
      const btn = document.querySelector('.nd-player .audio-lists-btn')
      if (!btn) return false
      // The vendored panel owns its own open state, so the only supported way
      // to close it from outside is to drive its own toggle.
      btn.click()
      return true
    }

    const onPointerDown = (e) => {
      const el = e.target instanceof Element ? e.target : null
      if (!el || el.closest('.nd-player')) return
      // A pinned panel is furniture, not a popover - it stays until unpinned.
      if (lyricsOpen && dock !== 'lyrics' && !el.closest('.bl-panel')) {
        setLyricsOpen(false)
      }
      if (dock !== 'queue' && !el.closest('.audio-lists-panel')) closeQueue()
    }

    const onKey = (e) => {
      if (e.key !== 'Escape' || dock === 'queue') return
      // Queue first: it is drawn over the lyrics, so it is what the user sees
      // and therefore what they expect Escape to dismiss. Stopping propagation
      // keeps the lyrics panel's own Escape handler from closing both at once.
      if (closeQueue()) e.stopPropagation()
    }

    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [lyricsOpen, dock])

  // Publish the active theme's accent as a CSS custom property.
  //
  // The vendored player hardcodes its played-progress colour, so it ignored the
  // selected theme. Exposing the accent as a variable lets plain CSS recolour
  // the player's internals, and it tracks whatever theme is active - including
  // themes installed from the registry, which the app has never seen before.
  //
  // Set on documentElement rather than the player: the player portals to
  // document.body, so a variable set on an ancestor in the React tree would
  // never reach it.
  useEffect(() => {
    const accent = theme?.palette?.primary?.main
    const root = document.documentElement
    if (!accent) {
      root.style.removeProperty('--nd-accent')
      return undefined
    }
    root.style.setProperty('--nd-accent', accent)
    return () => root.style.removeProperty('--nd-accent')
  }, [theme])

  // The volume panel opens on HOVER, handled entirely in CSS.
  //
  // It was originally click-driven, which was wrong: the vendored speaker icon
  // is the player's own mute button, so a click both muted the audio and
  // toggled the panel. Hovering leaves the icon's behaviour untouched.
  //
  // The only thing JS still decides is which way the panel opens. A theme can
  // move the player to the top of the window (themes/topBar.js), where a panel
  // opening upward would land off-screen. This measures the player's actual
  // position rather than hard-coding it, so it works for any such theme.
  useEffect(() => {
    const sync = () => {
      const player = document.querySelector('.nd-player')
      if (!player) return
      const rect = player.getBoundingClientRect()
      player.classList.toggle('nd-volume-top', rect.top < window.innerHeight / 2)
    }
    sync()
    window.addEventListener('resize', sync)
    // The player mounts after this effect on first load, and moves when a theme
    // changes, so re-check shortly after both.
    const t = setTimeout(sync, 1200)
    return () => {
      window.removeEventListener('resize', sync)
      clearTimeout(t)
    }
  }, [theme])

  return (
    <ThemeProvider theme={createMuiTheme(theme)}>
      <ReactJkMusicPlayer
        {...options}
        // 'nd-player' is a stable theming hook. It must ride the component's
        // own className prop rather than a wrapper element: the player renders
        // with bounds:'body' and portals to document.body, so nothing in the
        // React tree ever contains it.
        className={'nd-player ' + classes.player}
        onAudioListsChange={onAudioListsChange}
        onAudioVolumeChange={onAudioVolumeChange}
        onAudioProgress={onAudioProgress}
        onAudioPlay={onAudioPlay}
        onAudioPlayTrackChange={onAudioPlayTrackChange}
        onAudioPause={onAudioPause}
        onPlayModeChange={(mode) => dispatch(setPlayMode(mode))}
        onAudioEnded={onAudioEnded}
        onCoverClick={onCoverClick}
        onAudioError={onAudioError}
        onBeforeDestroy={onBeforeDestroy}
        getAudioInstance={setAudioInstance}
      />
      <LyricsPanel
        open={lyricsOpen}
        onClose={() => setLyricsOpen(false)}
        audioInstance={audioInstance}
        trackId={playerState.current?.trackId}
        title={playerState.current?.name}
        artist={playerState.current?.singer}
        cover={lyricsCover}
      />
      <GlobalHotKeys handlers={handlers} keyMap={keyMap} allowChanges />
    </ThemeProvider>
  )
}

export { Player }
