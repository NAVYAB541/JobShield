importScripts(
  '../lib/text-utils.js',
  '../lib/risk-levels.js',
  '../lib/heuristics.js',
  '../lib/groq.js'
)

const resultCache = new Map()

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.type === 'ANALYSE_JOB') {
    handleAnalysis(msg.job, sender).then(reply).catch(() => reply(null))
    return true
  }
  if (msg.type === 'GET_LAST_RESULT') {
    chrome.storage.local.get('lastResult', ({ lastResult }) => reply(lastResult || null))
    return true
  }
  if (msg.type === 'SAVE_API_KEY') {
    chrome.storage.local.set({ groqApiKey: msg.key }, () => reply({ ok: true }))
    return true
  }
  if (msg.type === 'GET_API_KEY') {
    chrome.storage.local.get('groqApiKey', ({ groqApiKey }) => reply(groqApiKey || ''))
    return true
  }
})

async function handleAnalysis(job, sender) {
  const cacheKey = job.jobId || job.jobKey || (job.title + job.company)
  if (resultCache.has(cacheKey)) return resultCache.get(cacheKey)

  const heuristic = analyseJob(job)
  const result = {
    level: heuristic.level,
    score: Math.min(heuristic.score, 100),
    flags: heuristic.flags,
    greenFlags: heuristic.greenFlags,
    context: heuristic.context,
    aiResult: null,
    extractionMethod: job.extractionMethod || 'dom',
    job: { title: job.title, company: job.company, platform: job.platform }
  }

  const { groqApiKey } = await chrome.storage.local.get('groqApiKey')
  if (groqApiKey) {
    const ai = await analyseWithGroq(job, groqApiKey)
    if (ai) {
      result.aiResult = ai
      if (heuristic.level === 'low' && ai.risk_level === 'high' && ai.confidence >= 80) {
        result.aiDisagreement = true
      }
    }
  }

  resultCache.set(cacheKey, result)
  if (resultCache.size > 50) resultCache.delete(resultCache.keys().next().value)

  await chrome.storage.local.set({ lastResult: result })
  setBadge(result.level, sender.tab?.id)
  return result
}

function setBadge(level, tabId) {
  const cfg = RISK_LEVELS[level] || RISK_LEVELS.medium
  const target = tabId ? { tabId } : {}
  chrome.action.setBadgeBackgroundColor({ color: cfg.badge.bg, ...target })
  chrome.action.setBadgeText({ text: cfg.badge.text, ...target })
}
