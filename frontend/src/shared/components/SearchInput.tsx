import { MagnifyingGlass } from '@phosphor-icons/react'
import { type FormEvent, type InputHTMLAttributes } from 'react'
import './search-input.css'

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type' | 'value'> {
  value: string
  onChange: (value: string) => void
  onSearch?: () => void
  buttonLabel?: string
}

export function SearchInput({ value, onChange, onSearch, buttonLabel = 'Buscar', className, ...props }: SearchInputProps) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSearch?.()
  }

  return (
    <form className={`search-input${className ? ` ${className}` : ''}`} role="search" onSubmit={submit}>
      <input {...props} type="search" value={value} onChange={(event) => onChange(event.target.value)} />
      <button type="submit" aria-label={buttonLabel}>
        <span>{buttonLabel}</span>
        <MagnifyingGlass size={15} aria-hidden="true" />
      </button>
    </form>
  )
}
