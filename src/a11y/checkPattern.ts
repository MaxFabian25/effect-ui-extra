import * as Effect from "effect/Effect"
import {
  allElements,
  checkAccessibleName,
  checkRovingTabindex,
  containsNode,
  describeNode,
  findById,
  getAttr,
  getName,
  getProp,
  getRole,
  getTabIndex,
  getTag,
  isBooleanAttr,
  isDisabled,
  isEffectivelyHidden,
  isFocusable,
  isHardDisabled,
  isTabStop,
  isTriStateAttr,
  queryAllByRole,
  validateIdRefs
} from "./aria.js"
import { resolveDriver } from "./driver.js"
import { PatternViolationError } from './types.js';
import type { A11yDriver, A11yTarget, ApgPattern, CheckPatternOptions, Direction, NodeLike, Orientation, PatternViolation } from './types.js';

interface AuditCtx {
  readonly driver: A11yDriver
  readonly pattern: ApgPattern
  readonly direction: Direction
  readonly options: CheckPatternOptions
  readonly violations: Array<PatternViolation>
  readonly add: (
    rule: string,
    apg: string,
    node: NodeLike | undefined,
    message: string
  ) => void
}

const makeCtx = (
  driver: A11yDriver,
  pattern: ApgPattern,
  options: CheckPatternOptions
): AuditCtx => {
  const violations: Array<PatternViolation> = []
  return {
    driver,
    pattern,
    direction: options.direction ?? "ltr",
    options,
    violations,
    add: (rule, apg, node, message) => {
      const root = driver.root()
      violations.push({
        pattern,
        rule,
        apg,
        element: node === undefined ? describeNode(root, root) : describeNode(root, node),
        message
      })
    }
  }
}

const forwardKey = (orientation: Orientation, direction: Direction): string =>
  orientation === "vertical"
    ? "ArrowDown"
    : direction === "rtl"
    ? "ArrowLeft"
    : "ArrowRight"

const backwardKey = (orientation: Orientation, direction: Direction): string =>
  orientation === "vertical"
    ? "ArrowUp"
    : direction === "rtl"
    ? "ArrowRight"
    : "ArrowLeft"

const currentFocusedOrTabStop = (
  driver: A11yDriver,
  items: ReadonlyArray<NodeLike>
): NodeLike | undefined => {
  const active = driver.activeElement()
  if (active !== undefined && items.includes(active)) return active
  const tabStop = items.find((item) => getTabIndex(item) === 0)
  if (tabStop !== undefined) return tabStop
  return items.find((item) => getAttr(item, "data-highlighted") !== undefined)
}

const readChecked = (node: NodeLike): string | undefined => {
  const aria = getAttr(node, "aria-checked")
  if (aria !== undefined) return aria
  if (getTag(node) === "input" && (getAttr(node, "type") ?? "").toLowerCase() === "checkbox") {
    const prop = getProp(node, "checked")
    if (typeof prop === "boolean") return String(prop)
    return getAttr(node, "checked") !== undefined ? "true" : "false"
  }
  return undefined
}

const readSliderValue = (node: NodeLike): number | undefined => {
  const raw = getAttr(node, "aria-valuenow") ??
    (getProp(node, "value") !== undefined ? String(getProp(node, "value")) : undefined) ??
    getAttr(node, "value")
  if (raw === undefined || raw === "") return undefined
  const num = Number(raw)
  return Number.isFinite(num) ? num : undefined
}

const readSliderBound = (
  node: NodeLike,
  ariaAttr: "aria-valuemin" | "aria-valuemax",
  nativeAttr: "min" | "max",
  fallback: number
): number => {
  const raw = getAttr(node, ariaAttr) ?? getAttr(node, nativeAttr)
  if (raw === undefined || raw === "") return fallback
  const num = Number(raw)
  return Number.isFinite(num) ? num : fallback
}

// ---------------------------------------------------------------------------
// Pattern 1: switch
// ---------------------------------------------------------------------------

const checkSwitch = Effect.fnUntraced(function*(ctx: AuditCtx) {
  const apg = "APG Switch"
  const root = ctx.driver.root()
  const switches = queryAllByRole(root, "switch")
  if (switches.length === 0) {
    ctx.add("role-missing", apg, root, 'No element with role="switch" found.')
    return
  }
  for (const sw of switches) {
    ctx.violations.push(
      ...checkAccessibleName(root, sw, ctx.pattern, "accessible-name", apg),
      ...validateIdRefs(root, sw, "aria-describedby", ctx.pattern, apg)
    )
    const checked = getAttr(sw, "aria-checked")
    if (!isBooleanAttr(checked)) {
      ctx.add(
        "aria-checked-valid",
        apg,
        sw,
        `Switch must have aria-checked="true" or "false", found ${checked ?? "(missing)"}.`
      )
    }
    if (!isHardDisabled(sw) && !isFocusable(sw)) {
      ctx.add("focusable", apg, sw, "Enabled switch must be keyboard focusable.")
    }
    if (!ctx.options.staticOnly && !isDisabled(sw) && isBooleanAttr(checked)) {
      yield* ctx.driver.focus(sw)
      yield* ctx.driver.keydown(sw, " ")
      const afterSpace = getAttr(sw, "aria-checked")
      if (afterSpace === checked) {
        ctx.add(
          "keyboard-space-toggle",
          apg,
          sw,
          `Pressing Space did not toggle aria-checked (remained "${checked}").`
        )
      } else {
        // Toggle back via Enter or click to verify restoration
        yield* ctx.driver.click(sw)
        const afterClick = getAttr(sw, "aria-checked")
        if (afterClick !== checked) {
          ctx.add(
            "click-toggle",
            apg,
            sw,
            `Clicking switch did not toggle aria-checked back to "${checked}" (got "${afterClick ?? "(missing)"}").`
          )
        }
      }
    }
  }
})

// ---------------------------------------------------------------------------
// Pattern 2: checkbox
// ---------------------------------------------------------------------------

const checkCheckbox = Effect.fnUntraced(function*(ctx: AuditCtx) {
  const apg = "APG Checkbox"
  const root = ctx.driver.root()
  const boxes = queryAllByRole(root, "checkbox")
  if (boxes.length === 0) {
    ctx.add("role-missing", apg, root, 'No element with role="checkbox" or <input type="checkbox"> found.')
    return
  }
  for (const box of boxes) {
    ctx.violations.push(
      ...checkAccessibleName(root, box, ctx.pattern, "accessible-name", apg),
      ...validateIdRefs(root, box, "aria-describedby", ctx.pattern, apg)
    )
    const isNative = getTag(box) === "input" &&
      (getAttr(box, "type") ?? "").toLowerCase() === "checkbox"
    const ariaChecked = getAttr(box, "aria-checked")
    if (!isNative && !isTriStateAttr(ariaChecked)) {
      ctx.add(
        "aria-checked-valid",
        apg,
        box,
        `Custom checkbox must have aria-checked="true", "false", or "mixed", found ${ariaChecked ?? "(missing)"}.`
      )
    }
    if (!isHardDisabled(box) && !isFocusable(box)) {
      ctx.add("focusable", apg, box, "Enabled checkbox must be keyboard focusable.")
    }
    if (!ctx.options.staticOnly && !isDisabled(box)) {
      const before = readChecked(box)
      yield* ctx.driver.focus(box)
      // APG Checkbox: Enter must NOT toggle a checkbox
      yield* ctx.driver.keydown(box, "Enter")
      const afterEnter = readChecked(box)
      if (before !== undefined && afterEnter !== before) {
        ctx.add(
          "keyboard-enter-no-toggle",
          apg,
          box,
          `Pressing Enter toggled checkbox from "${before}" to "${afterEnter ?? "(missing)"}"; APG specifies Space toggles checkboxes, not Enter.`
        )
      }
      const beforeSpace = readChecked(box)
      yield* ctx.driver.keydown(box, " ")
      const afterSpace = readChecked(box)
      if (beforeSpace !== undefined && afterSpace === beforeSpace) {
        ctx.add(
          "keyboard-space-toggle",
          apg,
          box,
          `Pressing Space did not toggle checkbox state (remained "${beforeSpace}").`
        )
      } else if (beforeSpace !== undefined) {
        yield* ctx.driver.click(box)
      }
    }
  }
})

// ---------------------------------------------------------------------------
// Pattern 3: disclosure
// ---------------------------------------------------------------------------

const checkDisclosure = Effect.fnUntraced(function*(ctx: AuditCtx) {
  const apg = "APG Disclosure"
  const root = ctx.driver.root()
  const triggers = queryAllByRole(root, "button").filter(
    (btn) => getAttr(btn, "aria-expanded") !== undefined
  )
  if (triggers.length === 0) {
    ctx.add(
      "trigger-missing",
      apg,
      root,
      "No disclosure button with aria-expanded found."
    )
    return
  }
  for (const trigger of triggers) {
    ctx.violations.push(
      ...checkAccessibleName(root, trigger, ctx.pattern, "accessible-name", apg),
      ...validateIdRefs(root, trigger, "aria-describedby", ctx.pattern, apg)
    )
    const expanded = getAttr(trigger, "aria-expanded")
    if (!isBooleanAttr(expanded)) {
      ctx.add(
        "aria-expanded-valid",
        apg,
        trigger,
        `Disclosure trigger must have aria-expanded="true" or "false", found ${expanded ?? "(missing)"}.`
      )
      continue
    }
    if (expanded === "true") {
      ctx.violations.push(
        ...validateIdRefs(root, trigger, "aria-controls", ctx.pattern, apg)
      )
    }
    if (!ctx.options.staticOnly && !isDisabled(trigger)) {
      yield* ctx.driver.click(trigger)
      const toggled = getAttr(trigger, "aria-expanded")
      if (toggled === expanded) {
        ctx.add(
          "disclosure-toggle",
          apg,
          trigger,
          `Activating disclosure trigger did not change aria-expanded (remained "${expanded}").`
        )
      } else if (toggled === "true") {
        const curRoot = ctx.driver.root()
        ctx.violations.push(
          ...validateIdRefs(curRoot, trigger, "aria-controls", ctx.pattern, apg)
        )
        const controlsId = getAttr(trigger, "aria-controls")?.trim().split(/\s+/)[0]
        if (controlsId !== undefined) {
          const panel = findById(curRoot, controlsId)
          if (panel !== undefined && isEffectivelyHidden(curRoot, panel)) {
            ctx.add(
              "controlled-panel-visible",
              apg,
              panel,
              "Controlled disclosure panel is still hidden while aria-expanded=\"true\"."
            )
          }
        }
      }
      // Restore initial state
      yield* ctx.driver.click(trigger)
    }
  }
})

// ---------------------------------------------------------------------------
// Pattern 4: accordion
// ---------------------------------------------------------------------------

const checkAccordion = Effect.fnUntraced(function*(ctx: AuditCtx) {
  const apg = "APG Accordion"
  const root = ctx.driver.root()
  const triggers = queryAllByRole(root, "button").filter(
    (btn) => getAttr(btn, "aria-expanded") !== undefined
  )
  if (triggers.length === 0) {
    ctx.add(
      "accordion-triggers-missing",
      apg,
      root,
      "No accordion trigger buttons with aria-expanded found."
    )
    return
  }
  for (const trigger of triggers) {
    ctx.violations.push(
      ...checkAccessibleName(root, trigger, ctx.pattern, "accessible-name", apg)
    )
    const expanded = getAttr(trigger, "aria-expanded")
    if (!isBooleanAttr(expanded)) {
      ctx.add(
        "aria-expanded-valid",
        apg,
        trigger,
        `Accordion trigger must have aria-expanded="true" or "false", found ${expanded ?? "(missing)"}.`
      )
      continue
    }
    if (expanded === "true") {
      ctx.violations.push(
        ...validateIdRefs(root, trigger, "aria-controls", ctx.pattern, apg)
      )
      const controls = getAttr(trigger, "aria-controls")?.trim().split(/\s+/)[0]
      if (controls !== undefined) {
        const panel = findById(root, controls)
        if (panel !== undefined) {
          ctx.violations.push(
            ...validateIdRefs(root, panel, "aria-labelledby", ctx.pattern, apg)
          )
          if (isEffectivelyHidden(root, panel)) {
            ctx.add(
              "panel-visible",
              apg,
              panel,
              'Expanded accordion panel is hidden while trigger has aria-expanded="true".'
            )
          }
        }
      }
    }
  }

  if (!ctx.options.staticOnly) {
    const enabled = triggers.filter((t) => !isDisabled(t))
    const candidate = enabled.find((t) => getAttr(t, "aria-expanded") === "false") ?? enabled[0]
    if (candidate !== undefined) {
      const before = getAttr(candidate, "aria-expanded")
      yield* ctx.driver.click(candidate)
      const after = getAttr(candidate, "aria-expanded")
      if (after === before) {
        ctx.add(
          "accordion-toggle",
          apg,
          candidate,
          `Clicking accordion trigger did not toggle aria-expanded (remained "${before ?? "(missing)"}").`
        )
      } else if (after === "true") {
        const curRoot = ctx.driver.root()
        ctx.violations.push(
          ...validateIdRefs(curRoot, candidate, "aria-controls", ctx.pattern, apg)
        )
        const controls = getAttr(candidate, "aria-controls")?.trim().split(/\s+/)[0]
        if (controls === undefined) {
          ctx.add(
            "aria-controls-missing",
            apg,
            candidate,
            'Expanded accordion trigger should set aria-controls pointing to its panel.'
          )
        } else {
          const panel = findById(curRoot, controls)
          if (panel !== undefined) {
            ctx.violations.push(
              ...validateIdRefs(curRoot, panel, "aria-labelledby", ctx.pattern, apg)
            )
            if (isEffectivelyHidden(curRoot, panel)) {
              ctx.add(
                "panel-visible",
                apg,
                panel,
                'Accordion panel remained hidden after expanding trigger.'
              )
            }
          }
        }
      }
    }
  }
})

// ---------------------------------------------------------------------------
// Pattern 5: tabs
// ---------------------------------------------------------------------------

const checkTabs = Effect.fnUntraced(function*(ctx: AuditCtx) {
  const apg = "APG Tabs"
  const root = ctx.driver.root()
  const tablists = queryAllByRole(root, "tablist")
  const tablist = tablists[0]
  if (tablist === undefined) {
    ctx.add("tablist-missing", apg, root, 'No element with role="tablist" found.')
    return
  }
  ctx.violations.push(
    ...validateIdRefs(root, tablist, "aria-labelledby", ctx.pattern, apg)
  )
  const declaredOrientation = getAttr(tablist, "aria-orientation")
  if (
    declaredOrientation !== undefined &&
    declaredOrientation !== "horizontal" &&
    declaredOrientation !== "vertical"
  ) {
    ctx.add(
      "aria-orientation-valid",
      apg,
      tablist,
      `aria-orientation must be "horizontal" or "vertical", found "${declaredOrientation}".`
    )
  }
  const orientation: Orientation =
    ctx.options.orientation ??
    (declaredOrientation === "vertical" ? "vertical" : "horizontal")

  const tabs = queryAllByRole(tablist, "tab")
  if (tabs.length < 2) {
    ctx.add(
      "tabs-minimum",
      apg,
      tablist,
      `Expected at least 2 role="tab" elements inside tablist, found ${tabs.length}.`
    )
    return
  }

  let selectedCount = 0
  for (const tab of tabs) {
    ctx.violations.push(
      ...checkAccessibleName(root, tab, ctx.pattern, "tab-accessible-name", apg)
    )
    const selected = getAttr(tab, "aria-selected")
    if (!isBooleanAttr(selected)) {
      ctx.add(
        "tab-aria-selected",
        apg,
        tab,
        `Tab must have aria-selected="true" or "false", found ${selected ?? "(missing)"}.`
      )
    } else if (selected === "true") {
      selectedCount++
      ctx.violations.push(
        ...validateIdRefs(root, tab, "aria-controls", ctx.pattern, apg)
      )
      const controls = getAttr(tab, "aria-controls")?.trim().split(/\s+/) ?? []
      if (controls.length === 0) {
        ctx.add(
          "tab-aria-controls",
          apg,
          tab,
          'Active tab (aria-selected="true") must reference its tabpanel via aria-controls.'
        )
      } else {
        const panel = controls
          .map((id) => findById(root, id))
          .find((el) => el !== undefined && getRole(root, el) === "tabpanel")
        if (panel === undefined) {
          ctx.add(
            "tabpanel-missing",
            apg,
            tab,
            `Active tab aria-controls="${controls.join(" ")}" does not resolve to a role="tabpanel" element.`
          )
        } else {
          ctx.violations.push(
            ...validateIdRefs(root, panel, "aria-labelledby", ctx.pattern, apg)
          )
          if (isEffectivelyHidden(root, panel)) {
            ctx.add(
              "tabpanel-visible",
              apg,
              panel,
              "Active tab's tabpanel is hidden."
            )
          }
          const tabId = getAttr(tab, "id")
          const labelledBy = getAttr(panel, "aria-labelledby")?.trim().split(/\s+/) ?? []
          if (tabId !== undefined && !labelledBy.includes(tabId)) {
            ctx.add(
              "tabpanel-labelledby",
              apg,
              panel,
              `Active tabpanel aria-labelledby="${labelledBy.join(" ")}" does not include active tab id "${tabId}".`
            )
          }
        }
      }
    }
  }

  if (selectedCount !== 1) {
    ctx.add(
      "tabs-selected-count",
      apg,
      tablist,
      `Expected 1 selected tab (aria-selected="true"), found ${selectedCount}.`
    )
  }

  ctx.violations.push(
    ...checkRovingTabindex(root, tabs, ctx.pattern, apg, "tab")
  )

  if (ctx.options.staticOnly) return

  const focusableTabs = tabs.filter((t) => !isHardDisabled(t))
  const firstTab = focusableTabs[0]
  const lastTab = focusableTabs[focusableTabs.length - 1]
  if (focusableTabs.length < 2 || firstTab === undefined || lastTab === undefined) return

  const start = focusableTabs.find((t) => isTabStop(t)) ?? firstTab
  const startIdx = focusableTabs.indexOf(start)
  yield* ctx.driver.focus(start)

  const nextKey = forwardKey(orientation, ctx.direction)
  const prevKey = backwardKey(orientation, ctx.direction)

  // Move forward from start (wrap if at end)
  yield* ctx.driver.keydown(start, nextKey)
  const afterForward = currentFocusedOrTabStop(ctx.driver, focusableTabs)
  const expectedForwardIdx =
    startIdx + 1 < focusableTabs.length ? startIdx + 1 : 0
  if (
    afterForward === undefined ||
    afterForward === start ||
    (startIdx + 1 < focusableTabs.length &&
      afterForward !== focusableTabs[expectedForwardIdx])
  ) {
    ctx.add(
      "keyboard-arrow-forward",
      apg,
      start,
      `Pressing ${nextKey} (${orientation}, ${ctx.direction}) on tab ${startIdx} did not advance focus to tab ${expectedForwardIdx} (focus stayed on ${
        afterForward === undefined ? "none" : describeNode(ctx.driver.root(), afterForward)
      }).`
    )
  } else {
    // Move backward back to start
    yield* ctx.driver.keydown(afterForward, prevKey)
    const afterBack = currentFocusedOrTabStop(ctx.driver, focusableTabs)
    if (afterBack !== start) {
      ctx.add(
        "keyboard-arrow-backward",
        apg,
        afterForward,
        `Pressing ${prevKey} (${orientation}, ${ctx.direction}) did not move focus back to tab ${startIdx}.`
      )
    }
  }

  // End and Home keys
  const current = currentFocusedOrTabStop(ctx.driver, focusableTabs) ?? start
  yield* ctx.driver.keydown(current, "End")
  const afterEnd = currentFocusedOrTabStop(ctx.driver, focusableTabs)
  if (afterEnd !== lastTab) {
    ctx.add(
      "keyboard-end",
      apg,
      current,
      `Pressing End did not move focus to the last tab ${describeNode(ctx.driver.root(), lastTab)}.`
    )
  }
  yield* ctx.driver.keydown(afterEnd ?? lastTab, "Home")
  const afterHome = currentFocusedOrTabStop(ctx.driver, focusableTabs)
  if (afterHome !== firstTab) {
    ctx.add(
      "keyboard-home",
      apg,
      afterEnd ?? lastTab,
      `Pressing Home did not move focus to the first tab ${describeNode(ctx.driver.root(), firstTab)}.`
    )
  }

  // Verify activating another enabled unselected tab switches selection and panel
  const otherEnabled = tabs.find(
    (t) => !isDisabled(t) && getAttr(t, "aria-selected") === "false"
  )
  if (otherEnabled !== undefined) {
    yield* ctx.driver.click(otherEnabled)
    if (getAttr(otherEnabled, "aria-selected") !== "true") {
      ctx.add(
        "tab-activation",
        apg,
        otherEnabled,
        'Activating an unselected enabled tab did not set aria-selected="true".'
      )
    }
  }
})

// ---------------------------------------------------------------------------
// Pattern 6: radio-group
// ---------------------------------------------------------------------------

const checkRadioGroup = Effect.fnUntraced(function*(ctx: AuditCtx) {
  const apg = "APG Radio Group"
  const root = ctx.driver.root()
  const groups = queryAllByRole(root, "radiogroup")
  const group = groups[0]
  if (group === undefined) {
    ctx.add("radiogroup-missing", apg, root, 'No element with role="radiogroup" found.')
    return
  }
  ctx.violations.push(
    ...checkAccessibleName(root, group, ctx.pattern, "radiogroup-accessible-name", apg),
    ...validateIdRefs(root, group, "aria-describedby", ctx.pattern, apg)
  )

  const radios = queryAllByRole(group, "radio")
  if (radios.length < 2) {
    ctx.add(
      "radios-minimum",
      apg,
      group,
      `Expected at least 2 role="radio" items inside radiogroup, found ${radios.length}.`
    )
    return
  }

  let checkedCount = 0
  for (const radio of radios) {
    ctx.violations.push(
      ...checkAccessibleName(root, radio, ctx.pattern, "radio-accessible-name", apg)
    )
    const checked = getAttr(radio, "aria-checked")
    if (!isBooleanAttr(checked)) {
      ctx.add(
        "radio-aria-checked",
        apg,
        radio,
        `Radio must have aria-checked="true" or "false", found ${checked ?? "(missing)"}.`
      )
    } else if (checked === "true") {
      checkedCount++
    }
  }
  if (checkedCount > 1) {
    ctx.add(
      "radio-single-checked",
      apg,
      group,
      `At most 1 radio may have aria-checked="true", found ${checkedCount}.`
    )
  }

  ctx.violations.push(
    ...checkRovingTabindex(root, radios, ctx.pattern, apg, "radio")
  )

  if (ctx.options.staticOnly) return

  const enabledRadios = radios.filter((r) => !isDisabled(r))
  const firstRadio = enabledRadios[0]
  if (enabledRadios.length < 2 || firstRadio === undefined) return

  const start = enabledRadios.find((r) => isTabStop(r)) ?? firstRadio
  const startIdx = enabledRadios.indexOf(start)
  const expectedNext = enabledRadios[(startIdx + 1) % enabledRadios.length] ?? firstRadio
  const hNext = ctx.direction === "rtl" ? "ArrowLeft" : "ArrowRight"
  const hPrev = ctx.direction === "rtl" ? "ArrowRight" : "ArrowLeft"

  yield* ctx.driver.focus(start)
  yield* ctx.driver.keydown(start, hNext)
  const afterHNext = currentFocusedOrTabStop(ctx.driver, enabledRadios)
  if (afterHNext !== expectedNext) {
    ctx.add(
      "keyboard-arrow-horizontal-forward",
      apg,
      start,
      `Pressing ${hNext} (${ctx.direction}) on radio ${startIdx} did not advance focus to ${describeNode(ctx.driver.root(), expectedNext)}.`
    )
  } else {
    if (
      getAttr(expectedNext, "aria-readonly") !== "true" &&
      getAttr(expectedNext, "data-readonly") === undefined &&
      getAttr(expectedNext, "aria-checked") !== "true"
    ) {
      ctx.add(
        "keyboard-arrow-checks-radio",
        apg,
        expectedNext,
        `Advancing with ${hNext} did not check the focused radio (aria-checked="${getAttr(expectedNext, "aria-checked") ?? "(missing)"}").`
      )
    }
    yield* ctx.driver.keydown(expectedNext, hPrev)
    const afterHPrev = currentFocusedOrTabStop(ctx.driver, enabledRadios)
    if (afterHPrev !== start) {
      ctx.add(
        "keyboard-arrow-horizontal-backward",
        apg,
        expectedNext,
        `Pressing ${hPrev} (${ctx.direction}) did not move focus back to ${describeNode(ctx.driver.root(), start)}.`
      )
    }
  }

  // Vertical ArrowDown should also advance regardless of LTR/RTL
  const cur = currentFocusedOrTabStop(ctx.driver, enabledRadios) ?? start
  const curIdx = enabledRadios.indexOf(cur)
  const expectedDown = enabledRadios[(curIdx + 1) % enabledRadios.length] ?? firstRadio
  yield* ctx.driver.keydown(cur, "ArrowDown")
  const afterDown = currentFocusedOrTabStop(ctx.driver, enabledRadios)
  if (afterDown !== expectedDown) {
    ctx.add(
      "keyboard-arrow-down",
      apg,
      cur,
      `Pressing ArrowDown did not advance focus to ${describeNode(ctx.driver.root(), expectedDown)}.`
    )
  }
})

// ---------------------------------------------------------------------------
// Pattern 7: toolbar
// ---------------------------------------------------------------------------

const checkToolbar = Effect.fnUntraced(function*(ctx: AuditCtx) {
  const apg = "APG Toolbar"
  const root = ctx.driver.root()
  const toolbars = queryAllByRole(root, "toolbar")
  const toolbar = toolbars[0]
  if (toolbar === undefined) {
    ctx.add("toolbar-missing", apg, root, 'No element with role="toolbar" found.')
    return
  }
  ctx.violations.push(
    ...validateIdRefs(root, toolbar, "aria-labelledby", ctx.pattern, apg)
  )
  const declaredOrientation = getAttr(toolbar, "aria-orientation")
  const orientation: Orientation =
    ctx.options.orientation ??
    (declaredOrientation === "vertical" ? "vertical" : "horizontal")

  const interactiveRoles = new Set([
    "button",
    "link",
    "checkbox",
    "radio",
    "textbox",
    "combobox",
    "spinbutton",
    "switch"
  ])
  const items = allElements(toolbar).filter((el) => {
    if (el === toolbar || isEffectivelyHidden(toolbar, el)) return false
    const role = getRole(root, el)
    return role !== undefined && interactiveRoles.has(role)
  })
  if (items.length < 2) {
    ctx.add(
      "toolbar-items-minimum",
      apg,
      toolbar,
      `Expected at least 2 interactive controls inside toolbar, found ${items.length}.`
    )
    return
  }

  for (const item of items) {
    ctx.violations.push(
      ...checkAccessibleName(root, item, ctx.pattern, "item-accessible-name", apg)
    )
  }
  ctx.violations.push(
    ...checkRovingTabindex(root, items, ctx.pattern, apg, "toolbar item")
  )

  if (ctx.options.staticOnly) return

  const focusable = items.filter((item) => !isHardDisabled(item))
  const firstFocusable = focusable[0]
  const lastFocusable = focusable[focusable.length - 1]
  if (focusable.length < 2 || firstFocusable === undefined || lastFocusable === undefined) return

  const start = focusable.find((i) => isTabStop(i)) ?? firstFocusable
  const startIdx = focusable.indexOf(start)
  const nextKey = forwardKey(orientation, ctx.direction)
  const prevKey = backwardKey(orientation, ctx.direction)

  yield* ctx.driver.focus(start)
  yield* ctx.driver.keydown(start, nextKey)
  const afterNext = currentFocusedOrTabStop(ctx.driver, focusable)
  const expectedNext = focusable[(startIdx + 1) % focusable.length] ?? firstFocusable
  if (afterNext !== expectedNext) {
    ctx.add(
      "keyboard-arrow-forward",
      apg,
      start,
      `Pressing ${nextKey} (${orientation}, ${ctx.direction}) did not move focus to ${describeNode(ctx.driver.root(), expectedNext)}.`
    )
  } else {
    yield* ctx.driver.keydown(expectedNext, prevKey)
    const afterPrev = currentFocusedOrTabStop(ctx.driver, focusable)
    if (afterPrev !== start) {
      ctx.add(
        "keyboard-arrow-backward",
        apg,
        expectedNext,
        `Pressing ${prevKey} (${orientation}, ${ctx.direction}) did not move focus back to ${describeNode(ctx.driver.root(), start)}.`
      )
    }
  }

  const cur = currentFocusedOrTabStop(ctx.driver, focusable) ?? start
  yield* ctx.driver.keydown(cur, "End")
  if (currentFocusedOrTabStop(ctx.driver, focusable) !== lastFocusable) {
    ctx.add("keyboard-end", apg, cur, "Pressing End did not move focus to the last toolbar item.")
  }
  yield* ctx.driver.keydown(lastFocusable, "Home")
  if (currentFocusedOrTabStop(ctx.driver, focusable) !== firstFocusable) {
    ctx.add("keyboard-home", apg, lastFocusable, "Pressing Home did not move focus to the first toolbar item.")
  }
})

// ---------------------------------------------------------------------------
// Pattern 8: slider
// ---------------------------------------------------------------------------

const checkSlider = Effect.fnUntraced(function*(ctx: AuditCtx) {
  const apg = "APG Slider"
  const root = ctx.driver.root()
  const sliders = queryAllByRole(root, "slider")
  if (sliders.length === 0) {
    ctx.add("slider-missing", apg, root, 'No element with role="slider" or <input type="range"> found.')
    return
  }

  for (const slider of sliders) {
    ctx.violations.push(
      ...checkAccessibleName(root, slider, ctx.pattern, "accessible-name", apg),
      ...validateIdRefs(root, slider, "aria-describedby", ctx.pattern, apg)
    )
    const min = readSliderBound(slider, "aria-valuemin", "min", 0)
    const max = readSliderBound(slider, "aria-valuemax", "max", 100)
    const now = readSliderValue(slider)
    if (now === undefined) {
      ctx.add(
        "aria-valuenow-missing",
        apg,
        slider,
        "Slider must expose a numeric aria-valuenow (or range input value)."
      )
      continue
    }
    if (min >= max) {
      ctx.add(
        "slider-bounds-invalid",
        apg,
        slider,
        `Slider min (${min}) must be less than max (${max}).`
      )
      continue
    }
    if (now < min || now > max) {
      ctx.add(
        "slider-value-range",
        apg,
        slider,
        `Slider value (${now}) is outside [${min}, ${max}].`
      )
    }
    if (!isHardDisabled(slider) && !isFocusable(slider)) {
      ctx.add("focusable", apg, slider, "Enabled slider must be keyboard focusable.")
    }

    if (ctx.options.staticOnly || isDisabled(slider)) continue

    const declaredOrientation = getAttr(slider, "aria-orientation")
    const orientation: Orientation =
      ctx.options.orientation ??
      (declaredOrientation === "vertical" ? "vertical" : "horizontal")

    const incKey =
      orientation === "vertical"
        ? "ArrowUp"
        : ctx.direction === "rtl"
        ? "ArrowLeft"
        : "ArrowRight"
    const decKey =
      orientation === "vertical"
        ? "ArrowDown"
        : ctx.direction === "rtl"
        ? "ArrowRight"
        : "ArrowLeft"

    yield* ctx.driver.focus(slider)

    // Ensure not pinned at max before testing increment
    let base = readSliderValue(slider) ?? now
    if (base >= max) {
      yield* ctx.driver.keydown(slider, decKey)
      base = readSliderValue(slider) ?? base
    }
    yield* ctx.driver.keydown(slider, incKey)
    const afterInc = readSliderValue(slider)
    if (afterInc === undefined || afterInc <= base) {
      ctx.add(
        "keyboard-increment",
        apg,
        slider,
        `Pressing ${incKey} (${orientation}, ${ctx.direction}) did not increase slider value from ${base} (got ${afterInc ?? "undefined"}).`
      )
    }

    const beforeDec = readSliderValue(slider) ?? base
    yield* ctx.driver.keydown(slider, decKey)
    const afterDec = readSliderValue(slider)
    if (afterDec === undefined || afterDec >= beforeDec) {
      ctx.add(
        "keyboard-decrement",
        apg,
        slider,
        `Pressing ${decKey} (${orientation}, ${ctx.direction}) did not decrease slider value from ${beforeDec} (got ${afterDec ?? "undefined"}).`
      )
    }

    // Home -> min, End -> max
    yield* ctx.driver.keydown(slider, "End")
    const atEnd = readSliderValue(slider)
    if (atEnd !== max) {
      ctx.add(
        "keyboard-end",
        apg,
        slider,
        `Pressing End set slider value to ${atEnd ?? "undefined"}, expected max ${max}.`
      )
    }
    yield* ctx.driver.keydown(slider, "Home")
    const atHome = readSliderValue(slider)
    if (atHome !== min) {
      ctx.add(
        "keyboard-home",
        apg,
        slider,
        `Pressing Home set slider value to ${atHome ?? "undefined"}, expected min ${min}.`
      )
    }
  }
})

// ---------------------------------------------------------------------------
// Pattern 9 & 10: dialog / alertdialog
// ---------------------------------------------------------------------------

const checkDialogLike = Effect.fnUntraced(function*(
  ctx: AuditCtx,
  role: "dialog" | "alertdialog"
) {
  const apg = role === "alertdialog" ? "APG Alert Dialog" : "APG Dialog (Modal)"
  let root = ctx.driver.root()
  let dialogs = queryAllByRole(root, role)

  // If closed initially, look for a trigger button to open it
  let openedViaTrigger: NodeLike | undefined = undefined
  if (dialogs.length === 0 && !ctx.options.staticOnly) {
    const triggers = queryAllByRole(root, "button").filter((btn) =>
      ctx.options.openTrigger !== undefined
        ? getName(root, btn) === ctx.options.openTrigger
        : getAttr(btn, "aria-haspopup") === "dialog" ||
          getAttr(btn, "aria-expanded") === "false"
    )
    const trigger = triggers[0]
    if (trigger !== undefined) {
      if (getAttr(trigger, "aria-expanded") !== undefined && getAttr(trigger, "aria-expanded") !== "false") {
        ctx.add(
          "trigger-aria-expanded",
          apg,
          trigger,
          `Closed dialog trigger should have aria-expanded="false", found "${getAttr(trigger, "aria-expanded")}".`
        )
      }
      yield* ctx.driver.click(trigger)
      openedViaTrigger = trigger
      root = ctx.driver.root()
      dialogs = queryAllByRole(root, role)
    }
  }

  const dialog = dialogs[0]
  if (dialog === undefined) {
    ctx.add("role-missing", apg, root, `No open element with role="${role}" found.`)
    return
  }
  ctx.violations.push(
    ...checkAccessibleName(root, dialog, ctx.pattern, "dialog-accessible-name", apg),
    ...validateIdRefs(root, dialog, "aria-describedby", ctx.pattern, apg)
  )

  if (role === "alertdialog") {
    const desc = getAttr(dialog, "aria-describedby")
    if (desc === undefined || desc.trim() === "") {
      ctx.add(
        "alertdialog-describedby",
        apg,
        dialog,
        "Alert dialog must reference its message with aria-describedby."
      )
    }
  }

  if (openedViaTrigger !== undefined) {
    const exp = getAttr(openedViaTrigger, "aria-expanded")
    if (exp !== undefined && exp !== "true") {
      ctx.add(
        "trigger-aria-expanded-open",
        apg,
        openedViaTrigger,
        `Open dialog trigger should have aria-expanded="true", found "${exp}".`
      )
    }
    ctx.violations.push(
      ...validateIdRefs(root, openedViaTrigger, "aria-controls", ctx.pattern, apg)
    )
  }

  if (ctx.options.staticOnly) return

  // Keyboard Escape dismissal (DOM runs onMount dismissal listeners; TestHost checks keydown handlers)
  if (ctx.driver.kind === "dom") {
    const active = ctx.driver.activeElement()
    const target = active !== undefined && containsNode(dialog, active) ? active : dialog
    yield* ctx.driver.keydown(target, "Escape")
    const remaining = queryAllByRole(ctx.driver.root(), role)
    if (remaining.length > 0) {
      ctx.add(
        "keyboard-escape-close",
        apg,
        dialog,
        `Pressing Escape did not dismiss the ${role}.`
      )
    }
  } else {
    // On TestHost, try Escape first if a close handler listens on keydown; otherwise test close button if present.
    const closeBtn = queryAllByRole(dialog, "button").find((btn) =>
      /close|cancel|dismiss|ok/i.test(getName(root, btn))
    )
    if (closeBtn !== undefined) {
      yield* ctx.driver.click(closeBtn)
      const remaining = queryAllByRole(ctx.driver.root(), role)
      if (remaining.length > 0) {
        ctx.add(
          "dialog-close-button",
          apg,
          closeBtn,
          `Activating close button ${describeNode(root, closeBtn)} did not close the ${role}.`
        )
      }
    }
  }
})

// ---------------------------------------------------------------------------
// Pattern 11: listbox
// ---------------------------------------------------------------------------

const checkListbox = Effect.fnUntraced(function*(ctx: AuditCtx) {
  const apg = "APG Listbox"
  const root = ctx.driver.root()
  const listboxes = queryAllByRole(root, "listbox")
  const listbox = listboxes[0]
  if (listbox === undefined) {
    ctx.add("listbox-missing", apg, root, 'No element with role="listbox" found.')
    return
  }
  ctx.violations.push(
    ...checkAccessibleName(root, listbox, ctx.pattern, "listbox-accessible-name", apg),
    ...validateIdRefs(root, listbox, "aria-activedescendant", ctx.pattern, apg)
  )

  const options = queryAllByRole(listbox, "option")
  if (options.length < 2) {
    ctx.add(
      "options-minimum",
      apg,
      listbox,
      `Expected at least 2 role="option" elements inside listbox, found ${options.length}.`
    )
    return
  }
  for (const option of options) {
    ctx.violations.push(
      ...checkAccessibleName(root, option, ctx.pattern, "option-accessible-name", apg)
    )
    const selected = getAttr(option, "aria-selected")
    if (selected !== undefined && !isBooleanAttr(selected)) {
      ctx.add(
        "option-aria-selected",
        apg,
        option,
        `Option aria-selected must be "true" or "false", found "${selected}".`
      )
    }
  }

  const usesActiveDescendant = getAttr(listbox, "aria-activedescendant") !== undefined
  if (!usesActiveDescendant) {
    ctx.violations.push(
      ...checkRovingTabindex(root, options, ctx.pattern, apg, "option")
    )
  }

  if (ctx.options.staticOnly) return

  const enabledOptions = options.filter((o) => !isDisabled(o))
  const firstOption = enabledOptions[0]
  if (enabledOptions.length < 2 || firstOption === undefined) return

  const currentHighlighted = (): NodeLike | undefined => {
    const ad = getAttr(listbox, "aria-activedescendant")
    if (ad !== undefined) return findById(ctx.driver.root(), ad)
    return currentFocusedOrTabStop(ctx.driver, enabledOptions)
  }

  const keyTarget = usesActiveDescendant ? listbox : (currentHighlighted() ?? firstOption)
  yield* ctx.driver.focus(keyTarget)
  const before = currentHighlighted()
  yield* ctx.driver.keydown(keyTarget, "ArrowDown")
  const afterDown = currentHighlighted()
  if (afterDown === undefined || afterDown === before) {
    ctx.add(
      "keyboard-arrow-down",
      apg,
      keyTarget,
      "Pressing ArrowDown in listbox did not move highlight/focus to the next option."
    )
  }
  yield* ctx.driver.keydown(usesActiveDescendant ? listbox : (afterDown ?? keyTarget), "End")
  const afterEnd = currentHighlighted()
  if (afterEnd !== enabledOptions[enabledOptions.length - 1]) {
    ctx.add("keyboard-end", apg, keyTarget, "Pressing End in listbox did not move to the last option.")
  }
  yield* ctx.driver.keydown(usesActiveDescendant ? listbox : (afterEnd ?? keyTarget), "Home")
  const afterHome = currentHighlighted()
  if (afterHome !== enabledOptions[0]) {
    ctx.add("keyboard-home", apg, keyTarget, "Pressing Home in listbox did not move to the first option.")
  }
})

// ---------------------------------------------------------------------------
// Pattern 12: combobox
// ---------------------------------------------------------------------------

const checkCombobox = Effect.fnUntraced(function*(ctx: AuditCtx) {
  const apg = "APG Combobox"
  let root = ctx.driver.root()
  const comboboxes = queryAllByRole(root, "combobox")
  const combobox = comboboxes[0]
  if (combobox === undefined) {
    ctx.add("combobox-missing", apg, root, 'No element with role="combobox" found.')
    return
  }
  ctx.violations.push(
    ...checkAccessibleName(root, combobox, ctx.pattern, "combobox-accessible-name", apg),
    ...validateIdRefs(root, combobox, "aria-describedby", ctx.pattern, apg)
  )

  const initialExpanded = getAttr(combobox, "aria-expanded")
  if (!isBooleanAttr(initialExpanded)) {
    ctx.add(
      "combobox-aria-expanded",
      apg,
      combobox,
      `Combobox must have aria-expanded="true" or "false", found ${initialExpanded ?? "(missing)"}.`
    )
  }

  if (ctx.options.staticOnly) {
    if (initialExpanded === "true") {
      ctx.violations.push(
        ...validateIdRefs(root, combobox, "aria-controls", ctx.pattern, apg),
        ...validateIdRefs(root, combobox, "aria-activedescendant", ctx.pattern, apg)
      )
    }
    return
  }

  // Open if closed
  if (initialExpanded !== "true") {
    yield* ctx.driver.focus(combobox)
    yield* ctx.driver.keydown(combobox, "ArrowDown")
    if (getAttr(combobox, "aria-expanded") !== "true") {
      yield* ctx.driver.click(combobox)
    }
  }

  root = ctx.driver.root()
  if (getAttr(combobox, "aria-expanded") !== "true") {
    ctx.add(
      "combobox-open",
      apg,
      combobox,
      'Activating combobox with ArrowDown or click did not set aria-expanded="true".'
    )
    return
  }

  ctx.violations.push(
    ...validateIdRefs(root, combobox, "aria-controls", ctx.pattern, apg),
    ...validateIdRefs(root, combobox, "aria-activedescendant", ctx.pattern, apg)
  )

  const controlsId = getAttr(combobox, "aria-controls")?.trim().split(/\s+/)[0]
  const popup = controlsId !== undefined ? findById(root, controlsId) : queryAllByRole(root, "listbox")[0]
  if (popup === undefined) {
    ctx.add(
      "combobox-popup-missing",
      apg,
      combobox,
      'Expanded combobox has no visible popup element referenced by aria-controls.'
    )
    return
  }
  if (isEffectivelyHidden(root, popup)) {
    ctx.add(
      "combobox-popup-visible",
      apg,
      popup,
      'Combobox popup is hidden while aria-expanded="true".'
    )
  }

  const options = queryAllByRole(popup, "option")
  if (options.length === 0) {
    ctx.add("combobox-options-missing", apg, popup, 'Open combobox popup has no role="option" items.')
    return
  }
  for (const option of options) {
    ctx.violations.push(
      ...checkAccessibleName(root, option, ctx.pattern, "option-accessible-name", apg)
    )
  }

  // Navigate inside popup (either on combobox input via aria-activedescendant or on popup via roving tabindex)
  const navTarget =
    getTag(combobox) === "input" ? combobox : popup
  const readActiveOption = (): NodeLike | undefined => {
    const ad = getAttr(combobox, "aria-activedescendant")
    if (ad !== undefined) return findById(ctx.driver.root(), ad)
    return options.find(
      (o) =>
        getAttr(o, "data-highlighted") !== undefined ||
        getTabIndex(o) === 0 ||
        ctx.driver.activeElement() === o
    )
  }

  const beforeNav = readActiveOption()
  yield* ctx.driver.keydown(navTarget, "ArrowDown")
  const afterNav = readActiveOption()
  if (afterNav === undefined || (options.length > 1 && afterNav === beforeNav)) {
    ctx.add(
      "combobox-arrow-down",
      apg,
      navTarget,
      "Pressing ArrowDown did not move highlighted option in open combobox."
    )
  }

  // Escape closes popup
  yield* ctx.driver.keydown(navTarget, "Escape")
  if (getAttr(combobox, "aria-expanded") !== "false") {
    ctx.add(
      "combobox-escape-close",
      apg,
      combobox,
      'Pressing Escape did not close combobox popup (aria-expanded did not return to "false").'
    )
  }
})

// ---------------------------------------------------------------------------
// Pattern 13: menu
// ---------------------------------------------------------------------------

const checkMenu = Effect.fnUntraced(function*(ctx: AuditCtx) {
  const apg = "APG Menu"
  let root = ctx.driver.root()
  let menus = queryAllByRole(root, "menu")
  let trigger: NodeLike | undefined = undefined

  if (menus.length === 0 && !ctx.options.staticOnly) {
    trigger = queryAllByRole(root, "button").find((btn) =>
      ctx.options.openTrigger !== undefined
        ? getName(root, btn) === ctx.options.openTrigger
        : getAttr(btn, "aria-haspopup") === "menu" ||
          getAttr(btn, "aria-expanded") === "false"
    )
    if (trigger !== undefined) {
      ctx.violations.push(
        ...checkAccessibleName(root, trigger, ctx.pattern, "trigger-accessible-name", apg)
      )
      yield* ctx.driver.click(trigger)
      root = ctx.driver.root()
      menus = queryAllByRole(root, "menu")
    }
  }

  const menu = menus[0]
  if (menu === undefined) {
    ctx.add("menu-missing", apg, root, 'No open element with role="menu" found.')
    return
  }
  if (trigger !== undefined) {
    if (getAttr(trigger, "aria-expanded") !== "true") {
      ctx.add(
        "trigger-aria-expanded",
        apg,
        trigger,
        `Open menu trigger should have aria-expanded="true", found "${getAttr(trigger, "aria-expanded") ?? "(missing)"}".`
      )
    }
    ctx.violations.push(
      ...validateIdRefs(root, trigger, "aria-controls", ctx.pattern, apg)
    )
  }

  const items = [
    ...queryAllByRole(menu, "menuitem"),
    ...queryAllByRole(menu, "menuitemcheckbox"),
    ...queryAllByRole(menu, "menuitemradio")
  ]
  if (items.length === 0) {
    ctx.add("menuitems-missing", apg, menu, 'Menu contains no menuitem, menuitemcheckbox, or menuitemradio elements.')
    return
  }

  for (const item of items) {
    ctx.violations.push(
      ...checkAccessibleName(root, item, ctx.pattern, "menuitem-accessible-name", apg)
    )
    const r = getRole(root, item)
    if (r === "menuitemcheckbox" || r === "menuitemradio") {
      const checked = getAttr(item, "aria-checked")
      if (!isBooleanAttr(checked)) {
        ctx.add(
          "menuitem-aria-checked",
          apg,
          item,
          `${r} must have aria-checked="true" or "false", found ${checked ?? "(missing)"}.`
        )
      }
    }
  }

  if (ctx.options.staticOnly) return

  const enabledItems = items.filter((i) => !isDisabled(i))
  if (enabledItems.length >= 2) {
    const readActive = () =>
      enabledItems.find(
        (i) =>
          ctx.driver.activeElement() === i ||
          getAttr(i, "data-highlighted") !== undefined ||
          getTabIndex(i) === 0
      )
    const target = readActive() ?? menu
    const before = readActive()
    yield* ctx.driver.keydown(target, "ArrowDown")
    const afterDown = readActive()
    if (afterDown === undefined || afterDown === before) {
      ctx.add(
        "menu-arrow-down",
        apg,
        target,
        "Pressing ArrowDown in menu did not move highlight/focus to the next item."
      )
    }
  }

  if (trigger !== undefined) {
    const target = ctx.driver.activeElement() ?? menu
    yield* ctx.driver.keydown(containsNode(menu, target) ? target : menu, "Escape")
    if (getAttr(trigger, "aria-expanded") !== "false") {
      ctx.add(
        "menu-escape-close",
        apg,
        menu,
        'Pressing Escape did not close menu (trigger aria-expanded did not return to "false").'
      )
    }
  }
})

// ---------------------------------------------------------------------------
// Pattern 14: menubar
// ---------------------------------------------------------------------------

const checkMenubar = Effect.fnUntraced(function*(ctx: AuditCtx) {
  const apg = "APG Menubar"
  const root = ctx.driver.root()
  const menubars = queryAllByRole(root, "menubar")
  const menubar = menubars[0]
  if (menubar === undefined) {
    ctx.add("menubar-missing", apg, root, 'No element with role="menubar" found.')
    return
  }
  const declaredOrientation = getAttr(menubar, "aria-orientation")
  const orientation: Orientation =
    ctx.options.orientation ??
    (declaredOrientation === "vertical" ? "vertical" : "horizontal")

  // Top-level menubar items (exclude items nested inside open submenus)
  const allItems = queryAllByRole(menubar, "menuitem")
  const submenus = queryAllByRole(menubar, "menu")
  const items = allItems.filter(
    (item) => !submenus.some((sub) => containsNode(sub, item))
  )

  if (items.length < 2) {
    ctx.add(
      "menubar-items-minimum",
      apg,
      menubar,
      `Expected at least 2 top-level role="menuitem" elements in menubar, found ${items.length}.`
    )
    return
  }

  for (const item of items) {
    ctx.violations.push(
      ...checkAccessibleName(root, item, ctx.pattern, "menuitem-accessible-name", apg)
    )
  }

  ctx.violations.push(
    ...checkRovingTabindex(root, items, ctx.pattern, apg, "menubar item")
  )

  if (ctx.options.staticOnly) return

  const focusable = items.filter((i) => !isHardDisabled(i))
  const firstFocusable = focusable[0]
  if (focusable.length < 2 || firstFocusable === undefined) return

  const start = focusable.find((i) => isTabStop(i)) ?? firstFocusable
  const startIdx = focusable.indexOf(start)
  const expectedNext = focusable[(startIdx + 1) % focusable.length] ?? firstFocusable
  const nextKey = forwardKey(orientation, ctx.direction)
  const prevKey = backwardKey(orientation, ctx.direction)

  yield* ctx.driver.focus(start)
  yield* ctx.driver.keydown(start, nextKey)
  const afterNext = currentFocusedOrTabStop(ctx.driver, focusable)
  if (afterNext !== expectedNext) {
    ctx.add(
      "menubar-arrow-forward",
      apg,
      start,
      `Pressing ${nextKey} (${orientation}, ${ctx.direction}) on menubar item ${startIdx} did not advance focus to ${describeNode(ctx.driver.root(), expectedNext)}.`
    )
  } else {
    yield* ctx.driver.keydown(expectedNext, prevKey)
    const afterPrev = currentFocusedOrTabStop(ctx.driver, focusable)
    if (afterPrev !== start) {
      ctx.add(
        "menubar-arrow-backward",
        apg,
        expectedNext,
        `Pressing ${prevKey} (${orientation}, ${ctx.direction}) did not move focus back to ${describeNode(ctx.driver.root(), start)}.`
      )
    }
  }
})

// ---------------------------------------------------------------------------
// Pattern 15: tree
// ---------------------------------------------------------------------------

const checkTree = Effect.fnUntraced(function*(ctx: AuditCtx) {
  const apg = "APG Tree View"
  const root = ctx.driver.root()
  const trees = queryAllByRole(root, "tree")
  const tree = trees[0]
  if (tree === undefined) {
    ctx.add("tree-missing", apg, root, 'No element with role="tree" found.')
    return
  }
  ctx.violations.push(
    ...checkAccessibleName(root, tree, ctx.pattern, "tree-accessible-name", apg)
  )

  const items = queryAllByRole(tree, "treeitem")
  if (items.length < 2) {
    ctx.add(
      "treeitems-minimum",
      apg,
      tree,
      `Expected at least 2 visible role="treeitem" elements in tree, found ${items.length}.`
    )
    return
  }

  for (const item of items) {
    ctx.violations.push(
      ...checkAccessibleName(root, item, ctx.pattern, "treeitem-accessible-name", apg)
    )
    const expanded = getAttr(item, "aria-expanded")
    if (expanded !== undefined && !isBooleanAttr(expanded)) {
      ctx.add(
        "treeitem-aria-expanded",
        apg,
        item,
        `Treeitem aria-expanded must be "true" or "false", found "${expanded}".`
      )
    }
  }

  ctx.violations.push(
    ...checkRovingTabindex(root, items, ctx.pattern, apg, "treeitem")
  )

  if (ctx.options.staticOnly) return

  const focusable = items.filter((i) => !isHardDisabled(i))
  const firstFocusable = focusable[0]
  const lastFocusable = focusable[focusable.length - 1]
  if (focusable.length < 2 || firstFocusable === undefined || lastFocusable === undefined) return

  const start = focusable.find((i) => isTabStop(i)) ?? firstFocusable
  const startIdx = focusable.indexOf(start)
  yield* ctx.driver.focus(start)
  yield* ctx.driver.keydown(start, "ArrowDown")
  const afterDown = currentFocusedOrTabStop(ctx.driver, focusable)
  if (
    startIdx + 1 < focusable.length &&
    afterDown !== focusable[startIdx + 1]
  ) {
    ctx.add(
      "tree-arrow-down",
      apg,
      start,
      "Pressing ArrowDown in tree did not move focus to the next visible treeitem."
    )
  }
  yield* ctx.driver.keydown(afterDown ?? start, "End")
  if (currentFocusedOrTabStop(ctx.driver, focusable) !== lastFocusable) {
    ctx.add("tree-end", apg, afterDown ?? start, "Pressing End did not move focus to the last visible treeitem.")
  }
  yield* ctx.driver.keydown(lastFocusable, "Home")
  if (currentFocusedOrTabStop(ctx.driver, focusable) !== firstFocusable) {
    ctx.add("tree-home", apg, lastFocusable, "Pressing Home did not move focus to the first visible treeitem.")
  }
})

// ---------------------------------------------------------------------------
// Public entry points
// ---------------------------------------------------------------------------

/**
 * Audits a mounted `@effect/ui` `HtmlPlay` or DOM container against a WAI-ARIA
 * APG pattern and returns every violation collected.
 */
export const auditPattern = (
  target: A11yTarget,
  pattern: ApgPattern,
  options: CheckPatternOptions = {}
): Effect.Effect<ReadonlyArray<PatternViolation>> =>
  Effect.gen(function*() {
    const driver = yield* resolveDriver(target, options.settle)
    const ctx = makeCtx(driver, pattern, options)
    switch (pattern) {
      case "switch":
        yield* checkSwitch(ctx)
        break
      case "checkbox":
        yield* checkCheckbox(ctx)
        break
      case "disclosure":
        yield* checkDisclosure(ctx)
        break
      case "accordion":
        yield* checkAccordion(ctx)
        break
      case "tabs":
        yield* checkTabs(ctx)
        break
      case "radio-group":
        yield* checkRadioGroup(ctx)
        break
      case "toolbar":
        yield* checkToolbar(ctx)
        break
      case "slider":
        yield* checkSlider(ctx)
        break
      case "dialog":
        yield* checkDialogLike(ctx, "dialog")
        break
      case "alertdialog":
        yield* checkDialogLike(ctx, "alertdialog")
        break
      case "listbox":
        yield* checkListbox(ctx)
        break
      case "combobox":
        yield* checkCombobox(ctx)
        break
      case "menu":
        yield* checkMenu(ctx)
        break
      case "menubar":
        yield* checkMenubar(ctx)
        break
      case "tree":
        yield* checkTree(ctx)
        break
    }
    return ctx.violations
  })

/**
 * Verifies a mounted `@effect/ui` `HtmlPlay` or DOM container against a
 * WAI-ARIA APG pattern. Collects all violations into a single
 * `PatternViolationError`.
 */
export const checkPattern = (
  target: A11yTarget,
  pattern: ApgPattern,
  options: CheckPatternOptions = {}
): Effect.Effect<void, PatternViolationError> =>
  Effect.flatMap(auditPattern(target, pattern, options), (violations) =>
    violations.length === 0
      ? Effect.void
      : Effect.fail(new PatternViolationError({ pattern, violations }))
  )
