import { describe, expect, test } from "vitest"
import { getOffsetAmount } from "./action.js"

const testCases = new Set([
  "/+1 => 1",
  "/-1 => -1",
  "/+1 john doe, jane doe => 1",
  "/+1 john doe, jane doe => 1",
  "/+ 1 => 1",
  "/+ 1 my newly minted 14 yo is coming! => 1",
  "/+ john doe => 1",
  "/+ john doe, jane doe => 2",
  "/+ john doe, jane doe and jim doe => 3",
  "/offset +1 => 1",
  "/offset -1 => -1",
  "/offset +1 john doe, jane doe => 1",
  "/offset +1 john doe, jane doe => 1",
  "/offset john doe => 1",
  "/offset john doe, jane doe => 2",
  "/offset john doe, jane doe and jim doe => 3",
  "/offset john doe, jane doe and jim doe! => 3",
  "/- 2 no longer coming! => -2",
  "/offset + 2 bringing a 14 yo! => 2",
  "/offset - 2 no longer coming! => -2",
  "/+\t2 john doe, jane doe, jim doe => 2",
  "/offset 0 nobody extra! => 0",
  "/offset -0 => 0",
  "/- john doe, jane doe and jim doe! => -3",
  "/offset john doe, jane doe and jim doe. => 3",
  "/offset john doe, jane doe & jim doe? => 3",
  "/offset Brandon and Amanda AND Sandra! => 3",
  "/offset Zoë, 李明 and José! => 3",
  "/offset John O'Neill and Anne-Marie! => 2",
  "/offset John, and Jane, & Jim, => 3",
  "/offset => 0",
  "/+ => 0",
  "/- => 0",
  "/offset - !!! => 0",
  "/offsetting John => 0",
  "John and Jane are coming => 0"
])

describe("getOffsetAmount", () => {
  test.each([...testCases])("%s", (testCase) => {
    const [text, expected] = testCase.split(" => ")
    expect(getOffsetAmount(text)).toBe(Number(expected))
  })
})
