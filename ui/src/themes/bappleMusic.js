// BappleMusic - the AMusic palette rebuilt around Apple Music's shape.
//
// AMusic already had the colours right: its pink (#ff4e6b) is within a hair of
// the accent measured off the real client (rgb(250, 88, 106)), and it already
// ships the same -apple-system/SF Pro stack. What it did not have was the
// SHAPE. This theme keeps AMusic's palette untouched and rebuilds the frame:
// a floating rounded sidebar over a flat ground, compact pill navigation with
// an accent-coloured icon, rounded artwork, and a detached transport bar.
//
// Measurements were taken from the live web client rather than guessed:
//   sidebar   rgba(38,38,40,0.6), radius 20px, inset 8px, blur(16px) saturate(2.2),
//             hairline border rgba(255,255,255,0.2), width 244px
//   nav row   34px tall, 14px label at rgba(255,255,255,0.92)
//   active    rgba(255,255,255,0.05) pill at radius 8px; only the ICON takes
//             the accent, the label stays white - that restraint is most of
//             why the real thing reads as calm
//   ground    rgb(31,31,31)
// The ground here stays AMusic's #1a1a1a, since the brief was to keep that
// palette and change the shape.
//
// Deliberately pure data - no imports, no functions - so it exports straight to
// the theme registry as JSON, the same way topBar.js does.
//
// CSS cannot add or reparent DOM, so this reproduces the visual language, not
// the component tree.

const ACCENT = '#ff4e6b'
const DEEP = '#D60017'
const GROUND = '#1a1a1a'
const TEXT = 'rgba(255, 255, 255, 0.92)'
// The sidebar sits ABOVE the ground, so it is lighter than it, not darker -
// inverting that is the single fastest way to lose the floating-panel look.
const PANEL = 'rgba(45, 45, 47, 0.72)'
const HAIRLINE = 'rgba(255, 255, 255, 0.14)'
const PANEL_SOLID = 'rgba(32, 32, 34, 0.97)'
const PILL = 'rgba(255, 255, 255, 0.06)'
const INSET = 8
const RADIUS = 20

const stylesheet = `
/* ---------- ground ---------- */
[data-nd-shell] {
  background: ${GROUND};
}

/* ---------- floating sidebar ---------- */
/* Reads as a panel resting on the ground rather than a wall bolted to the
   window edge.

   Inset with MARGIN, not offsets. Navidrome's desktop drawer is
   position:relative and sits in normal flow, so top/bottom/left do nothing to
   it - and setting height:auto on it collapsed the sidebar to 0px outright.
   Margin insets it while it keeps stretching to its container. */
.MuiDrawer-paper {
  margin: ${INSET}px 0 ${INSET}px ${INSET}px !important;
  border-radius: ${RADIUS}px !important;
  background: ${PANEL} !important;
  border: 1px solid ${HAIRLINE} !important;
  /* saturate() is not decoration: it is what keeps artwork colour bleeding
     through the panel instead of it going flatly grey. */
  backdrop-filter: blur(16px) saturate(2.2);
  -webkit-backdrop-filter: blur(16px) saturate(2.2);
  box-shadow: 0 10px 34px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

/* The drawer surface carries the translucency, so anything painting its own
   background on top would cancel it out. */
[data-nd-menu],
[data-nd-menu] .MuiList-root,
.MuiDrawer-paper .MuiListItem-root {
  background: transparent !important;
}

/* ---------- pill navigation ---------- */
.MuiDrawer-paper .MuiListItem-root {
  border-radius: 8px !important;
  margin: 1px 8px !important;
  padding-top: 5px !important;
  padding-bottom: 5px !important;
  width: auto !important;
  transition: background-color 120ms ease;
}

.MuiDrawer-paper .MuiListItem-root:hover {
  background: ${PILL} !important;
}

.MuiDrawer-paper .MuiListItemText-primary,
.MuiDrawer-paper .MuiListItem-root {
  font-size: 14px !important;
  color: ${TEXT} !important;
}

/* Icons carry the accent; labels stay white. Colouring the label too is the
   usual mistake and makes the sidebar shout. */
.MuiDrawer-paper .MuiListItemIcon-root {
  color: ${ACCENT} !important;
  min-width: 30px !important;
}

/* The active row is matched on aria-current, NOT on a class. React-admin marks
   it with a JSS-generated name (observed as "jss73"), which is regenerated per
   build and cannot be written into a theme. NavLink sets aria-current="page" on
   exactly one link, which is both stable and semantic. */
.MuiDrawer-paper a[aria-current='page'] {
  background: ${PILL} !important;
  border-radius: 8px !important;
  font-weight: 600 !important;
}

/* ---------- top bar ---------- */
/* Flat and borderless: the real client has no hard rule under its header, it
   just lets content scroll beneath a blur. */
.MuiAppBar-root {
  background: rgba(26, 26, 26, 0.72) !important;
  backdrop-filter: blur(16px) saturate(1.8);
  -webkit-backdrop-filter: blur(16px) saturate(1.8);
  border-bottom: 0 none !important;
  box-shadow: none !important;
}

/* ---------- artwork ---------- */
.MuiCard-root {
  background: transparent !important;
  box-shadow: none !important;
}

/* ---------- lists ---------- */
/* Rounded hover on whole rows, and no zebra striping - the real client keeps
   list ground perfectly flat and lets the hover do the work. */
.MuiTableBody-root > tr:nth-child(odd) {
  background: transparent !important;
}

.MuiTableBody-root .MuiTableRow-root:hover {
  background: ${PILL} !important;
}

.MuiTableRow-root td:first-child {
  border-top-left-radius: 8px;
  border-bottom-left-radius: 8px;
}

.MuiTableRow-root td:last-child {
  border-top-right-radius: 8px;
  border-bottom-right-radius: 8px;
}

/* ---------- transport ---------- */
/* Detached from the window edge to match the floating sidebar. The layout
   already reserves height at the bottom for the player, so insetting it needs
   no extra padding anywhere else. */
.nd-player .music-player-panel {
  left: ${INSET}px !important;
  right: ${INSET}px !important;
  bottom: ${INSET}px !important;
  width: auto !important;
  border-radius: 14px !important;
  /* More opaque than the sidebar and less saturated. The sidebar floats over
     flat ground, but the transport floats over the album grid - at the
     sidebar's 0.72/2.2 the artwork bled through and the bar read as noise
     rather than as a surface. */
  background: ${PANEL_SOLID} !important;
  border: 1px solid ${HAIRLINE} !important;
  backdrop-filter: blur(22px) saturate(1.5);
  -webkit-backdrop-filter: blur(22px) saturate(1.5);
  box-shadow: 0 10px 34px rgba(0, 0, 0, 0.5) !important;
}

/* Without this the now-playing text inherits the palette's link colour and
   renders dark pink (measured rgb(178, 54, 74)) - unreadable on the panel and
   nothing like the client this mimics, where the title is white and the
   artist recedes. songTitle/songArtist/songAlbum are real class names, unlike
   the JSS soup around them. */
.nd-player .audio-title a,
.nd-player .songTitle {
  color: ${TEXT} !important;
  font-weight: 600 !important;
}

.nd-player .songArtist,
.nd-player .songAlbum {
  color: rgba(255, 255, 255, 0.55) !important;
  font-weight: 400 !important;
}

.nd-player .music-player-panel svg {
  color: #eee;
}

.nd-player .music-player-panel svg:hover,
.nd-player .music-player-panel svg:active {
  color: ${ACCENT};
}

.nd-player .music-player-panel .panel-content .rc-slider-track,
.nd-player .music-player-panel .panel-content .rc-slider-handle {
  background-color: ${ACCENT};
}

.audio-lists-panel-content .audio-item.playing,
.audio-lists-panel-content .audio-item.playing svg {
  color: ${ACCENT};
}

/* ---------- scrollbars ---------- */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.18);
  border-radius: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}
`

export default {
  themeName: 'BappleMusic',
  typography: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, Apple Color Emoji, SF Pro, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
    h6: { fontSize: '1rem' },
    h5: { fontSize: '2em', fontWeight: '600' },
  },
  palette: {
    primary: { main: ACCENT },
    secondary: { main: DEEP, contrastText: '#eee' },
    background: { default: GROUND, paper: GROUND },
    type: 'dark',
  },
  overrides: {
    MuiAppBar: {
      positionFixed: { boxShadow: 'none' },
      colorSecondary: { color: '#eee' },
    },
    MuiToolbar: {
      root: { background: 'transparent !important' },
    },
    // Apple rounds artwork noticeably harder than AMusic's 6px, and it is the
    // detail that most says "this is that client" at a glance.
    MuiCardMedia: {
      img: { borderRadius: '10px' },
    },
    MuiButton: {
      root: {
        background: DEEP,
        color: '#fff',
        borderRadius: '980px',
        paddingRight: '0.9rem',
        paddingLeft: '0.9rem',
        textTransform: 'capitalize',
        fontWeight: 600,
      },
      textPrimary: { color: '#eee' },
      textSecondary: { color: '#eee', backgroundColor: ACCENT },
      textSizeSmall: { fontSize: '0.8rem' },
    },
    MuiListItemIcon: {
      root: { color: ACCENT },
    },
    MuiIconButton: {
      root: { color: ACCENT },
    },
    MuiChip: {
      root: { borderRadius: '980px' },
    },
    MuiTableCell: {
      root: {
        borderBottom: '0 none !important',
        padding: '10px !important',
        color: '#b3b3b3 !important',
      },
      head: { color: '#b3b3b3 !important' },
    },
    MuiMenuItem: {
      root: { fontSize: '0.875rem', borderRadius: '8px', color: '#eee' },
    },
    MuiPaper: {
      elevation1: { boxShadow: 'none' },
      root: { color: '#eee' },
      rounded: { borderRadius: '12px' },
    },
    NDAlbumGridView: {
      albumName: { color: '#eee', fontSize: '0.875rem' },
      albumArtistName: { color: '#a0a0a0', fontSize: '0.8rem' },
      albumPlayButton: { color: ACCENT },
      cover: { borderRadius: '10px' },
    },
    NDLogin: {
      systemNameLink: { color: ACCENT },
      welcome: { color: '#eee' },
      card: { minWidth: 300, backgroundColor: '#1d1d1d' },
    },
    NDDesktopArtistDetails: {
      artistName: { fontWeight: '600', fontSize: '2em' },
    },
    NDMobileArtistDetails: {
      bgContainer: { background: GROUND },
      artistName: { fontWeight: '600', fontSize: '2em' },
    },
  },
  player: {
    theme: 'dark',
    stylesheet,
  },
}
