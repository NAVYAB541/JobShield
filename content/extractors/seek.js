// Seek (seek.com.au) job page DOM extractor.

(function () {
  const POLL_INTERVAL = 800
  const MAX_ATTEMPTS = 15
  let attempts = 0
  let lastAnalysedPath = null

  function extractJob() {
    // Title
    const titleEl = document.querySelector([
      '[data-automation="job-detail-title"]',
      'h1[class*="JobTitle"]',
      'h1[class*="jobTitle"]',
      '.FYwKg h1'
    ].join(','))

    // Company
    const companyEl = document.querySelector([
      '[data-automation="advertiser-name"]',
      'span[class*="AdvertiserName"]',
      'a[data-automation="job-detail-company"]'
    ].join(','))

    // Location
    const locationEl = document.querySelector([
      '[data-automation="job-detail-location"]',
      '[data-automation="job-detail-work-type"]',
      'span[class*="Location"]'
    ].join(','))

    // Salary
    const salaryEl = document.querySelector([
      '[data-automation="job-detail-salary"]',
      'span[class*="Salary"]',
      '[class*="salary"]'
    ].join(','))

    // Description
    const descEl = document.querySelector([
      '[data-automation="jobAdDetails"]',
      '[class*="job-detail-preview"]',
      '.FYwKg section'
    ].join(','))

    // Company website (Seek sometimes shows it)
    const websiteEl = document.querySelector('[data-automation="company-website"] a')

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

    chrome.runtime.sendMessage({ type: 'ANALYSE_JOB', job }, (response) => {
      if (chrome.runtime.lastError || !response) return
      window.dispatchEvent(new CustomEvent('jobshield:result', { detail: response }))
    })
  }

  // Seek is a SPA — watch for navigation
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
