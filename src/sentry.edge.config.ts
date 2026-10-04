import * as Sentry from '@sentry/nextjs'
import { sentryOptions } from '@/lib/sentry-options'

// Runtime edge (il middleware). Caricato da `instrumentation.ts`.
Sentry.init(sentryOptions)
