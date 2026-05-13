import Link from 'next/link'
import { LucideIcon } from 'lucide-react'

type Props = {
  icon?: LucideIcon
  title: string
  description?: string
  action?: { label: string; href?: string; onClick?: () => void }
}

export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="text-center py-12 px-6">
      {Icon && (
        <div className="mx-auto w-12 h-12 rounded-2xl bg-teal-light text-teal-dark flex items-center justify-center mb-4">
          <Icon size={22} />
        </div>
      )}
      <h3 className="text-lg font-serif text-anthracite">{title}</h3>
      {description && <p className="mt-1.5 text-sm text-anthracite-lighter max-w-md mx-auto">{description}</p>}
      {action && (
        action.href ? (
          <Link href={action.href} className="btn-primary text-sm mt-5">{action.label}</Link>
        ) : (
          <button type="button" onClick={action.onClick} className="btn-primary text-sm mt-5">{action.label}</button>
        )
      )}
    </div>
  )
}
