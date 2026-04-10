import * as Sentry from '@sentry/react'

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN

export function initSentry() {
  if (!SENTRY_DSN) {
    console.warn('[Sentry] VITE_SENTRY_DSN not set — error tracking disabled')
    return
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
    ],
    tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    beforeSend(event) {
      // Strip PII from breadcrumbs (LGPD compliance)
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map(bc => {
          if (bc.data?.url) {
            try {
              const url = new URL(bc.data.url)
              url.searchParams.delete('token')
              url.searchParams.delete('key')
              bc.data.url = url.toString()
            } catch { /* keep original */ }
          }
          return bc
        })
      }
      return event
    },
  })
}

export { Sentry }
