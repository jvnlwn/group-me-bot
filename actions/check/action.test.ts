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
  "/offset john doe, jane doe and jim doe! => 3"
])

// @ts-expect-error - Named capturing groups are only available when targeting 'ES2018' or later.
const testCaseRe = /(?<text>.+) => (?<expected>.+)/

describe("getOffsetAmount", () => {
  testCases.forEach((testCase) => {
    const match = testCase.match(testCaseRe)
    if (match) {
      const { text, expected } = match.groups
      test(testCase, () => {
        expect(getOffsetAmount(text)).toBe(parseInt(expected))
      })
    }
  })
})
