(function () {
  const { POLL_INTERVAL, MAX_ATTEMPTS, queryFirst, analyseAndDispatch } = JobShieldExtractors
  let attempts = 0
  let lastAnalysedKey = null

  function extractJob() {
    const titleEl = queryFirst([
      '[data-testid="jobsearch-JobInfoHeader-title"]',
      '.jobsearch-JobInfoHeader-title',
      'h1.icl-u-xs-mb--xs',
      'h1[class*="jobTitle"]'
    ])

    const companyEl = queryFirst([
      '[data-testid="inlineHeader-companyName"] a',
      '[data-testid="inlineHeader-companyName"]',
      '.jobsearch-InlineCompanyRating-companyHeader a',
      '[data-company-name]'
    ])

    const locationEl = queryFirst([
      '[data-testid="job-location"]',
      '.jobsearch-JobInfoHeader-subtitle [data-testid]',
      '#jobLocationText'
    ])

    const salaryEl = queryFirst([
      '[data-testid="attribute_snippet_testid"]',
      '#salaryInfoAndJobType span',
      '.attribute_snippet'
    ])

    const descEl = queryFirst([
      '#jobDescriptionText',
      '.jobsearch-jobDescriptionText',
      '[data-testid="jobDescriptionText"]'
    ])

    if (!titleEl || !descEl) return null

    const jobKey = titleEl.innerText?.trim() + '|' + (companyEl?.innerText?.trim() || '')

    return {
      title: titleEl.innerText?.trim() || '',
      company: companyEl?.innerText?.trim() || '',
      location: locationEl?.innerText?.trim() || '',
      salary: salaryEl?.innerText?.trim() || '',
      description: descEl.innerText?.trim() || '',
      recruiterEmail: extractFirstEmail(descEl.innerText || ''),
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

    analyseAndDispatch(job)
  }

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
