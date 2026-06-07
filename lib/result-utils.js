function mergeFlagLabels(result, { limit, dedupe = false } = {}) {
  const heuristicLabels = (result.flags || []).map(f => f.label)
  let aiFlags = result.aiResult?.flags || []
  if (dedupe) {
    aiFlags = aiFlags.filter(f => !(result.flags || []).some(h => h.label === f))
  }
  const merged = [...heuristicLabels, ...aiFlags].filter(Boolean)
  return limit != null ? merged.slice(0, limit) : merged
}
