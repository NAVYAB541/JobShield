# JobShield

A Chrome extension that analyses job postings on LinkedIn, Indeed, and Seek in real time and flags scam indicators before you apply.

## What it does

JobShield runs a local heuristics engine on every job page you visit. It produces a risk score, a list of specific red flags, and a list of positive signals. If you have a Groq API key, it also runs an AI analysis as a second opinion.

Results appear as a floating badge on the page and in the extension popup. No data leaves your browser except for optional Groq API calls.

## Supported platforms

- LinkedIn (`/jobs/view/`)
- Indeed (`/viewjob`)
- Seek (`/job/`)

## How the scoring works

### Signal detection

The engine checks for:

- Free email domains used by the recruiter (Gmail, Hotmail, etc.)
- Recruiter email domain not matching the company name
- Scam keywords in the job title (data entry, typing job, earn from home, etc.)
- Salary promise in the title (`$500/day`, `earn $50/hr`)
- Urgency language (`urgent`, `immediate start`, `limited spots`, etc.)
- Money requests (training fees, registration fees, equipment purchase)
- "Too good to be true" phrases (unlimited earning, be your own boss, etc.)
- Commission-only compensation
- Vague or missing salary
- Very short job description (under 80 words)
- Remote entry-level role with no listed location
- Generic or confidential company name
- Job poster whose profile indicates they are job-seeking, not recruiting
- Links to suspicious domains (unusual TLDs) or URL shorteners in the description
- Unrealistic salary for the stated experience level

### Context-aware multipliers

Each flag has a base weight. Before scoring, every flag is multiplied by a role-type factor derived from the job title. This suppresses false positives in industries where certain language is normal.

Examples:
- "Immediate start" is expected in hospitality, so `urgency_low` is nearly suppressed for those roles. The same phrase in a software engineering role is amplified.
- A Gmail recruiter email is less suspicious for a small cafe than for a tech company recruiting engineers.
- Commission-only pay is normal for sales and gig roles but unusual for tech or corporate roles.

Role types detected: `tech`, `hospitality`, `retail`, `trades`, `healthcare`, `corporate`, `gig`, `graduate`, `general`.

### Compound rules

Some combinations of weak signals together are much stronger than their additive score. The engine applies compound bonuses when specific co-occurring flag patterns are detected:

- Unnamed company + free email + urgency (classic scam fingerprint)
- Free email + remote entry-level + very short description (ghost job pattern)
- "Too good to be true" language + free email
- Suspicious link + free email (phishing risk)
- Fee request + free email
- Scam-pattern title + urgency pressure

### Scoring thresholds

| Score | Level |
|---|---|
| 25 or above | HIGH RISK |
| 12 to 24 | MEDIUM RISK |
| Below 12 | LOW RISK |

### Green flags

The engine also records positive signals: named company, listed salary, professional email, detailed description, clear requirements, benefits listed, and recognised role titles.

### AI analysis (optional)

If you add a Groq API key in settings, the extension sends a summary of the job to Groq's Llama 3.1 70B model for a second-opinion analysis. The AI contributes flags and a summary but never overrides the heuristic verdict. If the AI strongly disagrees with a low heuristic score, a warning is shown.

## Installation

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable Developer Mode (toggle in the top right)
4. Click "Load unpacked" and select the project folder
5. Navigate to any job listing on LinkedIn, Indeed, or Seek

## Optional: Groq API key

A Groq API key enables AI analysis. Groq's free tier is sufficient for regular use.

1. Create an account at [console.groq.com](https://console.groq.com)
2. Generate an API key
3. Click the settings icon in the JobShield popup and paste the key

The key is stored locally in `chrome.storage.local` and is only sent to Groq's API.

## Project structure

```
background/
  background.js       heuristics engine, Groq client, message handler

content/
  extractors/
    linkedin.js       job data extraction for LinkedIn
    indeed.js         job data extraction for Indeed
    seek.js           job data extraction for Seek
  overlay.js          floating badge injected into job pages

popup/
  popup.html          extension popup UI
  popup.css           popup styles
  popup.js            popup logic and state rendering

icons/                extension icons
manifest.json         Chrome extension manifest (MV3)
```

## Data extraction

LinkedIn extraction uses a four-method fallback chain:

1. JSON-LD structured data (most complete)
2. DOM scraping of known selectors
3. Title-only fallback (limited confidence, flagged in UI)

The extraction method used is shown in the popup so you can assess how much data the engine had access to.

## Permissions used

| Permission | Reason |
|---|---|
| `activeTab` | Read the current tab's URL to detect job pages |
| `storage` | Store the last result and optional API key locally |
| `scripting` | Inject content scripts on demand without page reload |
| Host permissions | Scope content scripts to LinkedIn, Indeed, and Seek only |

## Limitations

- Role classification is regex-based and title-dependent. Unusual job titles may fall through to the `general` category.
- Thresholds are hand-tuned and have not been calibrated against a labelled dataset.
- A LOW RISK result means few scam indicators were detected, not that the job is verified legitimate.
- Extraction quality varies. A `title-only` extraction produces a lower-confidence score.
