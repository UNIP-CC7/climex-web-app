/** Raio da área de um alerta: de 500 m a 50 km (RF-COM). */
export const RADIUS_MIN_KM = 0.5
export const RADIUS_MAX_KM = 50

const clamp01 = (t: number) => Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0))

/** Posição do controle (0 a 1) para um raio em km. Escala logarítmica: 500 m a 5 km ocupam metade do controle. */
export function kmToSlider(km: number): number {
  const k = Math.min(RADIUS_MAX_KM, Math.max(RADIUS_MIN_KM, Number.isFinite(km) ? km : RADIUS_MIN_KM))
  return Math.log(k / RADIUS_MIN_KM) / Math.log(RADIUS_MAX_KM / RADIUS_MIN_KM)
}

/** Raio em km para a posição do controle, arredondado para um valor fácil de ler (100 m até 5 km, 1 km acima). */
export function sliderToKm(t: number): number {
  const km = RADIUS_MIN_KM * Math.pow(RADIUS_MAX_KM / RADIUS_MIN_KM, clamp01(t))
  const rounded = km < 5 ? Math.round(km * 10) / 10 : Math.round(km)
  return Math.min(RADIUS_MAX_KM, Math.max(RADIUS_MIN_KM, rounded))
}

/** "500 m", "1,2 km", "50 km". */
export function formatRadius(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(Number.isInteger(km) ? 0 : 1).replace('.', ',')} km`
}

/** O raio como se digita no campo: "0,5", "1,2", "12". */
export function formatRadiusInput(km: number): string {
  return String(Math.round(km * 10) / 10).replace('.', ',')
}

/** Aceita o que a pessoa digita em km (vírgula ou ponto), arredonda a 100 m e limita aos extremos; null se não for número. */
export function parseRadiusKm(text: string): number | null {
  const n = Number(text.trim().replace(',', '.'))
  if (!text.trim() || !Number.isFinite(n)) return null
  // 100 m de precisão: o que o campo mostra é exatamente o que vai no alerta
  return Math.min(RADIUS_MAX_KM, Math.max(RADIUS_MIN_KM, Math.round(n * 10) / 10))
}
