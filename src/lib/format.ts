export const fmt = new Intl.NumberFormat('pt-BR')

export function minutesAgo(iso: string, now = Date.now()): number {
  return Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000))
}

export function ago(iso: string, now = Date.now()): string {
  const m = minutesAgo(iso, now)
  if (m < 60) return `${String(m).padStart(2, '0')} min`
  const h = Math.floor(m / 60)
  return `${h} h ${String(m % 60).padStart(2, '0')} min`
}

export function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function toCsv(rows: Record<string, string | number>[]): string {
  if (!rows.length) return ''
  const cols = Object.keys(rows[0])
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  return [cols.join(';'), ...rows.map((r) => cols.map((c) => esc(r[c])).join(';'))].join('\n')
}
