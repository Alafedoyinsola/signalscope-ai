export function formatCurrency(
  val: number | null | undefined,
  maximumFractionDigits = 2
): string {
  if (val === null || val === undefined || isNaN(val)) return '—'
  if (Math.abs(val) >= 1e12) {
    return `$${(val / 1e12).toFixed(2)}T`
  }
  if (Math.abs(val) >= 1e9) {
    return `$${(val / 1e9).toFixed(2)}B`
  }
  if (Math.abs(val) >= 1e6) {
    return `$${(val / 1e6).toFixed(2)}M`
  }
  if (Math.abs(val) >= 1e3) {
    return `$${(val / 1e3).toFixed(2)}K`
  }
  if (Math.abs(val) < 0.01 && Math.abs(val) > 0) {
    return `$${val.toFixed(6)}`
  }
  return `$${val.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits,
  })}`
}

export function formatPercent(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '—'
  const sign = val > 0 ? '+' : ''
  return `${sign}${val.toFixed(2)}%`
}

export function formatNumber(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '—'
  if (Math.abs(val) >= 1e9) {
    return `${(val / 1e9).toFixed(2)}B`
  }
  if (Math.abs(val) >= 1e6) {
    return `${(val / 1e6).toFixed(2)}M`
  }
  return val.toLocaleString('en-US')
}

export function formatTimestamp(isoString: string | null | undefined): string {
  if (!isoString) return '—'
  try {
    const d = new Date(isoString)
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  } catch {
    return isoString
  }
}
