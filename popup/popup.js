const LEVEL_LABEL   = { low: 'LOW RISK', medium: 'MEDIUM RISK', high: 'HIGH RISK' }
const LEVEL_EMOJI   = { low: '🟢', medium: '🟡', high: '🔴' }
const PLATFORM_LABEL = { linkedin: 'LinkedIn', indeed: 'Indeed', seek: 'Seek' }

function $(id) { return document.getElementById(id) }

function showIdle() {
  $('idle-state').classList.remove('hidden')
  $('result-state').classList.add('hidden')
}

function showResult(result) {
  $('idle-state').classList.add('hidden')
  $('result-state').classList.remove('hidden')

  const { level, score, flags, aiResult, job } = result

  // ── Risk card ──
  const card = $('risk-card')
  card.className = `risk-card level-${level}`
  $('risk-icon').textContent = LEVEL_EMOJI[level] || '🟡'
  $('risk-label').textContent = LEVEL_LABEL[level] || 'UNKNOWN'
  $('job-title-small').textContent = job?.title
    ? `${job.title}${job.company ? ' · ' + job.company : ''}`
    : ''

  // ── Score gauge ──
  // circumference of r=14 circle ≈ 87.96, we use 88
  const pct = Math.min(score, 100)
  const arc = (pct / 100) * 88
  const gaugeArc = $('gauge-arc')
  gaugeArc.setAttribute('stroke-dasharray', `${arc} 88`)
  $('score-val').textContent = score

  // ── Threat bar ──
  $('threat-fill').style.width = `${pct}%`
  $('threat-pct').textContent = `${pct}%`

  // ── AI panel ──
  if (aiResult?.summary) {
    $('ai-panel').classList.remove('hidden')
    $('ai-text').textContent = aiResult.summary
  } else {
    $('ai-panel').classList.add('hidden')
  }

  // ── Risk flags ──
  const allFlags = [
    ...(flags || []).map(f => f.label),
    ...(aiResult?.flags || []).filter(f => !flags?.some(h => h.label === f))
  ]

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

  // ── Green flags ──
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

  // ── Footer ──
  const platform = job?.platform
  $('platform-footer').textContent = platform
    ? `// scanned on ${PLATFORM_LABEL[platform] || platform}`
    : ''
}

const JOB_PAGE_RE = /linkedin\.com\/jobs\/view\/|indeed\.com\/viewjob|seek\.com\.au\/job\//

function injectIfNeeded(tabId, tabUrl) {
  if (!JOB_PAGE_RE.test(tabUrl || '')) return
  // inject content scripts into the active tab so no page refresh is needed
  chrome.scripting.executeScript({ target: { tabId }, files: ['content/extractors/linkedin.js'] }).catch(() => {})
  chrome.scripting.executeScript({ target: { tabId }, files: ['content/overlay.js'] }).catch(() => {})
}

function init() {
  // Live-update: re-render whenever background writes a new result to storage
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !('lastResult' in changes)) return
    const next = changes.lastResult.newValue
    if (next) showResult(next)
    else showIdle()
  })

  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab) { showIdle(); return }

    // Load stored result for this tab
    chrome.runtime.sendMessage({ type: 'GET_LAST_RESULT' }, (result) => {
      if (chrome.runtime.lastError || !result) {
        showIdle()
        // No result yet — inject scripts so it works without a page refresh
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
