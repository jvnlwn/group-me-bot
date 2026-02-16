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
