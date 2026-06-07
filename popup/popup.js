const PLATFORM_LABEL = { linkedin: 'LinkedIn', indeed: 'Indeed', seek: 'Seek' }

const EXTRACTION_CFG = {
  'json-ld':     { label: '// data: structured',    cls: 'ext-full'    },
  'dom':         { label: '// data: page scraped',  cls: 'ext-full'    },
  'title-only':  { label: '⚠ title only — limited confidence', cls: 'ext-limited' },
}

function $(id) { return document.getElementById(id) }

function showIdle() {
  $('idle-state').classList.remove('hidden')
  $('result-state').classList.add('hidden')
}

function showResult(result) {
  $('idle-state').classList.add('hidden')
  $('result-state').classList.remove('hidden')

  const { level, score, aiResult, job } = result

  const card = $('risk-card')
  card.className = `risk-card level-${level}`
  const levelCfg = RISK_LEVELS[level] || RISK_LEVELS.medium
  $('risk-icon').textContent    = levelCfg.emoji
  $('risk-label').textContent   = levelCfg.label
  $('risk-sublabel').textContent = levelCfg.sublabel
  $('job-title-small').textContent = job?.title
    ? `${job.title}${job.company ? ' · ' + job.company : ''}`
    : ''

  const pct = Math.min(score, 100)
  const arc = (pct / 100) * 88
  const gaugeArc = $('gauge-arc')
  gaugeArc.setAttribute('stroke-dasharray', `${arc} 88`)
  $('score-val').textContent = score

  $('threat-fill').style.width = `${pct}%`
  $('threat-pct').textContent = `${pct}%`

  if (aiResult?.summary) {
    $('ai-panel').classList.remove('hidden')
    $('ai-text').textContent = aiResult.summary
  } else {
    $('ai-panel').classList.add('hidden')
  }

  if (result.aiDisagreement) {
    $('ai-panel').classList.remove('hidden')
    $('ai-text').textContent =
      (aiResult?.summary ? aiResult.summary + ' ' : '') +
      '⚠ AI assessment differs from heuristic score — review carefully.'
  }

  const allFlags = mergeFlagLabels(result, { dedupe: true })

  const list = $('flags-list')
  list.innerHTML = ''

  if (allFlags.length > 0) {
    $('flags-panel').classList.remove('hidden')
    $('clear-panel').classList.add('hidden')
    $('flag-count').textContent = allFlags.length
    allFlags.forEach(label => {
      const li = document.createElement('li')
      li.textContent = label
      list.appendChild(li)
    })
  } else {
    $('flags-panel').classList.add('hidden')
    $('clear-panel').classList.remove('hidden')
  }

  const greenFlags = result.greenFlags || []
  const greenList = $('green-list')
  greenList.innerHTML = ''

  if (greenFlags.length > 0) {
    $('green-panel').classList.remove('hidden')
    $('green-count').textContent = greenFlags.length
    greenFlags.forEach(label => {
      const li = document.createElement('li')
      li.textContent = label
      greenList.appendChild(li)
    })
  } else {
    $('green-panel').classList.add('hidden')
  }

  const extCfg = EXTRACTION_CFG[result.extractionMethod]
  const extEl  = $('extraction-confidence')
  if (extCfg) {
    extEl.textContent  = extCfg.label
    extEl.className    = `extraction-confidence ${extCfg.cls}`
    extEl.classList.remove('hidden')
  } else {
    extEl.classList.add('hidden')
  }

  const ctx = result.context
  const ctxParts = [
    ctx?.roleType !== 'general' ? ctx?.roleType : null,
    ctx?.seniority !== 'mid'    ? ctx?.seniority : null,
    ctx?.employmentType !== 'unknown' ? ctx?.employmentType.replace('_', '-') : null,
    ctx?.region !== 'unknown'   ? ctx?.region : null
  ].filter(Boolean)
  const ctxEl = $('context-footer')
  if (ctxParts.length) {
    ctxEl.textContent = `// detected: ${ctxParts.join(' · ')}`
    ctxEl.classList.remove('hidden')
  } else {
    ctxEl.classList.add('hidden')
  }

  const platform = job?.platform
  $('platform-footer').textContent = platform
    ? `// scanned on ${PLATFORM_LABEL[platform] || platform}`
    : ''
}

const JOB_PAGE_RE = /linkedin\.com\/jobs\/view\/|indeed\.com\/viewjob|seek\.com\.au\/job\//

function extractorForUrl(url) {
  if (/linkedin\.com\/jobs/.test(url || '')) return 'content/extractors/linkedin.js'
  if (/indeed\.com/.test(url || '')) return 'content/extractors/indeed.js'
  if (/seek\.com\.au\/job/.test(url || '')) return 'content/extractors/seek.js'
  return null
}

function injectIfNeeded(tabId, tabUrl) {
  if (!JOB_PAGE_RE.test(tabUrl || '')) return
  const extractor = extractorForUrl(tabUrl)
  if (!extractor) return
  chrome.scripting.executeScript({ target: { tabId }, files: ['lib/text-utils.js'] }).catch(() => {})
  chrome.scripting.executeScript({ target: { tabId }, files: ['content/extractors/common.js'] }).catch(() => {})
  chrome.scripting.executeScript({ target: { tabId }, files: [extractor] }).catch(() => {})
  chrome.scripting.executeScript({ target: { tabId }, files: ['lib/risk-levels.js'] }).catch(() => {})
  chrome.scripting.executeScript({ target: { tabId }, files: ['lib/result-utils.js'] }).catch(() => {})
  chrome.scripting.executeScript({ target: { tabId }, files: ['content/overlay.js'] }).catch(() => {})
}

function init() {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !('lastResult' in changes)) return
    const next = changes.lastResult.newValue
    if (next) showResult(next)
    else showIdle()
  })

  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab) { showIdle(); return }

    chrome.runtime.sendMessage({ type: 'GET_LAST_RESULT' }, (result) => {
      if (chrome.runtime.lastError || !result) {
        showIdle()
        injectIfNeeded(tab.id, tab.url)
        return
      }

      const onJobPage    = JOB_PAGE_RE.test(tab.url || '')
      const tabJobId     = (tab.url?.match(/\/jobs\/view\/(\d+)/) || [])[1]
      const storedJobId  = result.job?.jobId
      const isStale      = !onJobPage || (tabJobId && storedJobId && String(tabJobId) !== String(storedJobId))

      if (isStale) {
        showIdle()
        injectIfNeeded(tab.id, tab.url)
      } else {
        showResult(result)
      }
    })
  })

  chrome.runtime.sendMessage({ type: 'GET_API_KEY' }, (key) => {
    if (key) $('api-key-input').value = key
  })
}

$('settings-btn').addEventListener('click', () => {
  $('main-view').classList.add('hidden')
  $('settings-view').classList.remove('hidden')
})

$('back-btn').addEventListener('click', () => {
  $('settings-view').classList.add('hidden')
  $('main-view').classList.remove('hidden')
})

$('save-key-btn').addEventListener('click', () => {
  const key = $('api-key-input').value.trim()
  chrome.runtime.sendMessage({ type: 'SAVE_API_KEY', key }, () => {
    const s = $('save-status')
    s.classList.remove('hidden')
    setTimeout(() => s.classList.add('hidden'), 2000)
  })
})

document.addEventListener('DOMContentLoaded', init)
