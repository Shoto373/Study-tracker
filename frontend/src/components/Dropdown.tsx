import { useRef, useState } from 'react'

interface Option {
  id: number
  name: string
}

interface Props {
  options: Option[]
  value: number
  onChange: (id: number) => void
  placeholder: string
  className?: string
}

const POPUP_HEIGHT = 270

function Dropdown({ options, value, onChange, placeholder, className = 'w-36' }: Props) {
  const [open, setOpen] = useState(false)
  // Открывать вверх, если снизу не хватает места под список.
  const [up, setUp] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const selected = options.find((o) => o.id === value)

  return (
    <div ref={root} className={`relative ${className}`} onBlur={() => setOpen(false)}>
      <button
        type="button"
        onClick={() => {
          if (!open) {
            const rect = root.current?.getBoundingClientRect()
            if (rect) setUp(window.innerHeight - rect.bottom < POPUP_HEIGHT && rect.top > window.innerHeight - rect.bottom)
          }
          setOpen((v) => !v)
        }}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        className="field flex w-full cursor-pointer items-center justify-between gap-2 text-left"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selected ? '' : 'text-slate-500'}>{selected?.name ?? placeholder}</span>
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-slate-400" fill="currentColor" aria-hidden>
          <path d="M5.5 7.5 10 12l4.5-4.5z" />
        </svg>
      </button>
      {open && options.length > 0 && (
        <ul
          role="listbox"
          className={`absolute left-0 z-30 max-h-60 w-full min-w-36 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-xl shadow-black/40 ${
            up ? 'bottom-11' : 'top-11'
          }`}
        >
          {options.map((o) => (
            <li
              key={o.id}
              role="option"
              aria-selected={o.id === value}
              // mousedown срабатывает раньше blur, иначе список закрылся бы до клика
              onMouseDown={(e) => {
                e.preventDefault()
                onChange(o.id)
                setOpen(false)
              }}
              className={`cursor-pointer px-3 py-1.5 text-sm hover:bg-slate-800 ${
                o.id === value ? 'text-blue-400' : 'text-slate-200'
              }`}
            >
              {o.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default Dropdown
