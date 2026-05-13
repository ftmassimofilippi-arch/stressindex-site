'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

export type Column<T> = {
  key: string
  header: string
  render?: (row: T) => React.ReactNode
  accessor?: (row: T) => string | number | null | undefined
  sortable?: boolean
  className?: string
  width?: string
}

type Props<T> = {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  emptyState?: React.ReactNode
  pageSize?: number
  initialSort?: { key: string; dir: 'asc' | 'desc' }
}

export function DataTable<T>({ columns, rows, rowKey, onRowClick, emptyState, pageSize = 20, initialSort }: Props<T>) {
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
      <div className="overflow-x-auto rounded-2xl border border-surface-border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-surface text-anthracite-lighter sticky top-0">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  style={{ width: c.width }}
                  className={`text-left font-medium uppercase tracking-wide text-[11px] px-4 py-3 ${c.className ?? ''}`}
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
            {paged.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-t border-surface-border ${onRowClick ? 'cursor-pointer hover:bg-surface' : ''} transition-colors`}
              >
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-3 align-middle ${c.className ?? ''}`}>
                    {c.render ? c.render(row) : (c.accessor ? c.accessor(row) : null)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-anthracite-lighter">
          <div>
            {sorted.length} risultati · pagina {page + 1} di {totalPages}
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="px-3 py-1.5 rounded-lg border border-surface-border disabled:opacity-50 hover:bg-surface">
              Precedente
            </button>
            <button type="button" disabled={page >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} className="px-3 py-1.5 rounded-lg border border-surface-border disabled:opacity-50 hover:bg-surface">
              Successiva
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
