'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Link } from '@/i18n/navigation'

export type Column<T> = {
  key: string
  header: string
  render?: (row: T) => React.ReactNode
  accessor?: (row: T) => string | number | null | undefined
  sortable?: boolean
  className?: string
  width?: string
  /** La cella contiene azioni proprie (bottoni): non diventa parte del link di riga. */
  noLink?: boolean
  /** Colonna fissa sul bordo destro quando la tabella scorre in orizzontale. */
  sticky?: boolean
}

const STICKY_CELL = 'sticky right-0 z-[1] shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.15)]'

type Props<T> = {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  /** Riga interamente cliccabile con un vero <Link> (un solo click, Cmd+click apre in nuova scheda). */
  rowHref?: (row: T) => string
  emptyState?: React.ReactNode
  pageSize?: number
  initialSort?: { key: string; dir: 'asc' | 'desc' }
}

export function DataTable<T>({ columns, rows, rowKey, onRowClick, rowHref, emptyState, pageSize = 20, initialSort }: Props<T>) {
  const t = useTranslations('dashboard.table')
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(initialSort ?? null)
  const [page, setPage] = useState(0)

  const sorted = useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col || !col.accessor) return rows
    const arr = [...rows]
    arr.sort((a, b) => {
      const av = col.accessor!(a)
      const bv = col.accessor!(b)
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (av < bv) return sort.dir === 'asc' ? -1 : 1
      if (av > bv) return sort.dir === 'asc' ? 1 : -1
      return 0
    })
    return arr
  }, [rows, sort, columns])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const paged = sorted.slice(page * pageSize, page * pageSize + pageSize)

  function toggleSort(key: string) {
    setSort((s) => {
      if (!s || s.key !== key) return { key, dir: 'asc' }
      if (s.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }

  if (rows.length === 0 && emptyState) {
    return <>{emptyState}</>
  }

  return (
    <div className="w-full">
      {/* Sotto i 640 px una card per riga (audit QA, F2): la prima colonna fa da
          titolo, le altre diventano coppie etichetta/valore, così Stress e
          Alert non finiscono fuori schermo. */}
      <ul className="sm:hidden space-y-2">
        {paged.map((row) => {
          const href = rowHref?.(row)
          const [first, ...rest] = columns
          const cell = (c: Column<T>) => (c.render ? c.render(row) : (c.accessor ? c.accessor(row) : null))
          const linked = rest.filter((c) => !c.noLink)
          const actions = rest.filter((c) => c.noLink)
          const body = (
            <>
              <div className="min-w-0">{first ? cell(first) : null}</div>
              {linked.length > 0 && (
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                  {linked.map((c) => (
                    <div key={c.key} className="min-w-0">
                      {c.header && <dt className="text-[10px] uppercase tracking-wide text-anthracite-lighter">{c.header}</dt>}
                      <dd className="text-sm text-anthracite min-w-0">{cell(c)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </>
          )
          return (
            <li key={rowKey(row)} className="rounded-2xl border border-surface-border bg-white">
              {href ? (
                <Link href={href} className="block p-4 hover:bg-surface transition-colors rounded-2xl">{body}</Link>
              ) : (
                <div className={`p-4 ${onRowClick ? 'cursor-pointer' : ''}`} onClick={onRowClick ? () => onRowClick(row) : undefined}>{body}</div>
              )}
              {actions.length > 0 && (
                <div className="px-4 pb-3 -mt-1 flex justify-end gap-2">{actions.map((c) => <div key={c.key}>{cell(c)}</div>)}</div>
              )}
            </li>
          )
        })}
      </ul>
      <div className="hidden sm:block overflow-x-auto rounded-2xl border border-surface-border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-surface text-anthracite-lighter sticky top-0">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  style={{ width: c.width }}
                  className={`text-left font-medium uppercase tracking-wide text-[11px] px-4 py-3 ${c.sticky ? `${STICKY_CELL} bg-surface` : ''} ${c.className ?? ''}`}
                >
                  {c.sortable && c.accessor ? (
                    <button
                      type="button"
                      className="flex items-center gap-1 hover:text-anthracite transition-colors"
                      onClick={() => toggleSort(c.key)}
                    >
                      {c.header}
                      {sort?.key === c.key ? (
                        sort.dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                      ) : <ChevronDown size={12} className="opacity-30" />}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((row) => {
              const href = rowHref?.(row)
              let primaryAssigned = false
              return (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`border-t border-surface-border ${onRowClick || href ? 'cursor-pointer hover:bg-surface' : ''} transition-colors`}
                >
                  {columns.map((c) => {
                    const content = c.render ? c.render(row) : (c.accessor ? c.accessor(row) : null)
                    if (href && !c.noLink) {
                      const primary = !primaryAssigned
                      primaryAssigned = true
                      return (
                        <td key={c.key} className={`p-0 align-middle ${c.sticky ? `${STICKY_CELL} bg-white` : ''} ${c.className ?? ''}`}>
                          <Link
                            href={href}
                            className="block px-4 py-3"
                            tabIndex={primary ? undefined : -1}
                            aria-hidden={primary ? undefined : true}
                          >
                            {content}
                          </Link>
                        </td>
                      )
                    }
                    return (
                      <td key={c.key} className={`px-4 py-3 align-middle ${c.sticky ? `${STICKY_CELL} bg-white` : ''} ${c.className ?? ''}`}>
                        {content}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 flex-wrap mt-4 text-sm text-anthracite-lighter">
          <div>
            {t('results', { count: sorted.length })} · {t('page', { page: page + 1, pages: totalPages })}
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="px-3 py-1.5 rounded-lg border border-surface-border disabled:opacity-50 hover:bg-surface">
              {t('prev')}
            </button>
            <button type="button" disabled={page >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} className="px-3 py-1.5 rounded-lg border border-surface-border disabled:opacity-50 hover:bg-surface">
              {t('next')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
