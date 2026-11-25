import type { ReactNode } from 'react'
import { AppModal } from '../../../shared/components/AppModal'

interface AdminModalProps {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  className?: string
}

export function AdminModal({ open, title, description, onClose, children, footer, className }: AdminModalProps) {
  return (
    <AppModal
      open={open}
      title={title}
      description={description}
      onClose={onClose}
      closeLabel="Cerrar"
      footer={footer}
      className={className}
    >
      {children}
    </AppModal>
  )
}
