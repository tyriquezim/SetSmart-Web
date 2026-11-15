import {
  useEffect,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react'

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ')

// ---- Button ----------------------------------------------------------------

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg' | 'xl'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-zinc-950 hover:bg-accent-strong font-semibold',
  secondary: 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700',
  ghost: 'text-zinc-300 hover:bg-zinc-800/70 hover:text-zinc-100',
  danger: 'bg-red-500/15 text-red-300 hover:bg-red-500/25',
}
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm rounded-lg',
  md: 'h-10 px-4 text-sm rounded-xl',
  lg: 'h-12 px-5 text-base rounded-xl',
  xl: 'h-16 px-6 text-lg rounded-2xl',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

export function Button({ variant = 'secondary', size = 'md', loading, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 transition-colors select-none',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:opacity-40 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  )
}

// ---- Layout bits -----------------------------------------------------------

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-2xl bg-zinc-900 border border-zinc-800/80', className)}>{children}</div>
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-zinc-400 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Card className="p-8 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="text-sm text-zinc-400 mt-2 space-y-4">{children}</div>}
    </Card>
  )
}

export function Spinner({ className = 'size-6' }: { className?: string }) {
  return (
    <svg className={cx('animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function FullScreenSpinner() {
  return (
    <div className="min-h-dvh grid place-items-center text-zinc-500">
      <Spinner className="size-8" />
    </div>
  )
}

export function LoadingBlock() {
  return (
    <div className="py-16 grid place-items-center text-zinc-500">
      <Spinner />
    </div>
  )
}

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null
  const message = error instanceof Error ? error.message : String(error)
  return (
    <p role="alert" className="text-sm text-red-300 bg-red-500/10 rounded-xl px-3 py-2">
      {message}
    </p>
  )
}

// ---- Form controls ---------------------------------------------------------

const inputClass =
  'w-full h-11 rounded-xl bg-zinc-950 border border-zinc-800 px-3 text-zinc-100 placeholder:text-zinc-600 ' +
  'focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent'

export function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string) => ReactNode }) {
  const id = useId()
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-zinc-300">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
    </div>
  )
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cx(inputClass, className)} />
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={cx(inputClass, 'appearance-none', className)}>
      {children}
    </select>
  )
}

/**
 * Numeric input that keeps its own text while typing (so "62." or "" are allowed)
 * and reports a parsed number (or null when empty).
 */
export function NumberInput({
  value,
  onChange,
  allowEmpty = false,
  decimals = true,
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number | null
  onChange: (v: number | null) => void
  allowEmpty?: boolean
  decimals?: boolean
}) {
  const [text, setText] = useState(value == null ? '' : String(value))
  const [prevValue, setPrevValue] = useState(value)
  // Sync when the value changes from outside (e.g. steppers) without clobbering
  // in-progress typing that already parses to the same number.
  if (value !== prevValue) {
    setPrevValue(value)
    const parsed = text === '' ? null : Number(text)
    if (parsed !== value) setText(value == null ? '' : String(value))
  }
  return (
    <input
      {...rest}
      type="number"
      inputMode={decimals ? 'decimal' : 'numeric'}
      step={decimals ? 'any' : 1}
      value={text}
      onChange={(e) => {
        const t = e.target.value
        setText(t)
        if (t === '') {
          if (allowEmpty) onChange(null) // otherwise keep the last value until blur
        } else if (!Number.isNaN(Number(t))) onChange(Number(t))
      }}
      onBlur={(e) => {
        if (text === '' && !allowEmpty) setText(value == null ? '' : String(value))
        rest.onBlur?.(e)
      }}
      className={cx(inputClass, 'text-center tabular-nums', className)}
    />
  )
}

/** Big +/- stepper used in the workout player. */
export function Stepper({
  label,
  value,
  onChange,
  step,
  min = 0,
  suffix,
  allowEmpty,
  decimals,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  step: number
  min?: number
  suffix?: string
  allowEmpty?: boolean
  decimals?: boolean
}) {
  const id = useId()
  const bump = (d: number) => onChange(Math.max(min, Math.round(((value ?? 0) + d) * 100) / 100))
  return (
    <div className="flex-1 min-w-0">
      <label htmlFor={id} className="block text-xs uppercase tracking-wider text-zinc-400 text-center mb-2">
        {label}
        {suffix && <span className="text-zinc-500 normal-case tracking-normal"> ({suffix})</span>}
      </label>
      <div className="flex items-stretch gap-2">
        <Button size="xl" className="w-14 shrink-0 px-0 text-2xl" onClick={() => bump(-step)} aria-label={`Decrease ${label}`}>
          −
        </Button>
        <NumberInput
          id={id}
          value={value}
          onChange={onChange}
          allowEmpty={allowEmpty}
          decimals={decimals}
          className="h-16 text-3xl font-bold rounded-2xl min-w-0"
        />
        <Button size="xl" className="w-14 shrink-0 px-0 text-2xl" onClick={() => bump(step)} aria-label={`Increase ${label}`}>
          +
        </Button>
      </div>
    </div>
  )
}

// ---- Segmented control -----------------------------------------------------

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled,
  label,
}: {
  label?: string
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (v: T) => void
  disabled?: boolean
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-xl bg-zinc-950 border border-zinc-800 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`px-3 h-8 rounded-lg whitespace-nowrap text-sm font-medium transition-colors ${
            value === o.value ? 'bg-zinc-800 text-accent' : 'text-zinc-400 hover:text-zinc-100'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ---- Modal -----------------------------------------------------------------

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full sm:max-w-lg max-h-[90dvh] flex flex-col bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-3xl"
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            ✕
          </Button>
        </div>
        <div className="px-5 pb-5 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 pb-safe pt-3 border-t border-zinc-800 flex gap-2 justify-end">{footer}</div>}
      </div>
    </div>
  )
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  danger,
  loading,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-zinc-300">{message}</div>
    </Modal>
  )
}
