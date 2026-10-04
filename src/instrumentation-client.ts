import * as Sentry from '@sentry/nextjs'
import { sentryOptions } from '@/lib/sentry-options'

// Browser. Il file viene iniettato nel bundle da `withSentryConfig`.
Sentry.init(sentryOptions)

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
