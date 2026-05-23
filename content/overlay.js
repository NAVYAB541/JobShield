(function () {
  const ID = 'jobshield-badge'

  const CFG = {
    low:    { label: 'LOW RISK',    color: '#00ff9d', bg: 'rgba(0,20,10,0.92)',  border: 'rgba(0,255,157,0.3)' },
    medium: { label: 'MEDIUM RISK', color: '#ffb800', bg: 'rgba(20,14,0,0.92)', border: 'rgba(255,184,0,0.3)' },
    high:   { label: 'HIGH RISK',   color: '#ff3b3b', bg: 'rgba(20,4,4,0.95)',  border: 'rgba(255,59,59,0.35)' }
  }

  const EMOJI = { low: '🟢', medium: '🟡', high: '🔴' }

  function injectStyles() {
    if (document.getElementById('jobshield-styles')) return
    const s = document.createElement('style')
    s.id = 'jobshield-styles'
    s.textContent = `
      @keyframes js-spin  { to { transform: rotate(360deg) } }
      @keyframes js-in    { from { opacity:0; transform: translateY(10px) } to { opacity:1; transform: translateY(0) } }
      @keyframes js-blink { 0%,100% { opacity:1 } 50% { opacity:.55 } }
      #jobshield-badge { animation: js-in .25s ease forwards; }
    `
    document.head.appendChild(s)
  }

  function remove() { document.getElementById(ID)?.remove() }

  function badge(result) {
    remove()
    injectStyles()

    const { level, score, flags, aiResult } = result
    const cfg = CFG[level] || CFG.medium

    const allFlags = [
      ...(flags || []).map(f => f.label),
      ...(aiResult?.flags || [])
    ].filter(Boolean).slice(0, 4)

    const summary = aiResult?.summary || ''
    const isHigh  = level === 'high'

    const el = document.createElement('div')
    el.id = ID
    el.style.cssText = `
      position: fixed; bottom: 22px; right: 22px;
      z-index: 2147483647;
      min-width: 230px; max-width: 290px;
      background: ${cfg.bg};
      border: 1px solid ${cfg.border};
      border-radius: 12px;
      padding: 12px 14px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 12px; color: #e0eaff;
      box-shadow: 0 0 28px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset;
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
    `

    const topGlow = document.createElement('div')
    topGlow.style.cssText = `
      position: absolute; top: 0; left: 0; right: 0; height: 1px;
      background: ${cfg.color};
      box-shadow: 0 0 10px 2px ${cfg.color};
      border-radius: 12px 12px 0 0; pointer-events: none;
    `
    el.appendChild(topGlow)

    const body = document.createElement('div')
    body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:18px">${EMOJI[level]}</span>
          <div>
            <div style="font-family:monospace;font-weight:700;font-size:12px;letter-spacing:.1em;color:${cfg.color};${isHigh ? 'animation:js-blink 1.4s ease-in-out infinite' : ''}">
              ${cfg.label}
            </div>
            <div style="font-family:monospace;font-size:10px;color:rgba(255,255,255,0.28);letter-spacing:.06em">
              SCORE ${score}/100
            </div>
          </div>
        </div>
        <span id="js-close" style="cursor:pointer;color:rgba(255,255,255,0.28);font-size:18px;line-height:1;padding:0 3px">×</span>
      </div>
      ${summary ? `<p style="font-size:11px;color:rgba(255,255,255,0.5);line-height:1.5;margin-bottom:8px">${summary}</p>` : ''}
      ${allFlags.length ? `
        <ul style="margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:4px">
          ${allFlags.map(f => `
            <li style="display:flex;align-items:flex-start;gap:6px;font-size:11px;color:rgba(255,255,255,0.42)">
              <span style="color:${cfg.color};font-weight:700;font-size:13px;line-height:1.1;flex-shrink:0">›</span>${f}
            </li>`).join('')}
        </ul>
      ` : ''}
      <div style="margin-top:9px;font-family:monospace;font-size:9px;color:rgba(255,255,255,0.16);letter-spacing:.06em">
        // click extension icon for full report
      </div>
    `
    el.appendChild(body)
    document.body.appendChild(el)
    el.querySelector('#js-close').addEventListener('click', remove)
  }

  function loadingBadge() {
    remove()
    injectStyles()
    const el = document.createElement('div')
    el.id = ID
    el.style.cssText = `
      position: fixed; bottom: 22px; right: 22px;
      z-index: 2147483647;
      background: rgba(5,8,15,0.93);
      border: 1px solid rgba(0,212,255,0.18);
      border-radius: 12px; padding: 12px 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      box-shadow: 0 0 20px rgba(0,0,0,0.5);
    `
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:9px">
        <div style="width:13px;height:13px;border:2px solid rgba(0,212,255,0.2);border-top-color:rgba(0,212,255,0.8);border-radius:50%;animation:js-spin .7s linear infinite;flex-shrink:0"></div>
        <span style="font-family:monospace;font-size:11px;letter-spacing:.08em;color:rgba(0,212,255,0.7)">JOBSHIELD SCANNING…</span>
      </div>
    `
    document.body.appendChild(el)
  }

  window.addEventListener('jobshield:loading', loadingBadge)
  window.addEventListener('jobshield:result', (e) => badge(e.detail))
  window.addEventListener('jobshield:clear', remove)
})()
