// Groq API client for AI-based job scam analysis.
// Only called when heuristics return a MEDIUM risk score (borderline cases).

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.1-70b-versatile'

const SYSTEM_PROMPT = `You are a job scam detection specialist. Analyse job postings and return a JSON risk assessment.

Return ONLY valid JSON with this exact structure:
{
  "risk_level": "low" | "medium" | "high",
  "confidence": <number 0-100>,
  "flags": [<string>, ...],
  "summary": "<1-2 sentence plain English explanation>"
}

Risk criteria:
- HIGH: Requests money/fees, fake company signals, phishing patterns, impossible compensation
- MEDIUM: Vague details, generic description, pressure tactics, mismatched info
- LOW: Legitimate structure, specific role details, realistic compensation, credible company

Be concise. Focus on concrete signals, not speculation.`

/**
 * @param {Object} job - extracted job data
 * @param {string} groqApiKey
 * @returns {Promise<{ risk_level, confidence, flags, summary } | null>}
 */
async function analyseWithGroq(job, groqApiKey) {
  if (!groqApiKey) return null

  const jobText = [
    `Title: ${job.title || 'Unknown'}`,
    `Company: ${job.company || 'Unknown'}`,
    `Location: ${job.location || 'Not listed'}`,
    `Salary: ${job.salary || 'Not listed'}`,
    `Recruiter email: ${job.recruiterEmail || 'Not shown'}`,
    `Company website: ${job.companyWebsite || 'Not linked'}`,
    `Description (first 800 chars):\n${(job.description || '').slice(0, 800)}`
  ].join('\n')

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Analyse this job posting:\n\n${jobText}` }
        ],
        temperature: 0.1,
        max_tokens: 300
      })
    })

    if (!response.ok) return null

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''

    // strip any markdown code fences the model might add
    const cleaned = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
    return null
  }
}
