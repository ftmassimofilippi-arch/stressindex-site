import { Link } from '@/i18n/navigation'

type Props = {
  href: string
  children?: React.ReactNode
  /** Classi della cella (larghezza, allineamento del testo). */
  className?: string
  /** Padding del link, che sostituisce quello della cella. */
  padding?: string
  /** La cella "principale" è l'unico link annunciato dagli screen reader: le altre
   *  celle della stessa riga portano lo stesso href ma restano fuori dal tab order. */
  primary?: boolean
}

// Cella di tabella interamente cliccabile: la riga porta a una pagina con un
// solo click e con un vero <Link> (Cmd+click apre in nuova scheda). Le celle
// con azioni interne (bottoni) restano <td> normali.
export function LinkCell({ href, children, className = '', padding = 'px-3 py-3', primary = false }: Props) {
  return (
    <td className={`p-0 align-middle ${className}`}>
      <Link
        href={href}
        className={`block ${padding} text-inherit no-underline`}
        tabIndex={primary ? undefined : -1}
        aria-hidden={primary ? undefined : true}
      >
        {children}
      </Link>
    </td>
  )
}
