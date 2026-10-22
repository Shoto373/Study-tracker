import { useState, useEffect } from 'react'
import { fetchDeadlines, createDeadline, updateDeadline, deleteDeadline } from '../api/client'
import type { Deadline, Subject } from '../types'

interface Props {
  subjects: Subject[]
  refreshKey: number
}

function DeadlinePanel({ subjects, refreshKey }: Props) {
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [error, setError] = useState<string | null>(null)
  const [subjectId, setSubjectId] = useState(0)
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')

  const load = () =>
    fetchDeadlines()
      .then((data) => {
        setDeadlines(data)
        setError(null)
      })
      .catch((err) => setError(err.message))

  useEffect(() => {
    load()
  }, [refreshKey])

  const selected = subjects.some((s) => s.id === subjectId) ? subjectId : subjects[0]?.id

  async function run(action: () => Promise<unknown>) {
    try {
      await action()
      await load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (selected === undefined) return
    run(async () => {
      await createDeadline({ subject_id: selected, title, due_date: dueDate, is_done: false })
      setTitle('')
      setDueDate('')
    })
  }

  const toggle = (d: Deadline) =>
    run(() => updateDeadline(d.id, {
      subject_id: d.subject_id,
      title: d.title,
      due_date: d.due_date,
      is_done: !d.is_done,
    }))

  if (subjects.length === 0) {
    return <p className="empty">Сначала добавьте предмет во вкладке «Предметы»</p>
  }

  const sorted = [...deadlines].sort(
    (a, b) => Number(a.is_done) - Number(b.is_done) || a.due_date.localeCompare(b.due_date),
  )
  const todayStr = new Date().toISOString().slice(0, 10)

  return (
    <section>
      <form onSubmit={handleSubmit} className="mb-5 flex flex-wrap items-center gap-2">
        <select value={selected ?? ''} onChange={(e) => setSubjectId(Number(e.target.value))} className="field">
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Что сдать"
          required
          className="field min-w-32 flex-1"
        />
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required className="field" />
        <button type="submit" className="btn">Добавить</button>
      </form>
      {error && <p className="mb-2 text-sm text-red-400">Ошибка: {error}</p>}
      {sorted.length === 0 ? (
        <p className="empty">Дедлайнов пока нет</p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((d) => {
            const subject = subjects.find((x) => x.id === d.subject_id)
            const overdue = !d.is_done && d.due_date < todayStr
            return (
              <li key={d.id} className="row">
                <input
                  type="checkbox"
                  checked={d.is_done}
                  onChange={() => toggle(d)}
                  className="h-4 w-4 cursor-pointer accent-blue-500"
                  aria-label="Выполнено"
                />
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: subject?.color }} />
                <div className="min-w-0">
                  <div className={d.is_done ? 'text-slate-500 line-through' : 'font-medium'}>{d.title}</div>
                  <div className={`text-sm ${overdue ? 'text-red-400' : 'text-slate-400'}`}>
                    {subject?.name ?? '—'} · до {d.due_date}{overdue && ' · просрочен'}
                  </div>
                </div>
                <button
                  onClick={() => run(() => deleteDeadline(d.id))}
                  className="btn-icon ml-auto"
                  aria-label="Удалить дедлайн"
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

export default DeadlinePanel
