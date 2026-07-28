import { cn } from '@/lib/utils'
import type { AppRole } from '@/types/profile'

const labels: Record<AppRole, string> = {
  admin: 'ADMIN',
  staff: 'STAFF',
  member: 'MEMBRO',
}

export function RoleBadge({
  role,
  className,
}: {
  role: AppRole
  className?: string
}) {
  return (
    <span
      className={cn(
        'font-pixel-badge inline-flex items-center rounded-sm border px-2 py-1',
        role === 'admin' &&
          'border-e4-gold bg-e4-gold/15 text-e4-gold shadow-[0_0_12px_rgba(242,183,5,0.35)]',
        role === 'staff' && 'border-e4-silver/50 bg-e4-black-soft text-e4-silver',
        role === 'member' && 'border-e4-silver/20 bg-e4-black-soft text-e4-silver/80',
        className,
      )}
    >
      {labels[role]}
    </span>
  )
}
