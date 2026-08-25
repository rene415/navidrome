// A theme that relocates the transport bar to the top of the window.
//
// Deliberately pure data - no imports, no functions - so it can be exported
// straight to the theme registry as JSON. It also exists to prove the theming
// hooks are sufficient for real layout work.
//
// Targets .nd-player, NOT a wrapper element. The player renders with
// bounds:'body' and portals itself to document.body, so nothing in the React
// tree ever contains it - a wrapper hook is silently useless. The class rides
// the component's own className prop instead.

// The player bar is 80px; 86px leaves a little breathing room beneath it.
const BAR = 86

// Only reserve space when a player is actually mounted, so the layout collapses
// back to normal instead of leaving a dead strip across the top.
const playing = 'body:has(.nd-player)'

const stylesheet = [
  '/* --- transport bar to the top --- */',
  '.nd-player {',
  '  position: fixed !important;',
  '  top: 0 !important;',
  '  bottom: auto !important;',
  '  left: 0 !important;',
  '  right: 0 !important;',
  '  z-index: 1300 !important;',
  '}',
  // The vendored player anchors its own panel to the bottom, so the wrapper
  // moving is not enough on its own.
  '.nd-player .music-player-panel {',
  '  position: static !important;',
  '  box-shadow: 0 2px 14px rgba(0, 0, 0, 0.45) !important;',
  '}',
  '',
  '/* --- make room for it --- */',
  playing + ' [data-nd-shell] {',
  '  padding-top: ' + BAR + 'px;',
  '}',
  // The layout reserves 80px at the BOTTOM for a player that no longer sits
  // there.
  playing + ' [data-nd-shell] > * {',
  '  padding-bottom: 0 !important;',
  '}',
  // The app bar is fixed at top:0; push it below the transport bar.
  playing + ' .MuiAppBar-root {',
  '  top: ' + BAR + 'px !important;',
  '}',
  // The sidebar is full height and would otherwise slide underneath.
  playing + ' .MuiDrawer-paper {',
  '  top: ' + BAR + 'px !important;',
  '  height: calc(100% - ' + BAR + 'px) !important;',
  '}',
].join('\n')

export default {
  themeName: 'Top Bar',
  palette: {
    primary: { main: '#6ee7a8' },
    secondary: { main: '#6ee7a8' },
    type: 'dark',
    background: { default: '#101214', paper: '#171a1d' },
  },
  overrides: {
    MuiAppBar: { colorSecondary: { backgroundColor: '#171a1d' } },
    MuiDrawer: { paper: { backgroundColor: '#0c0e10' } },
  },
  player: {
    theme: 'dark',
    stylesheet,
  },
}
