(function () {
  const { POLL_INTERVAL, MAX_ATTEMPTS, queryFirst, analyseAndDispatch } = JobShieldExtractors
  let attempts = 0
  let lastAnalysedPath = null

  function extractJob() {
    const titleEl = queryFirst([
      '[data-automation="job-detail-title"]',
      'h1[class*="JobTitle"]',
      'h1[class*="jobTitle"]',
      '.FYwKg h1'
    ])

    const companyEl = queryFirst([
      '[data-automation="advertiser-name"]',
      'span[class*="AdvertiserName"]',
      'a[data-automation="job-detail-company"]'
    ])

    const locationEl = queryFirst([
      '[data-automation="job-detail-location"]',
      '[data-automation="job-detail-work-type"]',
      'span[class*="Location"]'
    ])

    const salaryEl = queryFirst([
      '[data-automation="job-detail-salary"]',
      'span[class*="Salary"]',
      '[class*="salary"]'
    ])

    const descEl = queryFirst([
      '[data-automation="jobAdDetails"]',
      '[class*="job-detail-preview"]',
      '.FYwKg section'
    ])

    const websiteEl = document.querySelector('[data-automation="company-website"] a')

    if (!titleEl || !descEl) return null

    return {
      title: titleEl.innerText?.trim() || '',
      company: companyEl?.innerText?.trim() || '',
      location: locationEl?.innerText?.trim() || '',
      salary: salaryEl?.innerText?.trim() || '',
      description: descEl.innerText?.trim() || '',
      recruiterEmail: extractFirstEmail(descEl.innerText || ''),
      companyWebsite: websiteEl?.href || '',
      platform: 'seek',
      jobKey: window.location.pathname
    }
  }

  function poll() {
    if (attempts >= MAX_ATTEMPTS) return
    attempts++

    const currentPath = window.location.pathname
    if (currentPath === lastAnalysedPath) return

    const job = extractJob()
    if (!job) {
      setTimeout(poll, POLL_INTERVAL)
      return
    }

    lastAnalysedPath = currentPath
    analyseAndDispatch(job)
  }

  let lastHref = window.location.href
  const observer = new MutationObserver(() => {
    if (window.location.href !== lastHref) {
      lastHref = window.location.href
      attempts = 0
      setTimeout(poll, 1000)
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })

  setTimeout(poll, 1500)
})()
