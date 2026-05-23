// Service worker — orchestrates heuristics + optional Groq AI analysis.
// Receives ANALYSE_JOB messages from content scripts.

importScripts('../lib/heuristics.js')
importScripts('../lib/groq.js')

// cache recent results to avoid re-analysing the same job
const resultCache = new Map()

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ANALYSE_JOB') {
    handleAnalysis(message.job, sender)
      .then(sendResponse)
      .catch(() => sendResponse(null))
    return true // keep channel open for async response
  }

  if (message.type === 'GET_LAST_RESULT') {
    chrome.storage.local.get('lastResult', ({ lastResult }) => {
      sendResponse(lastResult || null)
    })
    return true
  }

  if (message.type === 'SAVE_API_KEY') {
    chrome.storage.local.set({ groqApiKey: message.key }, () => sendResponse({ ok: true }))
    return true
  }

  if (message.type === 'GET_API_KEY') {
    chrome.storage.local.get('groqApiKey', ({ groqApiKey }) => sendResponse(groqApiKey || ''))
    return true
  }
})

async function handleAnalysis(job, sender) {
  const cacheKey = job.jobId || job.jobKey || (job.title + job.company)
  if (resultCache.has(cacheKey)) {
    return resultCache.get(cacheKey)
  }

  // Step 1: heuristics (always runs, instant)
  const heuristic = analyseJob(job)

  let result = {
    level: heuristic.level,
    score: Math.min(heuristic.score, 100),
    flags: heuristic.flags,
    aiResult: null,
    job: {
      title: job.title,
      company: job.company,
      platform: job.platform
    }
  }

  // Step 2: AI pass only for medium-risk jobs (borderline)
  if (heuristic.level === 'medium') {
    const { groqApiKey } = await chrome.storage.local.get('groqApiKey')
    if (groqApiKey) {
      const aiResult = await analyseWithGroq(job, groqApiKey)
      if (aiResult) {
        result.aiResult = aiResult
        // let AI override level if it's more confident
        if (aiResult.confidence >= 70) {
          result.level = aiResult.risk_level
        }
      }
    }
  }

  // also run AI on high-risk posts if key is available (to provide explanation)
  if (heuristic.level === 'high' && !result.aiResult) {
    const { groqApiKey } = await chrome.storage.local.get('groqApiKey')
    if (groqApiKey) {
      const aiResult = await analyseWithGroq(job, groqApiKey)
      if (aiResult) result.aiResult = aiResult
    }
  }

  resultCache.set(cacheKey, result)
  // cap cache size
  if (resultCache.size > 50) {
    const firstKey = resultCache.keys().next().value
    resultCache.delete(firstKey)
  }

  // persist for popup to read
  await chrome.storage.local.set({ lastResult: result })

  // update extension badge icon
  updateBadgeIcon(result.level, sender.tab?.id)

  return result
}

function updateBadgeIcon(level, tabId) {
  const colors = { low: '#22c55e', medium: '#f59e0b', high: '#ef4444' }
  const labels = { low: 'OK', medium: '!', high: '!!' }

  const opts = { color: colors[level] || '#64748b', text: labels[level] || '?' }
  if (tabId) {
    chrome.action.setBadgeBackgroundColor({ color: opts.color, tabId })
    chrome.action.setBadgeText({ text: opts.text, tabId })
  } else {
    chrome.action.setBadgeBackgroundColor({ color: opts.color })
    chrome.action.setBadgeText({ text: opts.text })
  }
}
