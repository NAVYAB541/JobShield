// Injects a floating risk badge directly on the job page.
// Listens for jobshield:result events dispatched by the platform extractors.

(function () {
  const BADGE_ID = 'jobshield-badge'

  const LEVEL_CONFIG = {
    low:    { emoji: '🟢', label: 'Low Risk',    bg: '#0f4c25', border: '#22c55e', text: '#86efac' },
    medium: { emoji: '🟡', label: 'Medium Risk', bg: '#422006', border: '#f59e0b', text: '#fcd34d' },
    high:   { emoji: '🔴', label: 'High Risk',   bg: '#450a0a', border: '#ef4444', text: '#fca5a5' }
  }

  function removeBadge() {
    document.getElementById(BADGE_ID)?.remove()
  }

  function createBadge(result) {
    removeBadge()

    const { level, score, flags, aiResult } = result
    const cfg = LEVEL_CONFIG[level] || LEVEL_CONFIG.medium

    const badge = document.createElement('div')
    badge.id = BADGE_ID
    badge.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483647;
      background: ${cfg.bg};
      border: 1.5px solid ${cfg.border};
      border-radius: 12px;
      padding: 12px 16px;
      min-width: 220px;
      max-width: 300px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
      color: ${cfg.text};
      box-shadow: 0 4px 24px rgba(0,0,0,0.5);
      cursor: pointer;
      transition: opacity 0.2s;
      user-select: none;
    `

    const summary = aiResult?.summary || ''
    const allFlags = [
      ...(flags || []).map(f => f.label),
      ...(aiResult?.flags || [])
    ].filter(Boolean).slice(0, 4)

    badge.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <span style="font-weight:700;font-size:14px">${cfg.emoji} JobShield: ${cfg.label}</span>
        <span id="jobshield-close" style="cursor:pointer;opacity:0.6;font-size:16px;line-height:1;padding:0 2px">×</span>
      </div>
      <div style="opacity:0.75;margin-bottom:8px;font-size:12px">Risk score: ${score} / 100</div>
      ${summary ? `<div style="margin-bottom:8px;line-height:1.4;font-size:12px;opacity:0.9">${summary}</div>` : ''}
      ${allFlags.length ? `
        <ul style="margin:0;padding:0 0 0 14px;font-size:11px;opacity:0.8;line-height:1.6">
          ${allFlags.map(f => `<li>${f}</li>`).join('')}
        </ul>
      ` : ''}
      <div style="margin-top:10px;font-size:10px;opacity:0.5;text-align:right">Click extension icon for full report</div>
    `

    badge.querySelector('#jobshield-close').addEventListener('click', (e) => {
      e.stopPropagation()
      removeBadge()
    })

    document.body.appendChild(badge)
  }

  // Show a loading spinner while analysis runs
  function createLoadingBadge() {
    removeBadge()
    const badge = document.createElement('div')
    badge.id = BADGE_ID
    badge.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483647;
      background: #1a1a2e;
      border: 1.5px solid #334155;
      border-radius: 12px;
      padding: 12px 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
      color: #94a3b8;
      box-shadow: 0 4px 24px rgba(0,0,0,0.5);
    `
    badge.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px">
        <div style="width:14px;height:14px;border:2px solid #475569;border-top-color:#94a3b8;border-radius:50%;animation:jobshield-spin 0.7s linear infinite"></div>
        <span>JobShield analysing…</span>
      </div>
    `

    // inject keyframe animation once
    if (!document.getElementById('jobshield-styles')) {
      const style = document.createElement('style')
      style.id = 'jobshield-styles'
      style.textContent = '@keyframes jobshield-spin { to { transform: rotate(360deg) } }'
      document.head.appendChild(style)
    }

    document.body.appendChild(badge)
  }

  window.addEventListener('jobshield:loading', createLoadingBadge)
  window.addEventListener('jobshield:result', (e) => createBadge(e.detail))
  window.addEventListener('jobshield:clear', removeBadge)
})()
