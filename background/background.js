// ─── Heuristics engine (inlined to avoid importScripts path issues) ───────────

// ── Title keyword lists ──────────────────────────────────────────────────────

const SCAM_TITLE_KEYWORDS = [
  // Vague / generic
  'data entry', 'typing job', 'copy paste', 'form filling', 'online work',
  'home based work', 'home based job', 'work at home', 'earn from home',
  'earn money online', 'make money online', 'online earning', 'income opportunity',
  // MLM / commission only
  'brand ambassador', 'brand promoter', 'sales promoter', 'network marketer',
  'affiliate marketer', 'mlm', 'multi level', 'direct sales', 'commission only',
  // Unrealistic earnings
  'earn up to', 'make up to', 'up to $', '$/hour easy', 'easy cash',
  'financial freedom', 'be your own boss', 'set your own hours',
  // Mystery / vague roles
  'mystery shopper', 'product tester', 'social media evaluator',
  'online panelist', 'survey taker', 'paid survey',
  // Instant / no-skill
  'no experience needed', 'no skills required', 'anyone can apply',
  'immediate joining', 'same day joining', 'urgently hiring',
]

const LEGIT_TITLE_KEYWORDS = [
  // Engineering roles
  'software engineer', 'software developer', 'frontend engineer', 'backend engineer',
  'full stack', 'fullstack', 'web developer', 'mobile developer', 'ios developer',
  'android developer', 'flutter developer', 'react developer', 'node developer',
  'python developer', 'java developer', '.net developer', 'rails developer',
  // Specialisms
  'devops engineer', 'platform engineer', 'site reliability', 'cloud engineer',
  'data engineer', 'data scientist', 'machine learning', 'ml engineer', 'ai engineer',
  'security engineer', 'cybersecurity', 'network engineer', 'systems engineer',
  'qa engineer', 'test engineer', 'automation engineer',
  // Levels (signal it's a structured org)
  'graduate engineer', 'graduate developer', 'junior developer', 'junior engineer',
  'associate engineer', 'senior engineer', 'senior developer', 'lead engineer',
  'principal engineer', 'staff engineer', 'engineering manager',
  // Other legit tech
  'product manager', 'product designer', 'ux designer', 'ui designer',
  'solutions architect', 'technical lead', 'tech lead', 'scrum master',
  'business analyst', 'data analyst', 'database administrator',
]

const FREE_EMAIL_DOMAINS = [
  'gmail.com','yahoo.com','hotmail.com','outlook.com','aol.com',
  'protonmail.com','icloud.com','mail.com','ymail.com','live.com','msn.com'
]
const URGENCY_PHRASES = [
  'urgent','immediate hire','immediate start','start today','start immediately',
  'asap','apply now before','limited spots','only a few positions',
  'must start this week','quick hire','same day offer','instant offer','instant hire'
]
const MONEY_REQUEST_PHRASES = [
  'training fee','registration fee','background check fee','purchase equipment',
  'buy your own equipment','starter kit','pay for training','refundable deposit',
  'processing fee','admin fee','security deposit'
]
const TOO_GOOD_PHRASES = [
  // "work from home" removed — remote work is now a normal, legitimate arrangement
  'set your own hours','be your own boss','no experience needed',
  'no experience required','no qualifications','earn from home','unlimited earning',
  'financial freedom','passive income','work 2 hours a day'
]
const VAGUE_SALARY_PHRASES = [
  // Only truly evasive phrasing — "competitive salary" and "negotiable" are standard
  'tbd','to be discussed','attractive package'
]

function normalise(t) {
  return (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}
function countMatches(text, phrases) { return phrases.filter(p => text.includes(p)).length }

function analyseJob(job) {
  const desc     = normalise(job.description)
  const title    = normalise(job.title)
  const salary   = normalise(job.salary || '')
  const email    = normalise(job.recruiterEmail || '')
  const fullText = [desc, title, salary].join(' ')
  const flags    = []

  // ── Title keyword analysis ──
  const scamTitleMatch = SCAM_TITLE_KEYWORDS.find(k => title.includes(k))
  if (scamTitleMatch)
    flags.push({ id:'scam_title', label:`Title contains scam keyword: "${scamTitleMatch}"`, weight:18 })

  // Salary-in-title pattern like "$500/day" or "earn $50/hr"
  if (/\$\d+\s*(\/|\bper\b)\s*(hr|hour|day|week)/.test(title))
    flags.push({ id:'salary_in_title', label:'Salary promise in job title (common scam pattern)', weight:12 })

  const emails = (fullText + ' ' + email).match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []
  const freeEmails = emails.filter(e => FREE_EMAIL_DOMAINS.some(d => e.endsWith('@' + d)))
  if (freeEmails.length > 0)
    flags.push({ id:'free_email', label:`Recruiter uses free email (${freeEmails[0]})`, weight:15 })

  if (job.recruiterEmail && job.company) {
    const domain     = (job.recruiterEmail.split('@')[1] || '').toLowerCase()
    const domainBase = domain.split('.')[0].replace(/[^a-z0-9]/g,'')
    const slug       = job.company.toLowerCase().replace(/[^a-z0-9]/g,'')
    if (domain && !FREE_EMAIL_DOMAINS.includes(domain) && !domainBase.includes(slug.slice(0,5)) && !slug.includes(domainBase))
      flags.push({ id:'email_mismatch', label:"Recruiter email domain doesn't match company name", weight:8 })
  }

  const urgencyCount = countMatches(fullText, URGENCY_PHRASES)
  if (urgencyCount >= 2) flags.push({ id:'urgency_high', label:'Multiple urgency phrases detected', weight:12 })
  else if (urgencyCount === 1) flags.push({ id:'urgency_low', label:'Urgency language detected', weight:5 })

  if (countMatches(fullText, MONEY_REQUEST_PHRASES) > 0)
    flags.push({ id:'money_request', label:'Mentions fees, deposits, or equipment purchase', weight:20 })

  const tgtCount = countMatches(fullText, TOO_GOOD_PHRASES)
  if (tgtCount >= 2) flags.push({ id:'tgtb_high', label:'Multiple "too good to be true" phrases', weight:12 })
  else if (tgtCount === 1) flags.push({ id:'tgtb_low', label:'"Too good to be true" language detected', weight:4 })

  if (countMatches(salary, VAGUE_SALARY_PHRASES) > 0 || !salary.trim() || salary === 'not specified')
    flags.push({ id:'vague_salary', label:'Salary is vague or not listed', weight:1 })

  const wordCount = (job.description || '').trim().split(/\s+/).filter(Boolean).length
  if (wordCount < 80)
    flags.push({ id:'short_desc', label:`Job description is very short (${wordCount} words)`, weight:8 })

  const isEntryLevel = /\b(graduate|entry.?level|junior|no experience)\b/.test(fullText)
  const isRemote     = /\b(remote|work from home|wfh|fully remote)\b/.test(fullText)
  if (isEntryLevel && isRemote && !job.location)
    flags.push({ id:'remote_entry', label:'Remote entry-level with no listed location', weight:5 })

  // Exact-match single words to avoid flagging "Smith & Company" etc.
  const companyNorm = normalise(job.company || '')
  const isGenericCompany =
    /^(confidential|undisclosed|anonymous)$/.test(companyNorm) ||
    /(own company|private company|hiring confidentially)/.test(companyNorm)
  if (isGenericCompany)
    flags.push({ id:'generic_company', label:'Company name is generic or confidential', weight:6 })

  // ── Job poster appears to be a job-seeker, not a recruiter ──
  const JOB_SEEKER_PHRASES = [
    'open to work', 'open to opportunities', 'actively looking', 'looking for my first',
    'seeking a new role', 'seeking new opportunities', 'seeking employment',
    'first experience', 'premiere experience', 'a la recherche', 'en recherche d',
    'recherche emploi', 'looking for work', 'currently seeking', 'job search'
  ]
  if (job.recruiterTitle) {
    const rt = normalise(job.recruiterTitle)
    if (JOB_SEEKER_PHRASES.some(p => rt.includes(p)))
      flags.push({ id:'poster_job_seeker', label:'Job poster appears to be a job-seeker, not a recruiter', weight:15 })
  }

  const score = flags.reduce((s, f) => s + f.weight, 0)

  // ── Green flags (positive signals) ──
  const greenFlags = []

  const legitTitle = LEGIT_TITLE_KEYWORDS.find(k => title.includes(k))
  if (legitTitle && !scamTitleMatch)
    greenFlags.push(`Recognised role title: "${job.title}"`)

  if (/\$[\d,]+|\d+\s*k\b|\d{2,3},\d{3}/.test(job.salary || ''))
    greenFlags.push(`Salary specified: ${job.salary}`)

  if (wordCount >= 300)
    greenFlags.push(`Detailed description (${wordCount} words)`)

  if (job.company && !isGenericCompany)
    greenFlags.push(`Named company: ${job.company}`)

  if (job.location && job.location.trim())
    greenFlags.push(`Location: ${job.location}`)

  if (job.recruiterEmail && !FREE_EMAIL_DOMAINS.some(d => job.recruiterEmail.toLowerCase().endsWith('@' + d)))
    greenFlags.push(`Professional email: ${job.recruiterEmail}`)

  if (/\b(interview|screening|assessment|technical test|coding challenge|take.home)\b/.test(desc))
    greenFlags.push('Interview process described')

  if (/\b(benefits?|annual leave|paid time off|\bpto\b|superannuation|health insurance|flexible|equity|stock options)\b/.test(desc))
    greenFlags.push('Benefits and perks listed')

  if (/\b(years?.{1,10}experience|bachelor|degree|required skills|must have|essential)\b/.test(desc))
    greenFlags.push('Clear requirements specified')

  return { score, level: score >= 25 ? 'high' : score >= 12 ? 'medium' : 'low', flags, greenFlags }
}

// ─── Groq AI client (inlined) ─────────────────────────────────────────────────

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL   = 'llama-3.1-70b-versatile'
const GROQ_SYSTEM  = `You are a job scam detection specialist. Return ONLY valid JSON:
{"risk_level":"low"|"medium"|"high","confidence":0-100,"flags":["string"],"summary":"1-2 sentences"}`

async function analyseWithGroq(job, apiKey) {
  if (!apiKey) return null
  const text = [
    `Title: ${job.title || 'Unknown'}`,
    `Company: ${job.company || 'Unknown'}`,
    `Location: ${job.location || 'Not listed'}`,
    `Salary: ${job.salary || 'Not listed'}`,
    `Recruiter email: ${job.recruiterEmail || 'Not shown'}`,
    `Description:\n${(job.description || '').slice(0, 800)}`
  ].join('\n')

  try {
    const res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role:'system', content:GROQ_SYSTEM }, { role:'user', content:`Analyse:\n${text}` }],
        temperature: 0.1, max_tokens: 300
      })
    })
    if (!res.ok) return null
    const data    = await res.json()
    const content = (data.choices?.[0]?.message?.content || '').replace(/```json?\n?/g,'').replace(/```/g,'').trim()
    return JSON.parse(content)
  } catch { return null }
}

// ─── Message handler ──────────────────────────────────────────────────────────

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
    aiResult: null,
    job: { title: job.title, company: job.company, platform: job.platform }
  }

  // AI runs on every job when a key is set — but is advisory only.
  // It never overrides the heuristic level; it contributes flags + summary.
  // This catches sophisticated scams that score LOW on heuristics.
  const { groqApiKey } = await chrome.storage.local.get('groqApiKey')
  if (groqApiKey) {
    const ai = await analyseWithGroq(job, groqApiKey)
    if (ai) {
      result.aiResult = ai
      // If AI strongly disagrees with a low heuristic score, record the discrepancy
      // so the UI can surface it — but heuristic level is never overridden.
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
  const colors = { low:'#22c55e', medium:'#f59e0b', high:'#ef4444' }
  const labels = { low:'OK', medium:'!', high:'!!' }
  const opts = { color: colors[level] || '#64748b', text: labels[level] || '?' }
  const target = tabId ? { tabId } : {}
  chrome.action.setBadgeBackgroundColor({ color: opts.color, ...target })
  chrome.action.setBadgeText({ text: opts.text, ...target })
}
