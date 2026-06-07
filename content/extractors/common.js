const JobShieldExtractors = (function () {
  const POLL_INTERVAL = 800
  const MAX_ATTEMPTS = 15

  function queryFirst(selectors) {
    return document.querySelector(selectors.join(','))
  }

  function queryFirstText(selectors) {
    for (const sel of selectors) {
      const t = document.querySelector(sel)?.innerText?.trim()
      if (t) return t
    }
    return ''
  }

  function analyseAndDispatch(job, { showLoading = true } = {}) {
    if (showLoading) {
      window.dispatchEvent(new CustomEvent('jobshield:loading'))
    }
    try {
      chrome.runtime.sendMessage({ type: 'ANALYSE_JOB', job }, (response) => {
        if (chrome.runtime.lastError || !response) return
        window.dispatchEvent(new CustomEvent('jobshield:result', { detail: response }))
      })
    } catch {}
  }

  return {
    POLL_INTERVAL,
    MAX_ATTEMPTS,
    queryFirst,
    queryFirstText,
    analyseAndDispatch
  }
})()
