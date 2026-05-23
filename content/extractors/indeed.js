// Indeed job page DOM extractor.
// Handles both /viewjob and /jobs search result pages with inline preview panel.

(function () {
  const POLL_INTERVAL = 800
  const MAX_ATTEMPTS = 15
  let attempts = 0
  let lastAnalysedKey = null

  function extractJob() {
    // Title
    const titleEl = document.querySelector([
      '[data-testid="jobsearch-JobInfoHeader-title"]',
      '.jobsearch-JobInfoHeader-title',
      'h1.icl-u-xs-mb--xs',
      'h1[class*="jobTitle"]'
    ].join(','))

    // Company
    const companyEl = document.querySelector([
      '[data-testid="inlineHeader-companyName"] a',
      '[data-testid="inlineHeader-companyName"]',
      '.jobsearch-InlineCompanyRating-companyHeader a',
      '[data-company-name]'
    ].join(','))

    // Location
    const locationEl = document.querySelector([
      '[data-testid="job-location"]',
      '.jobsearch-JobInfoHeader-subtitle [data-testid]',
      '#jobLocationText'
    ].join(','))

    // Salary
    const salaryEl = document.querySelector([
      '[data-testid="attribute_snippet_testid"]',
      '#salaryInfoAndJobType span',
      '.attribute_snippet'
    ].join(','))

    // Description
    const descEl = document.querySelector([
      '#jobDescriptionText',
      '.jobsearch-jobDescriptionText',
      '[data-testid="jobDescriptionText"]'
    ].join(','))

    const emailMatch = (descEl?.innerText || '').match(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
    )

    if (!titleEl || !descEl) return null

    const jobKey = titleEl.innerText?.trim() + '|' + (companyEl?.innerText?.trim() || '')

    return {
      title: titleEl.innerText?.trim() || '',
      company: companyEl?.innerText?.trim() || '',
      location: locationEl?.innerText?.trim() || '',
      salary: salaryEl?.innerText?.trim() || '',
      description: descEl.innerText?.trim() || '',
      recruiterEmail: emailMatch ? emailMatch[0] : '',
      companyWebsite: '',
      platform: 'indeed',
      jobKey
    }
  }

  function poll() {
    if (attempts >= MAX_ATTEMPTS) return
    attempts++

    const job = extractJob()
    if (!job) {
      setTimeout(poll, POLL_INTERVAL)
      return
    }

    if (job.jobKey === lastAnalysedKey) return
    lastAnalysedKey = job.jobKey

    chrome.runtime.sendMessage({ type: 'ANALYSE_JOB', job }, (response) => {
      if (chrome.runtime.lastError || !response) return
      window.dispatchEvent(new CustomEvent('jobshield:result', { detail: response }))
    })
  }

  // re-run when Indeed loads a new job in the preview panel
  const observer = new MutationObserver(() => {
    const newKey = (document.querySelector('[data-testid="jobsearch-JobInfoHeader-title"]')?.innerText || '') +
      (document.querySelector('[data-testid="inlineHeader-companyName"]')?.innerText || '')
    if (newKey && newKey !== lastAnalysedKey) {
      attempts = 0
      setTimeout(poll, 600)
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })

  setTimeout(poll, 1500)
})()
