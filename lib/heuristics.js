// Heuristics-based scam risk scoring engine.
// Each flag returns { id, label, weight, triggered }.
// Total score determines LOW / MEDIUM / HIGH risk.

const FREE_EMAIL_DOMAINS = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
  'aol.com', 'protonmail.com', 'icloud.com', 'mail.com',
  'ymail.com', 'live.com', 'msn.com', 'inbox.com'
]

const URGENCY_PHRASES = [
  'urgent', 'immediate hire', 'immediate start', 'start today',
  'start immediately', 'asap', 'apply now before', 'limited spots',
  'only a few positions', 'must start this week', 'quick hire',
  'same day offer', 'instant offer', 'instant hire'
]

const MONEY_REQUEST_PHRASES = [
  'training fee', 'registration fee', 'background check fee',
  'purchase equipment', 'buy your own equipment', 'starter kit',
  'pay for training', 'refundable deposit', 'processing fee',
  'admin fee', 'security deposit'
]

const TOO_GOOD_PHRASES = [
  'work from home', 'set your own hours', 'be your own boss',
  'no experience needed', 'no experience required', 'no qualifications',
  'earn from home', 'unlimited earning', 'financial freedom',
  'passive income', 'work 2 hours a day'
]

const VAGUE_SALARY_PHRASES = [
  'competitive salary', 'market rate', 'tbd', 'to be discussed',
  'negotiable', 'based on experience', 'attractive package'
]

function extractEmails(text) {
  const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)
  return matches || []
}

function normalise(text) {
  return (text || '').toLowerCase()
}

function countMatches(text, phrases) {
  return phrases.filter(p => text.includes(p)).length
}

/**
 * @param {Object} job
 * @param {string} job.title
 * @param {string} job.company
 * @param {string} job.description
 * @param {string} job.salary
 * @param {string} job.location
 * @param {string} job.recruiterEmail  - may be empty
 * @param {string} job.companyWebsite  - may be empty
 * @param {string} job.platform        - 'linkedin' | 'indeed' | 'seek'
 * @returns {{ score: number, level: 'low'|'medium'|'high', flags: Array }}
 */
function analyseJob(job) {
  const desc = normalise(job.description)
  const title = normalise(job.title)
  const salary = normalise(job.salary || '')
  const email = normalise(job.recruiterEmail || '')
  const fullText = [desc, title, salary].join(' ')

  const flags = []

  // --- Flag 1: Free email domain used as recruiter contact ---
  const emails = extractEmails(fullText + ' ' + email)
  const freeEmails = emails.filter(e => FREE_EMAIL_DOMAINS.some(d => e.endsWith('@' + d)))
  if (freeEmails.length > 0) {
    flags.push({
      id: 'free_email',
      label: `Recruiter uses free email (${freeEmails[0]})`,
      weight: 15,
      triggered: true
    })
  }

  // --- Flag 2: Email domain doesn't match company name ---
  if (job.recruiterEmail && job.company) {
    const emailDomain = job.recruiterEmail.split('@')[1] || ''
    const companySlug = job.company.toLowerCase().replace(/[^a-z0-9]/g, '')
    const domainBase = emailDomain.split('.')[0].replace(/[^a-z0-9]/g, '')
    if (emailDomain && !FREE_EMAIL_DOMAINS.includes(emailDomain) && !domainBase.includes(companySlug.slice(0, 5)) && !companySlug.includes(domainBase)) {
      flags.push({
        id: 'email_mismatch',
        label: 'Recruiter email domain doesn\'t match company name',
        weight: 8,
        triggered: true
      })
    }
  }

  // --- Flag 3: Urgency language ---
  const urgencyCount = countMatches(fullText, URGENCY_PHRASES)
  if (urgencyCount >= 2) {
    flags.push({ id: 'urgency_high', label: 'Multiple urgency phrases detected', weight: 12, triggered: true })
  } else if (urgencyCount === 1) {
    flags.push({ id: 'urgency_low', label: 'Urgency language detected', weight: 5, triggered: true })
  }

  // --- Flag 4: Requests money / fees ---
  if (countMatches(fullText, MONEY_REQUEST_PHRASES) > 0) {
    flags.push({ id: 'money_request', label: 'Mentions fees, deposits, or equipment purchase', weight: 20, triggered: true })
  }

  // --- Flag 5: "Too good to be true" language ---
  const tgtCount = countMatches(fullText, TOO_GOOD_PHRASES)
  if (tgtCount >= 2) {
    flags.push({ id: 'tgtb_high', label: 'Multiple "too good to be true" phrases', weight: 12, triggered: true })
  } else if (tgtCount === 1) {
    flags.push({ id: 'tgtb_low', label: '"Too good to be true" language detected', weight: 4, triggered: true })
  }

  // --- Flag 6: Vague salary ---
  if (countMatches(salary, VAGUE_SALARY_PHRASES) > 0 || salary.trim() === '' || salary === 'not specified') {
    flags.push({ id: 'vague_salary', label: 'Salary is vague or not listed', weight: 3, triggered: true })
  }

  // --- Flag 7: Very short job description ---
  const wordCount = (job.description || '').trim().split(/\s+/).length
  if (wordCount < 80) {
    flags.push({ id: 'short_description', label: `Job description is very short (${wordCount} words)`, weight: 8, triggered: true })
  }

  // --- Flag 8: No company website ---
  if (!job.companyWebsite || job.companyWebsite.trim() === '') {
    flags.push({ id: 'no_website', label: 'No company website linked', weight: 4, triggered: true })
  }

  // --- Flag 9: No location or fully remote + entry-level ---
  const isEntryLevel = /\b(graduate|entry.?level|junior|no experience)\b/.test(fullText)
  const isRemote = /\b(remote|work from home|wfh|fully remote)\b/.test(fullText)
  if (isEntryLevel && isRemote && !job.location) {
    flags.push({ id: 'remote_entry', label: 'Remote entry-level with no listed location', weight: 5, triggered: true })
  }

  // --- Flag 10: Generic/placeholder company name ---
  const genericNames = ['company', 'confidential', 'undisclosed', 'anonymous', 'private company']
  if (genericNames.some(n => normalise(job.company || '').includes(n))) {
    flags.push({ id: 'generic_company', label: 'Company name is generic or confidential', weight: 6, triggered: true })
  }

  const score = flags.reduce((sum, f) => sum + f.weight, 0)
  const level = score >= 25 ? 'high' : score >= 12 ? 'medium' : 'low'

  return { score, level, flags }
}

// expose for background.js (service worker) and content scripts
if (typeof module !== 'undefined') {
  module.exports = { analyseJob }
}
