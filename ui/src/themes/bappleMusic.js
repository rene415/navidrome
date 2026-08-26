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
/* ---------- type ---------- */
/* typography.fontFamily only reaches MUI Typography components, so the nav
   rendered in the Apple stack while the whole content column fell back to MUI's
   default (Segoe UI / Roboto / Oxygen). Two different families on screen at
   once is a stronger tell than any single wrong measurement. */
body,
input,
button,
select,
textarea,
.MuiTableCell-root {
  font-family:
    -apple-system,
    BlinkMacSystemFont,
    'Apple Color Emoji',
    'SF Pro',
    'SF Pro Icons',
    'Helvetica Neue',
    Helvetica,
    Arial,
    sans-serif;
}

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
  /* !important or MUI's MuiPaper.elevation1 { boxShadow: none } wins and the
     "floating" panel has no shadow at all - measured as none. */
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2) !important;
  /* Without an explicit height the drawer's flex height plus the 48px app bar
     ran it 9.7px past the viewport bottom, so its bottom corners never rendered. */
  height: calc(100vh - 64px) !important;
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
  margin: 3px 12px !important;
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
/* Only the SELECTED row's icon takes the accent. Painting every icon pink was
   the single biggest tell against the real client, which leaves inactive icons
   white and accents exactly one - the restraint this file's own header comment
   describes, and then contradicted. */
.MuiDrawer-paper .MuiListItemIcon-root {
  color: ${TEXT} !important;
  min-width: 25px !important;
}

.MuiDrawer-paper a[aria-current='page'] .MuiListItemIcon-root {
  color: ${ACCENT} !important;
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
}

/* Group headers ("Albums", "Playlists") were styled identically to leaf rows -
   same height, same 14px label, same hover pill - so the sidebar read as one
   undifferentiated list and the app's real hierarchy, which the client does not
   have at all, was invisible. Headers are the ListItems that are not links. */
.MuiDrawer-paper .MuiListItem-root:not(a) {
  font-size: 12px !important;
  font-weight: 600 !important;
  color: rgba(255, 255, 255, 0.5) !important;
  margin-top: 10px !important;
  /* Sentence case deliberately. Uppercase micro-caps with tracking is the
     Material idiom this theme already removed from the lyrics dock; using it
     here would reintroduce the same tell two panels away. */
}

.MuiDrawer-paper .MuiListItem-root:not(a):hover {
  background: transparent !important;
}

.MuiDrawer-paper .MuiListItem-root:not(a) .MuiListItemIcon-root {
  color: rgba(255, 255, 255, 0.4) !important;
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

/* Matched on aria-label, NOT :first-child. Positionally, the first button on
   the page is the "Skip to content" accessibility link, which was being painted
   as the page's primary action - and on list pages the rule landed on "Add
   Filter" next to "Shuffle All", giving two primaries and no hierarchy.

   White fill with black text, which is what the client uses for the primary on
   an album page - not an accent fill. It reads as more emphatic, not less,
   because nothing else on the page is white. */
.MuiButton-root.MuiButton-root[aria-label='Play'] {
  background: #fff !important;
  border-color: transparent !important;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.MuiButton-root.MuiButton-root[aria-label='Play'] svg,
.MuiButton-root.MuiButton-root[aria-label='Play'] .MuiButton-label {
  color: #000 !important;
}

/* The skip link is not a page action and must never read as one. */
.MuiButton-root.MuiButton-root.skip-nav-button {
  background: ${GLASS} !important;
}

/* ---------- artwork ---------- */
.MuiCard-root {
  background: transparent !important;
  box-shadow: none !important;
}

/* ---------- lists ---------- */
/* The real client's track lists carry no accent at all - titles white,
   secondary grey, and colour only on hover. Every Album and Artist cell here
   was rendering accent pink, which read as a pink Material app rather than as
   the client being mimicked. */
.MuiTableBody-root a {
  color: rgba(255, 255, 255, 0.92) !important;
}

.MuiTableBody-root .MuiTableCell-root a:hover {
  color: ${ACCENT} !important;
}
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
  width: min(840px, calc(100% - 32px)) !important;
  height: 64px !important;
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

/* Shrinking to the client's 56px is not reachable while this bar carries a
   third text line the client does not have (elapsed/duration under the title).
   64px is what fits once the artwork drops to 40px and the type tightens - a
   real move from 80px toward 56px rather than a cosmetic one. */
.nd-player .music-player-panel .img-content {
  width: 40px !important;
  height: 40px !important;
}

/* The control cluster was eating 559px of a 768px pill - six groups at 0 10px
   margins plus 18px of padding on the play button - which left the title block
   107px and truncated it to "RIDE O...". Tightening the cluster is the right
   direction anyway: the client's controls sit far closer together than this. */
.nd-player .player-content .group {
  margin-left: 3px !important;
  margin-right: 3px !important;
}

.nd-player .player-content .play-btn {
  padding-left: 10px !important;
  padding-right: 10px !important;
}

.nd-player .player-content .audio-lists-btn {
  padding-left: 6px !important;
  padding-right: 6px !important;
}

/* Ellipsis rather than a hard cut mid-glyph. */
.nd-player .songTitle,
.nd-player .songArtist,
.nd-player .songAlbum {
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
}

.nd-player .panel-content .progress-bar-content {
  padding-top: 5px !important;
}

.nd-player .songTitle {
  font-size: 13px !important;
}

.nd-player .songArtist,
.nd-player .songAlbum {
  font-size: 12px !important;
}

.nd-player .current-time,
.nd-player .duration {
  font-size: 11px !important;
}

/* The client centres its transport in the content column, not the window - ours
   sat 140px left of that. Only above the breakpoint where the sidebar is
   actually present; below it the sidebar collapses and window-centred is right. */
@media (min-width: 900px) {
  .nd-player .music-player-panel,
  .bl-panel,
  .audio-lists-panel {
    left: calc(50% + 124px) !important;
  }
}

/* ---------- volume popover ---------- */
/* The transport has to outrank the floating cards, or its popover cannot reach
   over them. The panel sits at z-index 99 inside its own stacking context (it
   carries a transform), while the queue is 999 and the lyrics panel 1200 - so
   the volume slider was drawn UNDER whichever card was open and could not be
   used at all. Raising the panel is safe: the cards stop 14px short of the
   pill, so the two never overlap; only the popover reaches across. */
.nd-player .music-player-panel {
  z-index: 1300 !important;
}

/* An invisible bridge across the gap between icon and popover.
   The popover is a descendant, so hovering IT keeps .group:hover true - but the
   empty space between the two is not part of the group, so travelling up to the
   slider dropped the hover and the panel vanished before the pointer arrived.
   At the stock 12px offset this was survivable; at 42px it made the volume
   unusable, which is exactly what was reported. */
.nd-player .group.play-sounds:hover::before,
.nd-player .group.play-sounds:focus-within::before {
  content: '';
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  width: 180px;
  height: 48px;
  /* No background: it exists only to keep :hover alive across the gap. */
}

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
  /* NO border shorthand here. volumeCollapse.css insets the rail from the
     control's ends using transparent 18px LEFT/RIGHT borders, and a shorthand
     resets all four sides - which flattened them to 1px, ran the rail edge to
     edge into the rounded ends, and left the handle hanging 6px outside the
     pill at volume 0. The visible hairline goes on box-shadow instead, exactly
     as that file does for the same reason. */
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.12),
    0 8px 28px rgba(0, 0, 0, 0.5) !important;
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

/* ---------- lyrics: floating panel, not full screen ---------- */
/* The base panel is a full-screen overlay (fixed, top/left 0). Here it becomes
   a rounded card floating directly above the transport, in the same glass
   language as the sidebar and the pill.

   The pill sits 18px off the bottom and is 80px tall, so its top edge is at
   98px; 112px leaves a 14px breathing gap between the two.

   overflow:hidden is wanted HERE (unlike on the pill): the panel's blurred
   album-art layer is inset -12% and would otherwise spill past the rounded
   corners as hard rectangular edges. */
.bl-panel {
  top: auto !important;
  right: auto !important;
  left: 50% !important;
  transform: translateX(-50%) !important;
  bottom: 96px !important;
  width: min(840px, calc(100% - 32px)) !important;
  height: min(52vh, 540px) !important;
  border-radius: 24px !important;
  overflow: hidden !important;
  background: ${GLASS} !important;
  backdrop-filter: ${GLASS_BLUR};
  -webkit-backdrop-filter: ${GLASS_BLUR};
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.62) !important;
}

/* The scrim exists to keep the library readable behind a FULL-screen overlay.
   At this size the panel is its own surface, so the scrim only muddies the
   artwork behind the lyrics. */
.bl-panel .bl-panel__scrim {
  background: rgba(0, 0, 0, 0.35) !important;
}

/* ---------- queue: same floating card as the lyrics ---------- */
/* The vendored queue docks bottom-right at radius 4px 4px 0 0. Here it takes
   exactly the lyrics panel's geometry, so whichever is open occupies the same
   slot above the transport and the two feel like one surface swapping content
   rather than two competing panels. */
/* The vendored player hides this panel by sliding it away with
   translate3d(100%,0,0). Overriding transform for centring CANCELLED that hide,
   so the closed panel stayed at opacity ~2e-16 but visible, pointer-events:auto
   and hit-testable - an invisible 940x540 click-blocker parked over the middle
   of every page. Artist links on lower track rows silently did nothing, and the
   queue's own close button appeared dead. Hide it explicitly, since the
   transform can no longer do it. */
.audio-lists-panel:not(.show) {
  opacity: 0 !important;
  visibility: hidden !important;
  pointer-events: none !important;
}

.audio-lists-panel {
  left: 50% !important;
  right: auto !important;
  transform: translateX(-50%) !important;
  bottom: 96px !important;
  top: auto !important;
  width: min(840px, calc(100% - 32px)) !important;
  height: min(52vh, 540px) !important;
  border-radius: 24px !important;
  overflow: hidden !important;
  background: ${GLASS} !important;
  backdrop-filter: ${GLASS_BLUR};
  -webkit-backdrop-filter: ${GLASS_BLUR};
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.62) !important;
}

.audio-lists-panel .audio-lists-panel-header {
  background: transparent !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
}

.audio-lists-panel .audio-item {
  border-radius: 8px !important;
  border-bottom: 0 none !important;
}

.audio-lists-panel .audio-item:hover {
  background: ${PILL} !important;
}

/* ---------- one panel at a time ---------- */
/* Both could be open simultaneously, stacked on top of each other. The queue
   wins while it is showing, so opening it tucks the lyrics away and closing it
   brings them straight back - the lyrics are the resting state and the queue is
   the transient errand.
   
   This is CSS-only on purpose, so it stays inside the theme. True
   last-opened-wins would need JS in the app, which would affect every theme.
   The trade-off: with the queue open, pressing the lyrics button appears to do
   nothing until the queue is dismissed. */
body:has(.audio-lists-panel.show) .bl-panel {
  display: none !important;
}

/* ---------- lyrics options dock ---------- */
/* This carried no theme rules at all: a flat opaque Material panel sitting
   inside a glass card, with 10.56px/700 uppercase letterspaced headers - an
   idiom the client never uses anywhere.
   
   It matters more than its size suggests. Sync offset, playback speed,
   translation, appearance and lyric override are things the client simply does
   not have, so this is the app's strongest surface; leaving it unthemed made
   the best feature look bolted onto the borrowed chassis. */
.bl-dock__panel {
  /* The stock max-height is viewport-derived (measured 533px) and was sized for
     a full-screen overlay. Inside a 464px card the panel ran 27px past the top
     edge and its first group was clipped away entirely. Capped to the card's own
     height so it scrolls instead of overflowing - the card is
     min(52vh, 540px), less room for the trigger and gaps. */
  max-height: calc(min(52vh, 540px) - 104px) !important;
  overflow-y: auto !important;
  background: ${GLASS} !important;
  backdrop-filter: ${GLASS_BLUR};
  -webkit-backdrop-filter: ${GLASS_BLUR};
  border-radius: 20px !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5) !important;
}

.bl-dock__trigger {
  background: ${GLASS} !important;
  backdrop-filter: ${GLASS_BLUR};
  -webkit-backdrop-filter: ${GLASS_BLUR};
  border-color: rgba(255, 255, 255, 0.12) !important;
  color: ${TEXT} !important;
}

/* Sentence case at a readable size, the way the client labels things - not
   uppercase micro-caps with tracking. */
.bl-dock__label {
  font-size: 0.8rem !important;
  font-weight: 600 !important;
  letter-spacing: normal !important;
  text-transform: none !important;
  color: rgba(255, 255, 255, 0.55) !important;
}

/* Selection means accent everywhere else in this theme; the dock alone used
   white-fill/black-text, which read as a different design system. */
.bl-dock__chip[aria-pressed='true'] {
  background: ${ACCENT} !important;
  color: #fff !important;
  border-color: transparent !important;
}

.bl-dock__chip {
  border-color: rgba(255, 255, 255, 0.14) !important;
}

.bl-dock__select,
.bl-dock__stepper,
.bl-dock__textarea {
  background: rgba(255, 255, 255, 0.06) !important;
  border-color: rgba(255, 255, 255, 0.12) !important;
  border-radius: 10px !important;
  color: ${TEXT} !important;
}

.bl-dock__badge {
  background: ${ACCENT} !important;
  color: #fff !important;
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
      // White by default; the CSS above accents only the selected row.
      root: { color: TEXT },
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
