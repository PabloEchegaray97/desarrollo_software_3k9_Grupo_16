import { Children, forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import './button.css'

export type AppButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'highlight'
export type AppButtonSize = 'sm' | 'md' | 'lg'

export interface AppButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: AppButtonVariant
  size?: AppButtonSize
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  loading?: boolean
  loadingText?: ReactNode
  iconOnly?: boolean
}

export const AppButton = forwardRef<HTMLButtonElement, AppButtonProps>(function AppButton(
  {
    className,
    variant = 'primary',
    size = 'md',
    leftIcon,
    rightIcon,
    loading = false,
    loadingText,
    iconOnly,
    children,
    type = 'button',
    disabled = false,
    ...props
  },
  ref,
) {
  const hasChildren = Children.toArray(children).length > 0
  const isIconOnly = iconOnly ?? !hasChildren
  const isDisabled = disabled || loading
  const classes = [
    'app-button',
    `app-button--${variant}`,
    `app-button--${size}`,
    isIconOnly ? 'app-button--icon-only' : '',
    className ?? '',
  ].filter(Boolean).join(' ')

  const label = loading ? loadingText ?? children : children
  const leadingIcon = loading ? <span className="app-button__spinner" aria-hidden="true" /> : leftIcon
  const trailingIcon = loading ? null : rightIcon
  const iconOnlyContent = leadingIcon ?? trailingIcon

  return (
    <button
      {...props}
      ref={ref}
      type={type}
      className={classes}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      data-loading={loading ? 'true' : undefined}
    >
      {isIconOnly && iconOnlyContent ? <span className="app-button__icon" aria-hidden="true">{iconOnlyContent}</span> : null}
      {!isIconOnly && leadingIcon ? <span className="app-button__icon" aria-hidden="true">{leadingIcon}</span> : null}
      {!isIconOnly ? <span className="app-button__label">{label}</span> : null}
      {!isIconOnly && trailingIcon ? <span className="app-button__icon" aria-hidden="true">{trailingIcon}</span> : null}
    </button>
  )
})

AppButton.displayName = 'AppButton'
