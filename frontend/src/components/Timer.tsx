import { useState, useEffect } from 'react'
import { createSession } from '../api/client'
import type { Subject } from '../types'

interface Props {
  subjects: Subject[]
  onSaved: () => void
}

// startedAt is set while running, null while paused; accumulated holds ms from earlier runs
interface TimerState {
  subjectId: number
  startedAt: number | null
  accumulated: number
}

const STORAGE_KEY = 'study-tracker-timer'

function loadState(): TimerState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as TimerState) : null
  } catch {
    return null
  }
}

function saveState(state: TimerState | null) {
  try {
    if (state) localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // storage unavailable: timer still works until reload
  }
}

const localDate = () => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function format(ms: number) {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

function Timer({ subjects, onSaved }: Props) {
  const [state, setState] = useState<TimerState | null>(loadState)
  const [now, setNow] = useState(() => Date.now())
  const [subjectId, setSubjectId] = useState(0)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const running = state?.startedAt != null

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [running])

  function update(next: TimerState | null) {
    saveState(next)
    setState(next)
    setNow(Date.now())
  }

  const selected = subjects.some((s) => s.id === subjectId) ? subjectId : subjects[0]?.id
  const elapsed = state ? state.accumulated + (state.startedAt != null ? Math.max(0, now - state.startedAt) : 0) : 0
  const timerSubject = state ? subjects.find((s) => s.id === state.subjectId) : undefined

  function handleStart() {
    if (selected === undefined) return
    setError(null)
    update({ subjectId: selected, startedAt: Date.now(), accumulated: 0 })
  }

  function handlePause() {
    if (!state || state.startedAt == null) return
    update({ ...state, startedAt: null, accumulated: state.accumulated + (Date.now() - state.startedAt) })
  }

  function handleResume() {
    if (!state) return
    update({ ...state, startedAt: Date.now() })
  }

  function handleReset() {
    update(null)
    setNote('')
    setError(null)
  }

  async function handleStop() {
    if (!state || saving) return
    const total = state.accumulated + (state.startedAt != null ? Date.now() - state.startedAt : 0)
    setSaving(true)
    try {
      await createSession({
        subject_id: state.subjectId,
        date: localDate(),
        duration_minutes: Math.max(1, Math.round(total / 60000)),
        session_type: 'self_study',
        note: note || null,
      })
      update(null)
      setNote('')
      setError(null)
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (subjects.length === 0) {
    return <p className="empty">Сначала добавьте предмет во вкладке «Предметы»</p>
  }

  return (
    <section className="space-y-4">
      <div className="text-center">
        <div className="font-mono text-6xl font-bold tabular-nums">{format(elapsed)}</div>
        {state && (
          <div className="mt-2 flex items-center justify-center gap-2 text-sm text-slate-400">
            <span className="h-3 w-3 rounded-full" style={{ background: timerSubject?.color }} />
            {timerSubject?.name ?? '—'}
            {!running && ' · пауза'}
          </div>
        )}
      </div>

      {!state ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <select
            value={selected ?? ''}
            onChange={(e) => setSubjectId(Number(e.target.value))}
            className="field"
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button onClick={handleStart} className="btn">Старт</button>
        </div>
      ) : (
        <div className="space-y-3">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Заметка"
            className="field w-full"
          />
          <div className="flex flex-wrap items-center justify-center gap-2">
            {running ? (
              <button onClick={handlePause} className="btn">Пауза</button>
            ) : (
              <button onClick={handleResume} className="btn">Продолжить</button>
            )}
            <button onClick={handleStop} disabled={saving} className="btn">Стоп и сохранить</button>
            <button onClick={handleReset} disabled={saving} className="btn">Сбросить</button>
          </div>
        </div>
      )}

      {error && <p className="text-center text-sm text-red-400">Ошибка: {error}</p>}
    </section>
  )
}

export default Timer
