/** "DFA α1" per intestazioni e KPI con `uppercase`: la sigla resta "DFA", il
 *  simbolo α1 non diventa "Α1". Non si traduce (sigla HRV): dove serve una
 *  frase intorno si usa `t.rich('…', { dfa: () => <Alpha1 /> })` con il tag
 *  `<dfa></dfa>` nel messaggio. */
export function Alpha1() {
  return (
    <>
      DFA <span className="normal-case">α1</span>
    </>
  )
}
