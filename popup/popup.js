// Popup controller — reads the last analysis result from storage and renders it.

const LEVEL_EMOJI = { low: '🟢', medium: '🟡', high: '🔴' }
const LEVEL_LABEL = { low: 'Low Risk', medium: 'Medium Risk', high: 'High Risk' }
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

  // risk header
  const header = $('risk-header')
  header.className = `risk-header ${level}`
  $('risk-emoji').textContent = LEVEL_EMOJI[level] || '🟡'
  $('risk-level').textContent = LEVEL_LABEL[level] || 'Unknown'
  $('job-info').textContent = job?.title
    ? `${job.title}${job.company ? ' · ' + job.company : ''}`
    : ''
  $('score-val').textContent = score

  // AI summary
  if (aiResult?.summary) {
    $('ai-summary').classList.remove('hidden')
    $('ai-summary-text').textContent = aiResult.summary
  } else {
    $('ai-summary').classList.add('hidden')
  }

  // flags
  const allFlags = [
    ...(flags || []).map(f => f.label),
    ...(aiResult?.flags || []).filter(f => !flags?.some(h => h.label === f))
  ]

  const list = $('flags-list')
  list.innerHTML = ''

  if (allFlags.length > 0) {
    $('flags-section').classList.remove('hidden')
    $('no-flags').classList.add('hidden')
    allFlags.forEach(label => {
      const li = document.createElement('li')
      li.textContent = label
      list.appendChild(li)
    })
  } else {
    $('flags-section').classList.add('hidden')
    $('no-flags').classList.remove('hidden')
  }

  // platform
  const platform = job?.platform
  $('platform-tag').textContent = platform ? `Analysed on ${PLATFORM_LABEL[platform] || platform}` : ''
}

async function init() {
  // load last result from storage
  chrome.runtime.sendMessage({ type: 'GET_LAST_RESULT' }, (result) => {
    if (chrome.runtime.lastError || !result) {
      showIdle()
      return
    }
    showResult(result)
  })

  // load saved API key into settings field
  chrome.runtime.sendMessage({ type: 'GET_API_KEY' }, (key) => {
    if (key) $('api-key-input').value = key
  })
}

// Settings toggle
$('settings-btn').addEventListener('click', () => {
  $('main-view').classList.add('hidden')
  $('settings-view').classList.remove('hidden')
})

$('back-btn').addEventListener('click', () => {
  $('settings-view').classList.add('hidden')
  $('main-view').classList.remove('hidden')
})

// Save API key
$('save-key-btn').addEventListener('click', () => {
  const key = $('api-key-input').value.trim()
  chrome.runtime.sendMessage({ type: 'SAVE_API_KEY', key }, () => {
    const status = $('save-status')
    status.classList.remove('hidden')
    setTimeout(() => status.classList.add('hidden'), 2000)
  })
})

document.addEventListener('DOMContentLoaded', init)
