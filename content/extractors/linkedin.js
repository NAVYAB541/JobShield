(function () {
  // Prevent double-injection if script runs twice on same page
  if (window.__jobshieldRunning) return
  window.__jobshieldRunning = true

  const POLL_INTERVAL = 1000
  const MAX_ATTEMPTS  = 25
  let attempts = 0
  let lastAnalysedJobId = null

  function jobId() {
    const m = window.location.pathname.match(/\/jobs\/view\/(\d+)/)
    return m ? m[1] : null
  }

  function stripHtml(html) {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }

  // Method 1: JSON-LD structured data embedded by LinkedIn — most reliable
  function fromJsonLd() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]')
    for (const s of scripts) {
      try {
        const d = JSON.parse(s.textContent)
        const job = Array.isArray(d) ? d.find(x => x['@type'] === 'JobPosting') : d
        if (job?.['@type'] === 'JobPosting' && job.title) {
          const loc = job.jobLocation
          const location = [
            loc?.address?.addressLocality,
            loc?.address?.addressRegion,
            loc?.address?.addressCountry
          ].filter(Boolean).join(', ')

          let salary = ''
          if (job.baseSalary?.value) {
            const v = job.baseSalary.value
            salary = v.minValue && v.maxValue
              ? `$${v.minValue}–$${v.maxValue} ${v.unitText || ''}`.trim()
              : `$${v.value || ''} ${v.unitText || ''}`.trim()
          }

          return {
            title:          job.title,
            company:        job.hiringOrganization?.name || '',
            location,
            salary,
            description:    stripHtml(job.description || ''),
            recruiterEmail: '',
            companyWebsite: job.hiringOrganization?.sameAs || '',
            platform:       'linkedin',
            jobId:          jobId()
          }
        }
      } catch {}
    }
    return null
  }

  // Method 2: DOM scraping fallback
  function fromDom() {
    function text(selectors) {
      for (const s of selectors) {
        const el = document.querySelector(s)
        if (el?.innerText?.trim()) return el.innerText.trim()
      }
      return ''
    }

    const title = text([
      '.job-details-jobs-unified-top-card__job-title h1',
      '.jobs-unified-top-card__job-title h1',
      'h1.t-24', 'h1'
    ])

    const descEl = (
      document.querySelector('#job-details') ||
      document.querySelector('.jobs-description__content') ||
      document.querySelector('[class*="jobs-description"]')
    )

    if (!title || !descEl || descEl.innerText.trim().length < 50) return null

    const emailMatch = descEl.innerText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)

    return {
      title,
      company:        text(['.job-details-jobs-unified-top-card__company-name a', '.jobs-unified-top-card__company-name a', 'a[href*="/company/"]']),
      location:       text(['.job-details-jobs-unified-top-card__bullet', '.jobs-unified-top-card__bullet']),
      salary:         text(['.compensation__salary', '[class*="salary"]']),
      description:    descEl.innerText.trim(),
      recruiterEmail: emailMatch ? emailMatch[0] : '',
      companyWebsite: '',
      platform:       'linkedin',
      jobId:          jobId()
    }
  }

  function extractJob() {
    return fromJsonLd() || fromDom()
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
      if (chrome.runtime.lastError) return
      if (!response) return
      window.dispatchEvent(new CustomEvent('jobshield:result', { detail: response }))
    })
  }

  // URL polling for SPA navigation
  let lastHref = window.location.href
  setInterval(() => {
    const current = window.location.href
    if (current !== lastHref) {
      lastHref = current
      attempts = 0
      lastAnalysedJobId = null
      window.dispatchEvent(new CustomEvent('jobshield:clear'))
      chrome.storage.local.remove('lastResult')
      setTimeout(poll, 1500)
    }
  }, 800)

  setTimeout(poll, 1500)
})()
