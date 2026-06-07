const RISK_THRESHOLDS = { HIGH: 25, MEDIUM: 12 }

const RISK_LEVELS = {
  low: {
    label: 'LOW RISK',
    sublabel: 'No Major Red Flags',
    emoji: '🟢',
    color: '#00ff9d',
    bg: 'rgba(0,20,10,0.92)',
    border: 'rgba(0,255,157,0.3)',
    badge: { text: 'OK', bg: '#22c55e' }
  },
  medium: {
    label: 'MEDIUM RISK',
    sublabel: 'Needs Review',
    emoji: '🟡',
    color: '#ffb800',
    bg: 'rgba(20,14,0,0.92)',
    border: 'rgba(255,184,0,0.3)',
    badge: { text: '!', bg: '#f59e0b' }
  },
  high: {
    label: 'HIGH RISK',
    sublabel: 'Potential Scam',
    emoji: '🔴',
    color: '#ff3b3b',
    bg: 'rgba(20,4,4,0.95)',
    border: 'rgba(255,59,59,0.35)',
    badge: { text: '!!', bg: '#ef4444' }
  }
}

function scoreToLevel(score) {
  if (score >= RISK_THRESHOLDS.HIGH) return 'high'
  if (score >= RISK_THRESHOLDS.MEDIUM) return 'medium'
  return 'low'
}
