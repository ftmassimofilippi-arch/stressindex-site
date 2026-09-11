// I PDF del sito usano Helvetica (font standard, codifica WinAnsi) come gli
// altri report: alcuni glifi dei testi dell'app (α, ₂, ≥, →, −) non esistono
// in quella codifica e uscirebbero come riquadri. Qui la sostituzione
// tipografica, senza cambiare il senso del testo.
const MAP: Array<[RegExp, string]> = [
  [/α/g, 'alfa '],
  [/ω/g, 'omega'],
  [/π/g, 'pi'],
  [/₂/g, '2'],
  [/≥/g, '>='],
  [/≤/g, '<='],
  [/→/g, '->'],
  [/←/g, '<-'],
  [/−/g, '-'],
  [/√/g, 'sqrt'],
  [/·/g, '·'],
]

export function pdfText(s: string | null | undefined): string {
  if (!s) return ''
  let out = s
  for (const [re, rep] of MAP) out = out.replace(re, rep)
  // "alfa 1" → "alfa1"
  return out.replace(/alfa (\d)/g, 'alfa$1')
}
