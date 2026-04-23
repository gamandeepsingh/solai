import posthog from 'posthog-js'

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://us.i.posthog.com'

export function initAnalytics() {
  if (!KEY) return
  posthog.init(KEY, {
    api_host: HOST,
    person_profiles: 'identified_only',
    capture_pageview: false,
    capture_pageleave: false,
    autocapture: false,
    // Disable the /decide endpoint — it injects a remote script which MV3 blocks under script-src 'self'
    advanced_disable_decide: true,
    disable_session_recording: true,
    disable_surveys: true,
  })
}

export function track(event: string, props?: Record<string, unknown>) {
  if (!KEY) return
  posthog.capture(event, props)
}

export function identifyWallet(publicKey: string) {
  if (!KEY) return
  posthog.identify(publicKey)
}

export function resetIdentity() {
  if (!KEY) return
  posthog.reset()
}
