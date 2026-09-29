// Tipi del contenuto "data-driven" della guida (messages/<locale>.json,
// namespace `guide`) e funzioni pure condivise da page.tsx (JSON-LD) e
// GuideClient.tsx (renderer e ricerca). Nessun import da next/headers.
//
// Markup inline ammesso nei testi: `**grassetto**` e `[testo](href)`; gli
// href che iniziano con "/" diventano Link consapevoli della lingua.

export type ColorName =
  | 'teal'
  | 'amber'
  | 'indigo'
  | 'red'
  | 'blue'
  | 'orange'
  | 'purple'
  | 'green'
  | 'yellow'

export type SensorStatus = 'ok' | 'limit' | 'no'

export type GuideBlock =
  | { type: 'p'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'steps'; items: string[] }
  | { type: 'checklist'; items: string[] }
  | { type: 'callout'; variant?: 'info' | 'warn'; title?: string; text: string }
  | { type: 'troubleshoot'; title: string; items: string[] }
  | {
      type: 'sensorTable'
      headers: { sensor: string; status: string; notes: string }
      rows: { status: SensorStatus; name: string; note: string }[]
    }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | {
      type: 'scoreCards'
      items: { emoji: string; title: string; desc: string; color: ColorName; ranges?: { range: string; label: string }[] }[]
    }
  | { type: 'zoneCards'; items: { emoji: string; title: string; desc: string; color: ColorName }[] }
  | { type: 'card'; color: ColorName; title: string; blocks: GuideBlock[] }
  | { type: 'dl'; items: { term: string; desc: string }[] }
  | { type: 'faq'; items: GuideFaqItem[] }
  | { type: 'mainFaq' }
  | { type: 'contacts'; items: { icon: 'email' | 'telegram' | 'site'; href: string; title: string; text: string; external?: boolean }[] }

export type GuideFaqItem = { q: string; a: GuideBlock[] }

export type GuideSection = {
  /** Anchor, invariato in tutte le lingue. */
  id: string
  emoji: string
  title: string
  blocks: GuideBlock[]
}

/** Testo semplice di una stringa con markup inline (senza `**` e senza href). */
export function inlineToText(s: string): string {
  return s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
}

/** Tutte le stringhe visibili di una lista di blocchi, in ordine, come testo semplice. */
export function blocksToText(blocks: GuideBlock[]): string {
  const out: string[] = []
  const push = (s: string | undefined) => {
    if (s) out.push(inlineToText(s))
  }
  const walk = (list: GuideBlock[]) => {
    for (const b of list) {
      switch (b.type) {
        case 'p':
        case 'h3':
          push(b.text)
          break
        case 'ul':
        case 'steps':
        case 'checklist':
          b.items.forEach(push)
          break
        case 'callout':
          push(b.title)
          push(b.text)
          break
        case 'troubleshoot':
          push(b.title)
          b.items.forEach(push)
          break
        case 'sensorTable':
          for (const r of b.rows) {
            push(r.name)
            push(r.note)
          }
          break
        case 'table':
          b.headers.forEach(push)
          for (const r of b.rows) r.forEach(push)
          break
        case 'scoreCards':
          for (const c of b.items) {
            push(c.title)
            push(c.desc)
            c.ranges?.forEach((r) => {
              push(r.range)
              push(r.label)
            })
          }
          break
        case 'zoneCards':
          for (const c of b.items) {
            push(c.title)
            push(c.desc)
          }
          break
        case 'card':
          push(b.title)
          walk(b.blocks)
          break
        case 'dl':
          for (const d of b.items) {
            push(d.term)
            push(d.desc)
          }
          break
        case 'faq':
          for (const f of b.items) {
            push(f.q)
            walk(f.a)
          }
          break
        case 'contacts':
          for (const c of b.items) {
            push(c.title)
            push(c.text)
          }
          break
        case 'mainFaq':
          break
      }
    }
  }
  walk(blocks)
  return out.join(' ')
}

/** Testo di ricerca di una FAQ (domanda + risposta). */
export function faqToText(item: GuideFaqItem): string {
  return `${item.q} ${blocksToText(item.a)}`
}
