import { useState, useEffect } from 'react'
import { fetchSessions, createSession, updateSession, deleteSession } from '../api/client'
import type { Session, Subject } from '../types'

interface Props {
  subjects: Subject[]
  refreshKey: number
  onChanged: () => void
}

const today = () => new Date().toLocaleDateString('sv-SE')

function SessionPanel({ subjects, refreshKey, onChanged }: Props) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [error, setError] = useState<string | null>(null)
  const [subjectId, setSubjectId] = useState(0)
  const [date, setDate] = useState(today())
  const [minutes, setMinutes] = useState(60)
  const [note, setNote] = useState('')

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editSubject, setEditSubject] = useState(0)
  const [editDate, setEditDate] = useState('')
  const [editMinutes, setEditMinutes] = useState(60)
  const [editNote, setEditNote] = useState('')
  const [editError, setEditError] = useState<string | null>(null)

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

  function startEdit(s: Session) {
    setEditingId(s.id)
    setEditSubject(s.subject_id)
    setEditDate(s.date)
    setEditMinutes(s.duration_minutes)
    setEditNote(s.note ?? '')
    setEditError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditError(null)
  }

  async function saveEdit(s: Session) {
    try {
      await updateSession(s.id, {
        subject_id: editSubject,
        date: editDate,
        duration_minutes: editMinutes,
        session_type: s.session_type,
        note: editNote || null,
      })
      setEditingId(null)
      setEditError(null)
      onChanged()
    } catch (err) {
      setEditError((err as Error).message)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent, s: Session) {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveEdit(s)
    } else if (e.key === 'Escape') {
      cancelEdit()
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
            if (editingId === s.id) {
              return (
                <li key={s.id} className="row flex-wrap" onKeyDown={(e) => handleKeyDown(e, s)}>
                  <select
                    value={editSubject}
                    onChange={(e) => setEditSubject(Number(e.target.value))}
                    className="field"
                  >
                    {subjects.map((x) => (
                      <option key={x.id} value={x.id}>{x.name}</option>
                    ))}
                  </select>
                  <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} required className="field" />
                  <input
                    type="number"
                    min="1"
                    value={editMinutes}
                    onChange={(e) => setEditMinutes(Number(e.target.value))}
                    className="field w-24"
                    title="Минут"
                  />
                  <input
                    type="text"
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    placeholder="Заметка"
                    autoFocus
                    className="field min-w-32 flex-1"
                  />
                  <button onClick={() => saveEdit(s)} className="btn">Сохранить</button>
                  <button onClick={cancelEdit} className="btn-icon" aria-label="Отмена">✕</button>
                  {editError && <p className="w-full text-sm text-red-400">Ошибка: {editError}</p>}
                </li>
              )
            }
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
                  onClick={() => startEdit(s)}
                  className="btn-icon ml-auto"
                  aria-label="Редактировать сессию"
                >
                  ✎
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
                  className="btn-icon"
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
