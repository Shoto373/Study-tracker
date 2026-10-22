import { useState, useEffect } from 'react'
import { fetchSessions, createSession, deleteSession } from '../api/client'
import type { Session, Subject } from '../types'

interface Props {
  subjects: Subject[]
  refreshKey: number
  onChanged: () => void
}

const today = () => new Date().toISOString().slice(0, 10)

function SessionPanel({ subjects, refreshKey, onChanged }: Props) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [error, setError] = useState<string | null>(null)
  const [subjectId, setSubjectId] = useState(0)
  const [date, setDate] = useState(today())
  const [minutes, setMinutes] = useState(60)
  const [note, setNote] = useState('')

  useEffect(() => {
    fetchSessions()
      .then((data) => {
        setSessions(data)
        setError(null)
      })
      .catch((err) => setError(err.message))
  }, [refreshKey])

  const selected = subjects.some((s) => s.id === subjectId) ? subjectId : subjects[0]?.id

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (selected === undefined) return
    try {
      await createSession({
        subject_id: selected,
        date,
        duration_minutes: minutes,
        session_type: 'self_study',
        note: note || null,
      })
      setNote('')
      onChanged()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteSession(id)
      onChanged()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  if (subjects.length === 0) {
    return <p className="empty">Сначала добавьте предмет во вкладке «Предметы»</p>
  }

  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <section>
      <form onSubmit={handleSubmit} className="mb-5 flex flex-wrap items-center gap-2">
        <select
          value={selected ?? ''}
          onChange={(e) => setSubjectId(Number(e.target.value))}
          className="field"
        >
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="field" />
        <input
          type="number"
          min="1"
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          className="field w-24"
          title="Минут"
        />
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Заметка"
          className="field min-w-32 flex-1"
        />
        <button type="submit" className="btn">Добавить</button>
      </form>
      {error && <p className="mb-2 text-sm text-red-400">Ошибка: {error}</p>}
      {sorted.length === 0 ? (
        <p className="empty">Сессий пока нет</p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((s) => {
            const subject = subjects.find((x) => x.id === s.subject_id)
            return (
              <li key={s.id} className="row">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: subject?.color }} />
                <div className="min-w-0">
                  <div className="font-medium">{subject?.name ?? '—'}</div>
                  <div className="truncate text-sm text-slate-400">
                    {s.date} · {s.duration_minutes} мин{s.note ? ` · ${s.note}` : ''}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(s.id)}
                  className="btn-icon ml-auto"
                  aria-label="Удалить сессию"
                >
                  ✕
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export default SessionPanel
