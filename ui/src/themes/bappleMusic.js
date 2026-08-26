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
// The client's "liquid glass": measured off its volume popover, which exposes
// the recipe plainly - rgba(40,40,40,0.6) under blur(60px) saturate(2). The
// 60px blur is the whole effect; at 16-20px it just looks like a dark panel.
const GLASS = 'rgba(40, 40, 40, 0.6)'
const GLASS_BLUR = 'blur(60px) saturate(2)'
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
/* min-width, not size: the icons are already 24px, matching the client exactly,
   but MUI's 30px icon column pushed labels 46px from the row start against the
   client's 29px - that gap, not row height, is what read as loose. Rows were
   already 34px with 14px labels before this change. */
.MuiDrawer-paper .MuiListItemIcon-root {
  color: ${ACCENT} !important;
  min-width: 26px !important;
}

/* Trimmed from MUI's 16px.
   Sub-items do NOT carry their own indent - applying this to every row flattened
   Albums > All/Random/Favourites into one undifferentiated list. Navidrome nests
   grouped items inside a .MuiCollapse-root, so the indent is restored there
   explicitly. Unlike the client this mimics, which has a flat sidebar, this app
   has real hierarchy worth keeping. */
.MuiDrawer-paper .MuiListItem-root {
  padding-left: 12px !important;
}

.MuiDrawer-paper .MuiCollapse-root .MuiListItem-root {
  padding-left: 28px !important;
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

/* ---------- action buttons ---------- */
/* Seven solid red pills butted together with margin:0 was the loudest thing on
   the page. The client shows ONE prominent pill and keeps the rest quiet, so
   these become glass with accent icons, and the primary action keeps the fill.
   Spacing is the actual fix requested; the tone change is what stops seven
   spaced-out red pills from simply being a wider wall of red. */
.MuiButton-root.MuiButton-root {
  background: ${GLASS} !important;
  backdrop-filter: ${GLASS_BLUR};
  -webkit-backdrop-filter: ${GLASS_BLUR};
  color: ${TEXT} !important;
  margin: 0 8px 10px 0 !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
}

.MuiButton-root.MuiButton-root:hover {
  background: rgba(60, 60, 60, 0.7) !important;
}

.MuiButton-root.MuiButton-root svg {
  color: ${ACCENT} !important;
}

/* The primary action stays filled, so the row still has one clear entry point. */
.MuiButton-root.MuiButton-root:first-child {
  background: ${ACCENT} !important;
  border-color: transparent !important;
}

.MuiButton-root.MuiButton-root:first-child svg,
.MuiButton-root.MuiButton-root:first-child .MuiButton-label {
  color: #fff !important;
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

/* ---------- transport: floating pill ---------- */
/* The client's bar is a detached, fully-rounded pill: measured 668x56 at
   radius 1000px, sitting 89px off the bottom, over blur(60px) saturate(2).
   Ours is wider than 668px because this app carries more controls than the
   client does (lyrics, queue, favourite, download) - shrinking to match
   exactly would crush them. max-width keeps it a pill on wide screens while
   still collapsing gracefully on narrow ones. */
.nd-player .music-player-panel {
  left: 50% !important;
  right: auto !important;
  transform: translateX(-50%) !important;
  width: min(940px, calc(100% - 32px)) !important;
  bottom: 18px !important;
  border-radius: 1000px !important;
  background: ${GLASS} !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  backdrop-filter: ${GLASS_BLUR};
  -webkit-backdrop-filter: ${GLASS_BLUR};
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55) !important;
  /* NOT overflow:hidden. Clipping to the pill's curve also clipped the volume
     popover, which has to escape upward - it rendered sliced off mid-slider.
     Clipping is unnecessary anyway: the radius resolves to height/2 = 40px, so
     only the outer 40px of each end is curved, and the progress line is inset
     120px, nowhere near it. */
  overflow: visible !important;
}

/* The progress line stays at the top, as asked, but inset so it lives within
   the pill's straight span instead of being sliced by the corner radius - and
   thinned to the client's 2px hairline rather than a thick accent bar. */
.nd-player .panel-content .audio-main .progress-bar {
  left: 120px !important;
  right: 120px !important;
  top: 3px !important;
}

.nd-player .panel-content .audio-main .rc-slider-rail,
.nd-player .panel-content .audio-main .rc-slider-track,
.nd-player .panel-content .audio-main .progress-load-bar {
  height: 2px !important;
}

/* Without this the now-playing text inherits the palette's link colour and
   renders dark pink (measured rgb(178, 54, 74)) - unreadable on glass, and
   nothing like the client, where the title is white and the artist recedes.
   songTitle/songArtist/songAlbum are real class names, unlike the JSS around
   them. (Deleted once by a transport rewrite - keep them out of that block.) */
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

/* Small rounded artwork inside the pill, matching the client's thumbnail. */
.nd-player .music-player-panel .img-content {
  border-radius: 6px !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5) !important;
}

/* ---------- volume popover ---------- */
/* The stock offset is 12px above the icon, which was tuned for a full-width bar
   where the icon sits near the top edge. In the pill the icon is centred in an
   80px surface, so 12px left the popover straddling the pill's top edge instead
   of floating clear of it. Measured: icon top 27px below the pill top, so this
   clears it with room to spare. */
.nd-player .group.play-sounds:hover .sound-operation,
.nd-player .group.play-sounds:focus-within .sound-operation {
  bottom: calc(100% + 42px) !important;
  background: ${GLASS} !important;
  backdrop-filter: ${GLASS_BLUR};
  -webkit-backdrop-filter: ${GLASS_BLUR};
  border-radius: 1000px !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.5) !important;
}

/* The pointer has to travel with the panel or it detaches and floats alone. */
.nd-player .group.play-sounds:hover::after,
.nd-player .group.play-sounds:focus-within::after {
  bottom: calc(100% + 36px) !important;
  background: ${GLASS} !important;
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
