(function () {
  // If already polling for this exact job, skip
  const currentId = (window.location.pathname.match(/\/jobs\/view\/(\d+)/) || [])[1]
  if (window.__jobshieldJobId === currentId && currentId) return
  window.__jobshieldJobId = currentId

  const POLL_INTERVAL = 1000
  const MAX_ATTEMPTS  = 25
  let attempts = 0

  function jobId() {
    return (window.location.pathname.match(/\/jobs\/view\/(\d+)/) || [])[1] || null
  }

  function stripHtml(h) {
    return h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }

  // ── Method 1: page <title> (always available, zero DOM scraping) ──
  // LinkedIn format: "Job Title | Company Name | LinkedIn"
  function titleAndCompany() {
    const parts = document.title.replace(' | LinkedIn', '').split(' | ')
    return {
      title:   parts[0]?.trim() || '',
      company: parts[1]?.trim() || ''
    }
  }

  // ── Method 2: JSON-LD structured data ──
  function fromJsonLd() {
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const raw = JSON.parse(s.textContent)
        const d   = Array.isArray(raw) ? raw.find(x => x['@type'] === 'JobPosting') : raw
        if (d?.['@type'] === 'JobPosting' && d.title) {
          const loc = d.jobLocation
          const location = [
            loc?.address?.addressLocality,
            loc?.address?.addressRegion,
            loc?.address?.addressCountry
          ].filter(Boolean).join(', ')

          const bv = d.baseSalary?.value
          const salary = bv
            ? (bv.minValue && bv.maxValue ? `$${bv.minValue}–$${bv.maxValue}` : `$${bv.value || ''}`)
            : ''

          return {
            title:          d.title,
            company:        d.hiringOrganization?.name || '',
            location,
            salary,
            description:    stripHtml(d.description || ''),
            recruiterEmail: '',
            companyWebsite: d.hiringOrganization?.sameAs || '',
            platform:       'linkedin',
            jobId:          jobId()
          }
        }
      } catch {}
    }
    return null
  }

  // ── Method 3: DOM scraping fallback ──
  function fromDom() {
    const tc    = titleAndCompany()
    const title = tc.title || document.querySelector('h1')?.innerText?.trim() || ''
    if (!title) return null

    const descEl = (
      document.querySelector('#job-details') ||
      document.querySelector('.jobs-description__content') ||
      document.querySelector('[class*="jobs-description"]') ||
      document.querySelector('article')
    )
    const desc = descEl?.innerText?.trim() || ''
    // Accept even short descriptions — something is better than nothing
    if (!desc) return null

    const emailMatch = desc.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)

    function text(sels) {
      for (const s of sels) {
        const t = document.querySelector(s)?.innerText?.trim()
        if (t) return t
      }
      return ''
    }

    return {
      title,
      company:        tc.company || text(['.jobs-unified-top-card__company-name a', 'a[href*="/company/"]']),
      location:       text(['.job-details-jobs-unified-top-card__bullet', '.jobs-unified-top-card__bullet']),
      salary:         text(['.compensation__salary', '[class*="salary"]']),
      description:    desc,
      recruiterEmail: emailMatch ? emailMatch[0] : '',
      companyWebsite: '',
      platform:       'linkedin',
      jobId:          jobId()
    }
  }

  // ── Method 4: last resort — title only, empty description ──
  function fromTitleOnly() {
    const tc = titleAndCompany()
    if (!tc.title || tc.title === 'LinkedIn') return null
    return {
      title:          tc.title,
      company:        tc.company,
      location:       '',
      salary:         '',
      description:    '',
      recruiterEmail: '',
      companyWebsite: '',
      platform:       'linkedin',
      jobId:          jobId()
    }
  }

  function extractJob() {
    return fromJsonLd() || fromDom() || fromTitleOnly()
  }

  function poll() {
    if (attempts >= MAX_ATTEMPTS) return
    attempts++

    const job = extractJob()
    if (!job) {
      setTimeout(poll, POLL_INTERVAL)
      return
    }

    window.dispatchEvent(new CustomEvent('jobshield:loading'))
    chrome.runtime.sendMessage({ type: 'ANALYSE_JOB', job }, (response) => {
      if (chrome.runtime.lastError || !response) return
      window.dispatchEvent(new CustomEvent('jobshield:result', { detail: response }))
    })
  }

  // URL polling for SPA navigation
  let lastHref = window.location.href
  setInterval(() => {
    const cur = window.location.href
    if (cur !== lastHref) {
      lastHref = cur
      attempts = 0
      window.__jobshieldJobId = null
      window.dispatchEvent(new CustomEvent('jobshield:clear'))
      chrome.storage.local.remove('lastResult')
      setTimeout(poll, 1500)
    }
  }, 800)

  // Start immediately — don't wait for DOM if title already available
  poll()
})()
