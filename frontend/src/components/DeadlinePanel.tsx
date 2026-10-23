import { useState, useEffect } from 'react'
import { fetchDeadlines, createDeadline, updateDeadline, deleteDeadline } from '../api/client'
import type { Deadline, Subject } from '../types'
import Dropdown from './Dropdown'
import DatePicker from './DatePicker'

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

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editSubject, setEditSubject] = useState(0)
  const [editTitle, setEditTitle] = useState('')
  const [editDue, setEditDue] = useState('')
  const [editError, setEditError] = useState<string | null>(null)

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

  function startEdit(d: Deadline) {
    setEditingId(d.id)
    setEditSubject(d.subject_id)
    setEditTitle(d.title)
    setEditDue(d.due_date)
    setEditError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditError(null)
  }

  async function saveEdit(d: Deadline) {
    try {
      await updateDeadline(d.id, {
        subject_id: editSubject,
        title: editTitle,
        due_date: editDue,
        is_done: d.is_done,
      })
      setEditingId(null)
      setEditError(null)
      await load()
    } catch (err) {
      setEditError((err as Error).message)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent, d: Deadline) {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveEdit(d)
    } else if (e.key === 'Escape') {
      cancelEdit()
    }
  }

  if (subjects.length === 0) {
    return <p className="empty">Сначала добавьте предмет во вкладке «Предметы»</p>
  }

  const sorted = [...deadlines].sort(
    (a, b) => Number(a.is_done) - Number(b.is_done) || a.due_date.localeCompare(b.due_date),
  )
  const todayStr = new Date().toLocaleDateString('sv-SE')

  // Дней до дедлайна: красный при <= 1 дне и просрочке, жёлтый при <= 3 днях.
  function urgency(d: Deadline) {
    if (d.is_done) return null
    const days = Math.round(
      (new Date(`${d.due_date}T00:00:00`).getTime() - new Date(`${todayStr}T00:00:00`).getTime()) / 86400000,
    )
    if (days < 0) return { tone: 'red', label: 'просрочен' }
    if (days === 0) return { tone: 'red', label: 'сегодня' }
    if (days === 1) return { tone: 'red', label: 'завтра' }
    if (days <= 3) return { tone: 'yellow', label: `через ${days} дня` }
    return null
  }

  return (
    <section>
      <form onSubmit={handleSubmit} className="mb-5 flex flex-wrap items-center gap-2">
        <Dropdown
          options={subjects}
          value={selected ?? 0}
          onChange={setSubjectId}
          placeholder="Предмет"
          className="w-full"
        />
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Что сделать"
          required
          className="field min-w-32 flex-1"
        />
        <DatePicker value={dueDate} onChange={setDueDate} />
        <button type="submit" disabled={!title.trim() || !dueDate} className="btn">Добавить</button>
      </form>
      {error && <p className="mb-2 text-sm text-red-400">Ошибка: {error}</p>}
      {sorted.length === 0 ? (
        <p className="empty">Дедлайнов пока нет</p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((d) => {
            const subject = subjects.find((x) => x.id === d.subject_id)
            const urgent = urgency(d)
            if (editingId === d.id) {
              return (
                <li key={d.id} className="row flex-wrap" onKeyDown={(e) => handleKeyDown(e, d)}>
                  <Dropdown
                    options={subjects}
                    value={editSubject}
                    onChange={setEditSubject}
                    placeholder="Предмет"
                    className="w-full"
                  />
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Что сдать"
                    required
                    autoFocus
                    className="field min-w-32 flex-1"
                  />
                  <DatePicker value={editDue} onChange={setEditDue} />
                  <button onClick={() => saveEdit(d)} className="btn">Сохранить</button>
                  <button onClick={cancelEdit} className="btn-icon" aria-label="Отмена">✕</button>
                  {editError && <p className="w-full text-sm text-red-400">Ошибка: {editError}</p>}
                </li>
              )
            }
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
                  <div
                    className={`text-sm ${
                      urgent?.tone === 'red'
                        ? 'text-red-400'
                        : urgent?.tone === 'yellow'
                          ? 'text-yellow-400'
                          : 'text-slate-400'
                    }`}
                  >
                    {subject?.name ?? '—'} · до {d.due_date}
                    {urgent && (
                      <span
                        className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                          urgent.tone === 'red' ? 'bg-red-500/15' : 'bg-yellow-500/15'
                        }`}
                      >
                        {urgent.label}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => startEdit(d)}
                  className="btn-icon ml-auto"
                  aria-label="Редактировать дедлайн"
                >
                  ✎
                </button>
                <button
                  onClick={() => run(() => deleteDeadline(d.id))}
                  className="btn-icon"
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
