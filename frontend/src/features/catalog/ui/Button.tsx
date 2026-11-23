import type { ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'highlight'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md'
  loading?: boolean
}

export function Button({ variant = 'secondary', size = 'md', loading = false, className, disabled, type = 'button', children, ...props }: ButtonProps) {
  const classes = ['adm-button', `adm-button--${variant}`, size === 'sm' ? 'adm-button--sm' : '', className ?? ''].filter(Boolean).join(' ')
  return (
    <button {...props} type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined}>
      {children}
    </button>
  )
}
