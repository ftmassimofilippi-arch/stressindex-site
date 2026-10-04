import * as Sentry from '@sentry/nextjs'
import { sentryOptions } from '@/lib/sentry-options'

// Runtime Node (pagine server, route API). Caricato da `instrumentation.ts`.
Sentry.init(sentryOptions)
