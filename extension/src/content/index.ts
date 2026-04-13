const SOLAI_MSG = 'SOLAI_PAGE_MSG'
const SOLAI_RESP = 'SOLAI_EXT_RESP'

// Receive sign results pushed from the service worker after unlock.
// This path is taken when the wallet was locked at sign time — the SW deferred
// the signing, opened an unlock popup, and now pushes the result here.
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== 'SOLAI_SIGN_RESULT') return
  const { requestId, error } = message
  if (error) {
    window.postMessage({ type: SOLAI_RESP, requestId, error }, '*')
  } else {
    const { type: _t, requestId: _r, error: _e, ...result } = message
    window.postMessage({ type: SOLAI_RESP, requestId, result }, '*')
  }
})

// Relay messages from the page-context inject script to the service worker
window.addEventListener('message', async (event) => {
  if (event.source !== window) return
  if (event.data?.type !== SOLAI_MSG) return

  const { requestId, method, params } = event.data

  try {
    let result: any
    try {
      result = await chrome.runtime.sendMessage({
        type: `SOLAI_${method.toUpperCase()}`,
        requestId,
        params: { ...params, origin: window.location.origin },
      })
    } catch (e: any) {
      // Extension was reloaded while this page was open — the content script
      // context is permanently invalidated until the page is refreshed.
      const msg: string = e?.message ?? ''
      if (msg.includes('context invalidated') || msg.includes('Extension context') || msg.includes('message channel closed')) {
        window.postMessage({ type: SOLAI_RESP, requestId, error: '__SOLAI_CONTEXT_INVALIDATED__' }, '*')
        return
      }
      throw e
    }

    // Wallet was locked — sign request is queued in session storage.
    // The result will arrive via chrome.runtime.onMessage (SOLAI_SIGN_RESULT)
    // once the user unlocks, so we leave the inject.ts promise pending.
    if (result?.queued) return

    if (result?.error) {
      window.postMessage({ type: SOLAI_RESP, requestId, error: result.error }, '*')
    } else {
      window.postMessage({ type: SOLAI_RESP, requestId, result }, '*')
    }
  } catch (e: any) {
    window.postMessage({ type: SOLAI_RESP, requestId, error: e?.message ?? 'Unknown error' }, '*')
  }
})
