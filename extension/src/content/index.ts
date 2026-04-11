const SOLAI_MSG = 'SOLAI_PAGE_MSG'
const SOLAI_RESP = 'SOLAI_EXT_RESP'

// Relay messages from the page-context inject script to the service worker
window.addEventListener('message', async (event) => {
  if (event.source !== window) return
  if (event.data?.type !== SOLAI_MSG) return

  const { requestId, method, params } = event.data

  try {
    const result = await chrome.runtime.sendMessage({
      type: `SOLAI_${method.toUpperCase()}`,
      requestId,
      params: { ...params, origin: window.location.origin },
    })
    window.postMessage({ type: SOLAI_RESP, requestId, result }, '*')
  } catch (e: any) {
    window.postMessage({ type: SOLAI_RESP, requestId, error: e?.message ?? 'Unknown error' }, '*')
  }
})
