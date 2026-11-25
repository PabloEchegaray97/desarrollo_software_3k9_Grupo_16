import { AppButton, type AppButtonProps, type AppButtonVariant } from '../../../shared/components/Button'

export type ButtonVariant = AppButtonVariant

interface ButtonProps extends Omit<AppButtonProps, 'size'> {
  size?: 'sm' | 'md'
}

export function Button({ variant = 'secondary', size = 'md', className, ...props }: ButtonProps) {
  const classes = ['adm-button', `adm-button--${variant}`, size === 'sm' ? 'adm-button--sm' : '', className ?? '']
    .filter(Boolean)
    .join(' ')

  return <AppButton {...props} variant={variant} size={size} className={classes} />
}
