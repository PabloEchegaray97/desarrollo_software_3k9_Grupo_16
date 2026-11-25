import { ArrowCounterClockwise, Check } from '@phosphor-icons/react'
import { type ReactNode } from 'react'
import { AppButton } from './Button'
import { AppModal } from './AppModal'
import './filter-modal.css'

interface FilterModalProps {
  open: boolean
  title: string
  description?: string
  children: ReactNode
  onClose: () => void
  onClear: () => void
  onApply: () => void
}

export function FilterModal({ open, title, description, children, onClose, onClear, onApply }: FilterModalProps) {
  return (
    <AppModal
      open={open}
      title={title}
      description={description}
      onClose={onClose}
      className="filter-modal"
      closeLabel="Cerrar filtros"
      footer={(
        <>
          <AppButton variant="secondary" leftIcon={<ArrowCounterClockwise />} onClick={onClear}>Limpiar</AppButton>
          <AppButton variant="primary" leftIcon={<Check />} onClick={onApply}>Aplicar filtros</AppButton>
        </>
      )}
    >
      <div className="filter-modal__content">{children}</div>
    </AppModal>
  )
}
