const SOLAI_MSG = 'SOLAI_PAGE_MSG'
const SOLAI_RESP = 'SOLAI_EXT_RESP'

const PAGE_ORIGIN = window.location.origin || '*'

function safePostMessage(payload: Record<string, unknown>) {
  window.postMessage(payload, PAGE_ORIGIN)
}

// Receive sign results pushed from the service worker after the sign-approval popup closes.
chrome.runtime.onMessage.addListener((message) => {
  if (typeof message?.type !== 'string' || message.type !== 'SOLAI_SIGN_RESULT') return
  const { requestId, error } = message
  if (error) {
    safePostMessage({ type: SOLAI_RESP, requestId, error })
  } else {
    // Whitelist only expected fields — prevents prototype pollution via ...spread
    const safeResult: Record<string, unknown> = {}
    if ('signature'         in message) safeResult.signature         = message.signature
    if ('signedTransaction' in message) safeResult.signedTransaction = message.signedTransaction
    safePostMessage({ type: SOLAI_RESP, requestId, result: safeResult })
  }
})

// Relay messages from the page-context inject script to the service worker
window.addEventListener('message', async (event) => {
  if (event.source !== window) return
  if (typeof event.data?.type !== 'string' || event.data.type !== SOLAI_MSG) return

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
      const msg: string = e?.message ?? ''
      if (msg.includes('context invalidated') || msg.includes('Extension context') || msg.includes('message channel closed')) {
        safePostMessage({ type: SOLAI_RESP, requestId, error: '__SOLAI_CONTEXT_INVALIDATED__' })
        return
      }
      throw e
    }

    if (result?.queued) return

    if (result?.error) {
      safePostMessage({ type: SOLAI_RESP, requestId, error: result.error })
    } else {
      // Whitelist expected result fields — prevents prototype pollution
      const safeResult: Record<string, unknown> = {}
      if (result && typeof result === 'object') {
        const allowed = ['publicKey', 'signature', 'signedTransaction', 'queued', 'requestId']
        for (const key of allowed) {
          if (key in result) safeResult[key] = result[key]
        }
      }
      safePostMessage({ type: SOLAI_RESP, requestId, result: safeResult })
    }
  } catch (e: any) {
    safePostMessage({ type: SOLAI_RESP, requestId, error: e?.message ?? 'Unknown error' })
  }
})
