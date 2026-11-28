export {
  browserStorageLayer,
  ColorScheme,
  colorSchemeFromHeaders,
  type ColorSchemeValue,
  cookieStorageLayer,
  definePreference,
  makeMemoryStorage,
  type MemoryStorageHandle,
  memoryStorageLayer,
  type Preference,
  type PreferenceSpec,
  preferencesScript,
  preferencesScriptBody,
  PreferenceStorage,
  type PreferenceStorageService,
  resolveColorScheme,
  type StorageChange,
  type StorageKind,
  type SystemColorScheme
} from "./preferences.js"

export {
  ConfirmOverlayEntry,
  type ConfirmOptions,
  makeOverlays,
  OverlayEntry,
  OverlayHost,
  type OverlayResult,
  Overlays,
  overlaysLayer,
  type OverlaysService,
  PromptOverlayEntry,
  type PromptOptions,
  ResolveOverlay
} from "./overlays.js"

export {
  Announcement,
  LiveAnnouncer,
  liveAnnouncerLayer,
  type LiveAnnouncerService,
  LiveRegion,
  makeLiveAnnouncer,
  Politeness
} from "./liveAnnouncer.js"

export {
  ariaKeyshortcuts,
  createShortcutTable,
  type DocumentedShortcut,
  formatShortcut,
  makeShortcutRegistry,
  type ShortcutBinding,
  type ShortcutConflict,
  type ShortcutMetadata,
  type ShortcutPlatform,
  ShortcutRegistry,
  shortcutRegistryLayer,
  type ShortcutRegistryService
} from "./shortcuts.js"

export {
  auditServer,
  checkServer,
  type CheckServerOptions,
  ServerPurityError,
  type ServerPurityViolation
} from "./checkServer.js"

export {
  type ChangeSource,
  makePageObserver,
  type ObservedChange,
  PageObserver,
  pageObserverLayer,
  type PageObserverService,
  type RecordChangeInput,
  REDACTED_PLACEHOLDER,
  type RestoreHandler
} from "./observe.js"

export {
  type HistoryActionResult,
  type HistoryEntry,
  type HistorySnapshot,
  makePageHistory,
  PageHistory,
  pageHistoryLayer,
  type PageHistoryOptions,
  type PageHistoryService,
  type UndoSourceResult
} from "./history.js"

export {
  type InputModality,
  inputModalityLayer,
  type InputModalityService,
  InputModalityTracker,
  makeInputModality,
  modalityFromKey,
  modalityFromPointer,
  type ModalityState,
  type PointerKind,
  resolvePointerKind
} from "./pointerKind.js"

export {
  bindBeforeMatch,
  chunkFindableRows,
  type FindableStandInGroup,
  panelHiddenAttr,
  type PanelHiddenOptions,
  supportsHiddenUntilFound
} from "./untilFound.js"

export {
  blendThemeColor,
  createThemeColorDimmer,
  type ThemeColorDimmer
} from "./themeColor.js"

export {
  type CspConfig,
  CspContext,
  cspLayer,
  cspScriptTag,
  cspStyleTag,
  getCspConfig,
  getCspNonce,
  preferencesScriptWithCsp
} from "./csp.js"

export {
  bindIosModalTouchGuard,
  initialIosTouchGuardState,
  type IosTouchGuardConfig,
  type IosTouchGuardDecision,
  type IosTouchGuardEvent,
  type IosTouchGuardState,
  reduceIosTouchGuard,
  resolveInteractiveTapTarget,
  type TouchPoint
} from "./iosTouchGuard.js"

export {
  findNextTabbable,
  getTabbables,
  isTabbable,
  preserveFocusAcrossUpdate
} from "./tabbable.js"

export {
  type FieldValidationEntry,
  firstInvalidFieldName,
  type FormValidationEvent,
  type FormValidationState,
  getVisibleFieldError,
  initialFormValidationState,
  reduceFormValidation,
  type ValidationMode
} from "./formValidation.js"

export {
  createHistoryStage,
  createMarkRegistry,
  type HistoryStage,
  type MarkRegistry,
  type ObserveMark
} from "./stageAndMarks.js"
