/**
 * Class recipes for the admin analytics pages (design spec §4), in one place
 * so every page reads as one system: ink on paper, gold only for data marks,
 * 12px minimum text, 44px tap targets, square corners, and only the md: (768)
 * and xl: (1280) breakpoints.
 */

export const ui = {
  // Page shell
  main: "min-h-screen bg-paper [color-scheme:light]",
  shell: "mx-auto w-full max-w-7xl px-4 py-8 md:px-6 md:py-12",
  h1: "font-heading text-3xl uppercase tracking-wide leading-tight text-ink",
  ledeDisplay: "mt-3 max-w-[60ch] font-display text-xl leading-snug text-ink-secondary md:text-2xl",
  lede: "mt-3 max-w-[65ch] text-sm leading-relaxed text-ink-secondary",
  h2: "font-heading text-xl uppercase tracking-wide leading-tight text-ink",
  h3: "text-sm font-medium text-ink",

  // Header view tabs (route links)
  viewTabs: "mt-6 -mb-px flex gap-6 overflow-x-auto scrollbar-none",
  viewTab:
    "inline-flex min-h-11 items-center whitespace-nowrap border-b-2 border-transparent text-sm text-ink-tertiary transition-colors duration-150 hover:text-ink aria-[current=page]:border-ink aria-[current=page]:font-medium aria-[current=page]:text-ink",

  // Filter row
  filterRow:
    "space-y-4 md:flex md:flex-wrap md:items-end md:gap-x-6 md:gap-y-4 md:space-y-0 xl:sticky xl:top-0 xl:z-20 xl:border-b xl:border-ink/10 xl:bg-paper xl:py-3",
  legend: "mb-2 text-[12px] font-medium uppercase tracking-[0.14em] text-ink-tertiary",
  segGroup: "flex w-full border border-ink/15 bg-paper md:inline-flex md:w-auto",
  segItem:
    "min-h-11 flex-1 cursor-pointer border-l border-ink/15 px-3 text-sm text-ink-secondary transition-colors duration-150 first:border-l-0 hover:bg-ink/[0.04] aria-checked:bg-ink aria-checked:text-paper md:flex-none focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50",
  checkbox: "inline-flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink-secondary",
  rangeCaption: "mt-2 text-[12px] text-ink-tertiary",

  // Section nav
  chipBar: "sticky top-0 z-20 -mx-4 border-y border-ink/10 bg-paper px-4 md:-mx-6 md:px-6 xl:hidden",
  chipList: "flex snap-x gap-2 overflow-x-auto py-2 scrollbar-none",
  chip:
    "inline-flex min-h-11 snap-start items-center whitespace-nowrap border border-ink/15 px-3 text-sm text-ink-secondary aria-[current=location]:border-ink aria-[current=location]:bg-ink aria-[current=location]:text-paper",
  rail: "hidden xl:block",
  railInner: "sticky top-6",
  railList: "border-l border-ink/10",
  railItem:
    "-ml-px flex min-h-11 items-center border-l-2 border-transparent pl-4 text-sm text-ink-tertiary hover:text-ink aria-[current=location]:border-gold-dark aria-[current=location]:text-ink",

  // Section
  section: "scroll-mt-20 xl:scroll-mt-24",
  sectionHead: "mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2",
  sectionDesc: "mt-1 max-w-[65ch] text-sm text-ink-secondary",
  frame: "border border-ink/10 bg-paper-warm p-4 md:p-6",
  textBtn:
    "inline-flex min-h-11 cursor-pointer items-center text-sm text-ink-secondary underline decoration-ink/30 underline-offset-4 transition-colors duration-150 hover:text-ink hover:decoration-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",

  // KPI strip
  kpiGrid: "grid grid-cols-2 gap-px border border-ink/10 bg-ink/10 md:grid-cols-5",
  kpiTile: "bg-paper-warm p-4 md:p-5 first:col-span-2 md:first:col-span-1",
  kpiLabel: "text-sm text-ink-secondary",
  kpiValue: "mt-2 text-2xl font-medium leading-tight text-ink",
  kpiDeltaRow: "mt-1 flex flex-wrap items-baseline gap-x-2 text-[12px]",
  spark: "mt-3 block h-6 w-full",

  // Delta
  deltaGood: "inline-flex items-center gap-1 font-medium tabular-nums text-green-800",
  deltaBad: "inline-flex items-center gap-1 font-medium tabular-nums text-red-700",
  deltaFlat: "inline-flex items-center gap-1 tabular-nums text-ink-tertiary",

  // Tables
  // `relative` so absolutely positioned descendants (screen-reader text) are
  // clipped by this scroll region instead of widening the page.
  tableRegion:
    "relative overflow-x-auto overscroll-x-contain border border-ink/10 bg-paper-warm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
  table: "w-full border-collapse text-sm",
  th: "px-4 py-3 text-left text-[12px] font-medium uppercase tracking-[0.14em] text-ink-tertiary whitespace-nowrap",
  thNum: "px-4 py-3 text-right text-[12px] font-medium uppercase tracking-[0.14em] text-ink-tertiary whitespace-nowrap",
  stickyCell:
    "sticky left-0 z-10 bg-paper-warm after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-ink/10",
  tbody: "divide-y divide-ink/10",
  td: "px-4 py-3 text-ink",
  tdNum: "px-4 py-3 text-right tabular-nums text-ink",
  tfootRow: "border-t border-ink/25 font-medium",
  stackList: "divide-y divide-ink/10 border border-ink/10 bg-paper-warm md:hidden",
  stackRow: "px-4 py-3",
  stackTitle: "text-sm text-ink break-all",
  stackMeta: "mt-1 text-sm tabular-nums text-ink-secondary",
  definitions: "mt-3 text-sm",

  // Bars and meters
  cellBar: "inline-block h-2 w-16 bg-gold-muted align-middle md:w-24",
  cellBarFill: "block h-full rounded-r bg-gold-dark",
  funnelRow: "py-3 md:grid md:grid-cols-[11rem_minmax(0,1fr)_9rem] md:items-center md:gap-x-4",
  funnelTrack: "relative mt-2 h-3 bg-gold-muted md:mt-0",
  funnelFill: "h-full rounded-r bg-gold-dark",
  funnelTick: "absolute -inset-y-1 w-0.5 bg-ink-tertiary",
  funnelLink: "mt-2 flex flex-wrap items-center gap-x-1.5 text-[12px] text-ink-tertiary md:col-start-2",
  biggestDrop: "ml-2 font-medium text-ink",
  meterTrack: "mt-2 h-3 bg-gold-muted",
  meterFill: "h-full rounded-r bg-gold-dark",

  // Badges and status
  badge: "inline-flex items-center gap-1.5 whitespace-nowrap border px-2 py-1 text-sm font-medium leading-none",
  badgePaid: "border-green-800/25 bg-green-50 text-green-900",
  badgeBag: "border-amber-700/30 bg-amber-50 text-amber-900",
  badgeBrowsed: "border-ink/15 bg-paper text-ink-tertiary font-normal",
  statusRow:
    "grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 px-4 py-4 md:grid-cols-[12rem_11rem_minmax(0,1fr)] md:items-baseline",
  statusOk: "inline-flex items-center gap-1.5 text-sm text-green-800",
  statusLimited: "inline-flex items-center gap-1.5 text-sm text-amber-800",
  statusOff: "inline-flex items-center gap-1.5 text-sm text-ink-tertiary",
  statusBad: "inline-flex items-center gap-1.5 text-sm text-red-700",

  // Timeline
  tlItem: "relative grid grid-cols-[3.5rem_1.5rem_minmax(0,1fr)] gap-x-2 pb-6 last:pb-0",
  tlTime: "pt-0.5 text-[12px] tabular-nums text-ink-tertiary",
  tlSpine: "absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gold-dark/40",
  tlNodePage: "relative mt-1.5 size-2.5 border border-ink bg-paper",
  tlNodeEvent: "relative mt-2 size-2 rotate-45 bg-gold-dark",
  tlNodePaid: "relative mt-1.5 size-3 rotate-45 bg-gold-dark ring-2 ring-paper",
  tlNodeEnd: "relative mt-1.5 size-2.5 rounded-full border border-ink-tertiary bg-paper",
  tlBarTrack: "mt-1.5 h-2 w-full max-w-64 bg-gold-muted md:max-w-80",
  tlBarFill: "block h-full rounded-r bg-gold-dark",

  // Buttons
  btnPrimary:
    "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 bg-ink px-6 text-[12px] font-medium uppercase tracking-[0.2em] text-paper transition-colors duration-150 hover:bg-ink-secondary disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
  btnSecondary:
    "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 border border-ink/20 px-5 text-sm text-ink transition-colors duration-150 hover:border-ink disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
  iconBtn:
    "group relative inline-flex size-11 cursor-pointer items-center justify-center text-ink-secondary transition-colors duration-150 hover:bg-ink/[0.05] hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
  tooltip:
    "pointer-events-none absolute right-0 top-full z-30 mt-1 hidden whitespace-nowrap bg-ink px-2 py-1 text-[12px] text-paper group-hover:block group-focus-visible:block",

  // Inputs
  label: "mb-1.5 block text-[12px] font-medium uppercase tracking-[0.14em] text-ink-tertiary",
  input:
    "w-full min-h-11 border border-ink/15 bg-paper px-3 text-base text-ink focus-visible:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink aria-[invalid=true]:border-red-700",
  help: "mt-1.5 text-[12px] text-ink-tertiary",
  fieldError: "mt-1.5 text-[12px] text-red-700",
  searchIcon: "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-tertiary",
  activeChip:
    "inline-flex min-h-11 cursor-pointer items-center gap-2 border border-ink/20 bg-paper px-3 text-sm text-ink hover:border-ink",

  // Slide-over
  sheet:
    "m-0 ml-auto h-dvh max-h-none w-full max-w-none border-l border-ink/10 bg-paper p-0 backdrop:bg-ink/30 md:w-[25rem]",
  sheetFoot: "sticky bottom-0 flex items-center justify-between gap-3 border-t border-ink/10 bg-paper px-4 py-3",

  // Pagination
  pager: "mt-4 flex items-center justify-between gap-4",
  pagerBtn:
    "inline-flex min-h-11 cursor-pointer items-center gap-2 border border-ink/15 px-4 text-sm text-ink hover:border-ink disabled:cursor-not-allowed disabled:border-ink/10 disabled:text-ink-tertiary",

  // Loading and states
  skel: "bg-ink/[0.06] motion-safe:animate-pulse",
  refetching: "opacity-60 transition-opacity duration-150",
  statePanel: "border border-ink/10 bg-paper-warm px-6 py-10 text-center md:py-12",
  stateTitle: "mt-3 text-base font-medium text-ink",
  stateBody: "mx-auto mt-2 max-w-[48ch] text-sm leading-relaxed text-ink-secondary",
  stateActions: "mt-6 flex flex-wrap justify-center gap-3",
  bannerWarn: "flex gap-3 border border-amber-700/30 bg-amber-50 px-4 py-3 text-sm text-amber-900",
  bannerError: "flex gap-3 border border-red-800/25 bg-red-50 px-4 py-3 text-sm text-red-900",
} as const;

export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
