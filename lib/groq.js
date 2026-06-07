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
