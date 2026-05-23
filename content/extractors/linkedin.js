(function () {
  const POLL_INTERVAL = 1000
  const MAX_ATTEMPTS  = 20
  let attempts = 0
  let lastAnalysedJobId = null

  function jobId() {
    const m = window.location.pathname.match(/\/jobs\/view\/(\d+)/)
    return m ? m[1] : null
  }

  function getText(selectors) {
    for (const sel of selectors) {
      const el = document.querySelector(sel)
      if (el && el.innerText?.trim()) return el.innerText.trim()
    }
    return ''
  }

  function extractJob() {
    // Title — try specific selectors then fall back to the page's only h1
    const title = getText([
      '.job-details-jobs-unified-top-card__job-title h1',
      '.jobs-unified-top-card__job-title h1',
      '.jobs-unified-top-card__job-title',
      '.job-details-jobs-unified-top-card__job-title',
      'h1.t-24', 'h1'
    ])

    // Description — the most important element
    const descEl = (
      document.querySelector('#job-details') ||
      document.querySelector('.jobs-description__content') ||
      document.querySelector('.jobs-description-content__text--stretch') ||
      document.querySelector('[class*="jobs-description"]') ||
      document.querySelector('.jobs-box__html-content')
    )

    // Must have at least title + description to proceed
    if (!title || !descEl) return null

    const desc = descEl.innerText?.trim() || ''
    if (desc.length < 50) return null   // description not rendered yet

    const company = getText([
      '.job-details-jobs-unified-top-card__company-name a',
      '.job-details-jobs-unified-top-card__company-name',
      '.jobs-unified-top-card__company-name a',
      '.jobs-unified-top-card__company-name',
      '[data-tracking-control-name*="company"] span',
      'a[href*="/company/"]'
    ])

    const location = getText([
      '.job-details-jobs-unified-top-card__bullet',
      '.jobs-unified-top-card__bullet',
      '.job-details-jobs-unified-top-card__workplace-type',
      '[class*="unified-top-card"] [class*="bullet"]'
    ])

    const salary = getText([
      '.compensation__salary',
      '[class*="salary"]',
      '[data-test-id="base-salary-info"]'
    ])

    const emailMatch = desc.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)

    return {
      title,
      company,
      location,
      salary,
      description: desc,
      recruiterEmail: emailMatch ? emailMatch[0] : '',
      companyWebsite: '',
      platform: 'linkedin',
      jobId: jobId()
    }
  }

  function poll() {
    if (attempts >= MAX_ATTEMPTS) return
    attempts++

    const id = jobId()
    if (id && id === lastAnalysedJobId) return

    const job = extractJob()
    if (!job) {
      setTimeout(poll, POLL_INTERVAL)
      return
    }

    lastAnalysedJobId = id
    window.dispatchEvent(new CustomEvent('jobshield:loading'))

    chrome.runtime.sendMessage({ type: 'ANALYSE_JOB', job }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[JobShield] runtime error:', chrome.runtime.lastError.message)
        return
      }
      if (!response) return
      window.dispatchEvent(new CustomEvent('jobshield:result', { detail: response }))
    })
  }

  // Watch for LinkedIn SPA navigation
  let lastPath = window.location.pathname
  new MutationObserver(() => {
    if (window.location.pathname !== lastPath) {
      lastPath = window.location.pathname
      attempts = 0
      window.dispatchEvent(new CustomEvent('jobshield:clear'))
      setTimeout(poll, 1200)
    }
  }).observe(document.body, { childList: true, subtree: true })

  // Initial run
  setTimeout(poll, 2000)
})()
