import { describe, expect, test } from "bun:test"
import {
  canTransferItem,
  findTransferItem,
  moveTransferItemByKey,
  type TransferContainer,
  transferItem
} from "../../src/direct/index.js"

interface Card {
  readonly id: string
  readonly title: string
  readonly locked?: boolean
}

const makeBoard = (): ReadonlyArray<TransferContainer<Card>> => [
  {
    id: "todo",
    items: [
      { id: "c1", title: "Spec" },
      { id: "c2", title: "Build", locked: true }
    ]
  },
  {
    id: "doing",
    maxItems: 1,
    items: [{ id: "c3", title: "Review" }]
  },
  {
    id: "done",
    items: []
  }
]

describe("Cross-container drag-and-drop transfer", () => {
  test("transfers items across containers and enforces maxItems and accept predicates", () => {
    const board = makeBoard()
    expect(findTransferItem(board, "c1")?.location).toEqual({ containerId: "todo", index: 0 })

    // doing is at maxItems: 1
    expect(canTransferItem(board, "c1", "doing")).toBe(false)
    const blocked = transferItem(board, "c1", { containerId: "doing", index: 0 })
    expect(blocked.moved).toBe(false)
    expect(blocked.containers).toBe(board)

    // accept predicate rejects locked cards moving to done
    const accept = (card: Card, targetId: string) => !(card.locked && targetId === "done")
    expect(canTransferItem(board, "c2", "done", { accept })).toBe(false)

    // valid transfer to done
    const moved = transferItem(board, "c1", { containerId: "done", index: 5 }, { accept })
    expect(moved.moved).toBe(true)
    expect(moved.from).toEqual({ containerId: "todo", index: 0 })
    expect(moved.to).toEqual({ containerId: "done", index: 0 })
    expect(moved.containers[0]!.items.map((c) => c.id)).toEqual(["c2"])
    expect(moved.containers[2]!.items.map((c) => c.id)).toEqual(["c1"])
  })

  test("reorders within container and moves across columns via keyboard (LTR and RTL)", () => {
    const board = makeBoard()
    const reordered = moveTransferItemByKey(board, "c1", "ArrowDown")
    expect(reordered.moved).toBe(true)
    expect(reordered.containers[0]!.items.map((c) => c.id)).toEqual(["c2", "c1"])

    // ArrowRight from todo skips full 'doing' column and lands in 'done'
    const jumped = moveTransferItemByKey(board, "c1", "ArrowRight")
    expect(jumped.moved).toBe(true)
    expect(jumped.to).toEqual({ containerId: "done", index: 0 })

    // In RTL, ArrowLeft moves right-to-left toward higher container index
    const rtlJumped = moveTransferItemByKey(board, "c1", "ArrowLeft", { dir: "rtl" })
    expect(rtlJumped.moved).toBe(true)
    expect(rtlJumped.to).toEqual({ containerId: "done", index: 0 })
  })
})
