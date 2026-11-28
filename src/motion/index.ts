export {
  settleTime,
  solveSpring,
  type SpringConfig,
  type SpringCssEasing,
  springLinearEasing,
  type SpringSample
} from "./spring.js"

export {
  createVelocityTracker,
  findSnapIndex,
  nearestIndex,
  projectDistance,
  resolveSnapPoints,
  rubberBand,
  type SnapPoint,
  type VelocitySample,
  type VelocityTracker
} from "./kinematics.js"

export {
  initialSheetState,
  reduceSheet,
  sheetBackdropProgress,
  type SheetConfig,
  type SheetEvent,
  type SheetPhase,
  type SheetState
} from "./sheet.js"

export {
  initialPresenceState,
  type PresenceEvent,
  type PresencePhase,
  type PresenceState,
  reducePresence
} from "./presence.js"

export {
  type CarouselConfig,
  type CarouselEvent,
  carouselPageCount,
  type CarouselState,
  initialCarouselState,
  isCarouselAutoplayActive,
  reduceCarousel
} from "./carousel.js"

export {
  initialScrollHandoffState,
  isAtScrollBottom,
  isAtScrollTop,
  reduceScrollHandoff,
  type ScrollBoundary,
  type ScrollHandoffEdge,
  type ScrollHandoffEvent,
  type ScrollHandoffMode,
  type ScrollHandoffState,
  type ScrollHandoffTransition
} from "./handoff.js"

export {
  sectorCenterAngleDeg,
  sectorOf,
  type SectorOptions
} from "./sector.js"
