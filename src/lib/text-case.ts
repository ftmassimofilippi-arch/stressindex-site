// Normalizzazioni di testo in sola visualizzazione. Modulo senza dipendenze,
// così `format.test.ts` lo importa direttamente (format.ts passa dagli alias
// `@/` che node --test non risolve). Il database non si tocca: i nomi restano
// come li ha scritti l'app o il professionista.

/** Prima lettera maiuscola, il resto com'è ("mercoledì 14 ottobre" → "Mercoledì 14 ottobre"). */
export function capitalizeFirst(s: string): string {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const SEPARATORS = /(['’-])/

function letterCount(word: string): number {
  return (word.match(/\p{L}/gu) ?? []).length
}

/** Vero per una parola scritta TUTTA in maiuscolo con più di due lettere
 *  ("NICOLÒ", "D'ANGELO"); falso per sigle corte ("DJ") e per le parole già
 *  miste ("McDonald", "de"). */
function isShouting(word: string): boolean {
  return letterCount(word) > 2 && word === word.toUpperCase() && word !== word.toLowerCase()
}

function titleCaseSegment(seg: string): string {
  return seg.charAt(0).toUpperCase() + seg.slice(1).toLowerCase()
}

/** Nome di persona per la UI: le parole tutte maiuscole passano in Title
 *  Case rispettando apostrofi e trattini ("NICOLÒ DONATINI" → "Nicolò
 *  Donatini", "D'ANGELO" → "D'Angelo", "MARIA-LUISA" → "Maria-Luisa"); tutto il
 *  resto resta intatto. */
export function displayName(name: string | null | undefined): string {
  if (!name) return ''
  return name
    .split(/(\s+)/)
    .map((word) => (isShouting(word) ? word.split(SEPARATORS).map((seg) => (SEPARATORS.test(seg) ? seg : titleCaseSegment(seg))).join('') : word))
    .join('')
}
