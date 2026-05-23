// LinkedIn job page DOM extractor.
// Runs as a content script on linkedin.com/jobs/* pages.
// Polls for the job panel because LinkedIn renders asynchronously.

(function () {
  const POLL_INTERVAL = 800
  const MAX_ATTEMPTS = 15
  let attempts = 0
  let lastAnalysedJobId = null

  function extractJobId() {
    // from URL like /jobs/view/1234567890/
    const match = window.location.pathname.match(/\/jobs\/view\/(\d+)/)
    return match ? match[1] : null
  }

  function extractJob() {
    const titleEl = document.querySelector([
      '.jobs-unified-top-card__job-title',
      '.job-details-jobs-unified-top-card__job-title',
      'h1.t-24'
    ].join(','))

    const companyEl = document.querySelector([
      '.jobs-unified-top-card__company-name a',
      '.jobs-unified-top-card__company-name',
      '.job-details-jobs-unified-top-card__company-name a',
      '.job-details-jobs-unified-top-card__company-name'
    ].join(','))

    const locationEl = document.querySelector([
      '.jobs-unified-top-card__bullet',
      '.job-details-jobs-unified-top-card__bullet'
    ].join(','))

    const salaryEl = document.querySelector([
      '.jobs-unified-top-card__job-insight span',
      '.compensation__salary',
      '[data-test-id="base-salary-info"]'
    ].join(','))

    const descEl = document.querySelector([
      '.jobs-description__content .jobs-box__html-content',
      '.jobs-description-content__text',
      '#job-details'
    ].join(','))

    const emailMatch = (descEl?.innerText || '').match(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
    )

    if (!titleEl || !descEl) return null

    return {
      title: titleEl.innerText?.trim() || '',
      company: companyEl?.innerText?.trim() || '',
      location: locationEl?.innerText?.trim() || '',
      salary: salaryEl?.innerText?.trim() || '',
      description: descEl.innerText?.trim() || '',
      recruiterEmail: emailMatch ? emailMatch[0] : '',
      companyWebsite: '',
      platform: 'linkedin',
      jobId: extractJobId()
    }
  }

  function poll() {
    if (attempts >= MAX_ATTEMPTS) return
    attempts++

    const jobId = extractJobId()
    if (jobId && jobId === lastAnalysedJobId) return

    const job = extractJob()
    if (!job) {
      setTimeout(poll, POLL_INTERVAL)
      return
    }

    lastAnalysedJobId = jobId
    chrome.runtime.sendMessage({ type: 'ANALYSE_JOB', job }, (response) => {
      if (chrome.runtime.lastError || !response) return
      window.dispatchEvent(new CustomEvent('jobshield:result', { detail: response }))
    })
  }

  // re-run on LinkedIn SPA navigation
  let lastPath = window.location.pathname
  const observer = new MutationObserver(() => {
    if (window.location.pathname !== lastPath) {
      lastPath = window.location.pathname
      attempts = 0
      setTimeout(poll, 1000)
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })

  setTimeout(poll, 1500)
})()
