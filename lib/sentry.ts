import * as Sentry from "@sentry/node"

let initialized = false

function initSentry(): void {
  if (initialized) return
  const dsn = process.env.SENTRY_DSN
  if (dsn) {
    Sentry.init({
      dsn,
      sendDefaultPii: true
    })
    initialized = true
  }
}

export interface CaptureApiErrorContext {
  endpoint: string
  groupId?: string
  action?: string
}

export interface CaptureGroupMeApiErrorContext {
  endpoint: string
  method: string
  status: number
  statusText?: string
  groupId?: string
  messageId?: string
  pollId?: string
  botId?: string
}

/**
 * Reports GroupMe API HTTP failures to Sentry. Call right before throwing
 * when a direct api.groupme.com request returns a non-OK/non-202 response.
 */
export function captureGroupMeApiError(
  message: string,
  context: CaptureGroupMeApiErrorContext
): void {
  initSentry()
  if (!process.env.SENTRY_DSN) return

  const err = new Error(message)

  Sentry.withScope((scope) => {
    scope.setTag("source", "groupme_api")
    scope.setTag("endpoint", context.endpoint)
    scope.setTag("method", context.method)
    scope.setTag("status", String(context.status))
    if (context.statusText) scope.setTag("statusText", context.statusText)
    if (context.groupId) scope.setTag("groupId", context.groupId)
    if (context.messageId) scope.setTag("messageId", context.messageId)
    if (context.pollId) scope.setTag("pollId", context.pollId)
    if (context.botId) scope.setTag("botId", context.botId)
    Sentry.captureException(err)
  })
}

/**
 * Normalizes unknown error values to an Error instance and reports to Sentry.
 * Call this from API catch blocks for unexpected errors.
 */
export function captureApiError(
  error: unknown,
  context: CaptureApiErrorContext
): void {
  initSentry()
  if (!process.env.SENTRY_DSN) return

  const err = error instanceof Error ? error : new Error(String(error))

  Sentry.withScope((scope) => {
    scope.setTag("endpoint", context.endpoint)
    if (context.groupId) scope.setTag("groupId", context.groupId)
    if (context.action) scope.setTag("action", context.action)
    Sentry.captureException(err)
  })
}
