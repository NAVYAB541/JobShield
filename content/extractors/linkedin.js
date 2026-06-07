(function () {
  if (!/\/jobs\/view\/\d+/.test(window.location.pathname)) return

  const currentId = (window.location.pathname.match(/\/jobs\/view\/(\d+)/) || [])[1]
  if (window.__jobshieldJobId === currentId && currentId) return
  window.__jobshieldJobId = currentId

  const POLL_INTERVAL = 1000
  const MAX_ATTEMPTS  = 25
  let attempts = 0

  function jobId() {
    return (window.location.pathname.match(/\/jobs\/view\/(\d+)/) || [])[1] || null
  }

  function titleAndCompany() {
    const parts = document.title.replace(' | LinkedIn', '').split(' | ')
    return {
      title:   parts[0]?.trim() || '',
      company: parts[1]?.trim() || ''
    }
  }

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
            jobId:          jobId(),
            extractionMethod: 'json-ld'
          }
        }
      } catch {}
    }
    return null
  }

  function findDescription() {
    const specific = [
      '#job-details',
      '.jobs-description__content',
      '.jobs-description-content__text--stretch',
      '[class*="jobs-description-content__text"]',
      '[class*="jobs-description"]',
      '.jobs-box__html-content',
      'article'
    ]
    for (const sel of specific) {
      const el = document.querySelector(sel)
      if (el?.innerText?.trim().length > 100) return el.innerText.trim()
    }

    for (const heading of document.querySelectorAll('h2, h3, h4')) {
      if (/about the job|about this role/i.test(heading.innerText)) {
        let el = heading.parentElement
        for (let i = 0; i < 5; i++) {
          if (el?.innerText?.trim().length > 300) return el.innerText.trim()
          el = el?.parentElement
        }
      }
    }

    let best = { len: 200, text: '' }
    for (const el of document.querySelectorAll('div, section')) {
      if (el.querySelector('nav, header') || el.closest('nav, header')) continue
      const t = el.innerText?.trim() || ''
      if (t.length > best.len) best = { len: t.length, text: t }
    }
    return best.text
  }

  function fromDom() {
    const tc    = titleAndCompany()
    const title = tc.title || document.querySelector('h1')?.innerText?.trim() || ''
    if (!title) return null

    const desc = findDescription()
    if (!desc) return null

    const recruiterTitle = JobShieldExtractors.queryFirstText([
      '[class*="hirer-card"] .artdeco-entity-lockup__subtitle',
      '[class*="hiring-team"] .artdeco-entity-lockup__subtitle',
      '.jobs-poster__description',
      '.hirer-card__description',
      '[data-test-id="job-poster-title"]',
      '[class*="job-poster"] [class*="subtitle"]'
    ])

    return {
      title,
      company:        tc.company || JobShieldExtractors.queryFirstText(['.jobs-unified-top-card__company-name a', 'a[href*="/company/"]']),
      location:       JobShieldExtractors.queryFirstText(['.job-details-jobs-unified-top-card__bullet', '.jobs-unified-top-card__bullet']),
      salary:         JobShieldExtractors.queryFirstText(['.compensation__salary', '[class*="salary"]']),
      description:    desc,
      recruiterEmail: extractFirstEmail(desc),
      recruiterTitle,
      companyWebsite: '',
      platform:       'linkedin',
      jobId:          jobId(),
      extractionMethod: 'dom'
    }
  }

  function fromTitleOnly() {
    const tc = titleAndCompany()
    if (!tc.title || tc.title === 'LinkedIn') return null
    return {
      title: tc.title, company: tc.company,
      location: '', salary: '', description: '',
      recruiterEmail: '', companyWebsite: '',
      platform: 'linkedin', jobId: jobId(),
      extractionMethod: 'title-only'
    }
  }

  function extractJob(last = false) {
    return fromJsonLd() || fromDom() || (last ? fromTitleOnly() : null)
  }

  function poll() {
    attempts++
    const isLast = attempts >= MAX_ATTEMPTS
    const job = extractJob(isLast)

    if (!job) {
      if (!isLast) setTimeout(poll, POLL_INTERVAL)
      return
    }

    JobShieldExtractors.analyseAndDispatch(job)
  }

  let lastHref = window.location.href
  setInterval(() => {
    const cur = window.location.href
    if (cur === lastHref) return
    lastHref = cur
    attempts = 0
    window.__jobshieldJobId = null
    window.dispatchEvent(new CustomEvent('jobshield:clear'))
    try { chrome.storage?.local?.remove('lastResult') } catch {}
    if (/\/jobs\/view\/\d+/.test(cur)) setTimeout(poll, 1500)
  }, 800)

  poll()
})()
