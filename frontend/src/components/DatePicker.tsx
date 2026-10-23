import { useRef, useState } from 'react'

interface Props {
  value: string // YYYY-MM-DD или пусто
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

const POPUP_HEIGHT = 380

const pad = (n: number) => String(n).padStart(2, '0')
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const fromIso = (s: string) => new Date(`${s}T00:00:00`)

function DatePicker({ value, onChange, placeholder = 'дд.мм.гггг', className = 'w-44' }: Props) {
  const [open, setOpen] = useState(false)
  // Открывать вверх, если снизу не хватает места под календарь.
  const [up, setUp] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const [view, setView] = useState(() => {
    const d = value ? fromIso(value) : new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  const today = toIso(new Date())
  const label = value ? `${value.slice(8, 10)}.${value.slice(5, 7)}.${value.slice(0, 4)}` : ''

  // 6 недель, начиная с понедельника недели, в которую попадает 1-е число месяца.
  const first = new Date(view.year, view.month, 1)
  const offset = (first.getDay() + 6) % 7
  const cells = Array.from({ length: 42 }, (_, i) => new Date(view.year, view.month, 1 - offset + i))

  function toggle() {
    if (!open) {
      const rect = root.current?.getBoundingClientRect()
      if (rect) setUp(window.innerHeight - rect.bottom < POPUP_HEIGHT && rect.top > window.innerHeight - rect.bottom)
      const d = value ? fromIso(value) : new Date()
      setView({ year: d.getFullYear(), month: d.getMonth() })
    }
    setOpen((v) => !v)
  }

  function shiftMonth(delta: number) {
    const d = new Date(view.year, view.month + delta, 1)
    setView({ year: d.getFullYear(), month: d.getMonth() })
  }

  function pick(iso: string) {
    onChange(iso)
    setOpen(false)
  }

  return (
    <div
      ref={root}
      className={`relative ${className}`}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false)
      }}
      onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
    >
      <button
        type="button"
        onClick={toggle}
        className="field flex w-full cursor-pointer items-center justify-between gap-2 text-left"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={label ? '' : 'text-slate-500'}>{label || placeholder}</span>
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
          <rect x="3" y="4.5" width="14" height="12.5" rx="2" />
          <path d="M3 8.5h14M7 3v3M13 3v3" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          role="dialog"
          className={`absolute left-0 z-30 w-72 rounded-xl border border-slate-700 bg-slate-900 p-3 shadow-xl shadow-black/40 ${
            up ? 'bottom-11' : 'top-11'
          }`}
        >
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => shiftMonth(-1)} className="btn-icon" aria-label="Предыдущий месяц">
              ‹
            </button>
            <span className="text-sm font-medium">
              {MONTHS[view.month]} {view.year}
            </span>
            <button type="button" onClick={() => shiftMonth(1)} className="btn-icon" aria-label="Следующий месяц">
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 text-center text-xs text-slate-500">
            {WEEKDAYS.map((d) => (
              <span key={d} className="py-1">{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-0.5 text-center text-sm">
            {cells.map((d) => {
              const iso = toIso(d)
              const inMonth = d.getMonth() === view.month
              const selected = iso === value
              return (
                <button
                  type="button"
                  key={iso}
                  onClick={() => pick(iso)}
                  className={`h-9 cursor-pointer rounded-lg transition ${
                    selected
                      ? 'bg-blue-600 font-medium text-white'
                      : `hover:bg-slate-800 ${inMonth ? 'text-slate-200' : 'text-slate-600'} ${
                          iso === today ? 'ring-1 ring-inset ring-blue-500/70' : ''
                        }`
                  }`}
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>

          <div className="mt-2 flex justify-between border-t border-slate-800 pt-2 text-sm">
            <button type="button" onClick={() => pick(today)} className="text-blue-400 hover:text-blue-300">
              Сегодня
            </button>
            {value && (
              <button type="button" onClick={() => pick('')} className="text-slate-500 hover:text-slate-300">
                Очистить
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default DatePicker
