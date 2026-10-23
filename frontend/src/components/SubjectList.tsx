import { useState, useEffect } from 'react'
import { fetchSubjects, updateSubject, deleteSubject } from '../api/client'
import type { Subject } from '../types'

interface SubjectListProps {
  refreshKey: number
  onChanged: () => void
}

function SubjectList({ refreshKey, onChanged }: SubjectListProps) {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState('#3b82f6')
  const [target, setTarget] = useState(0)
  const [editError, setEditError] = useState<string | null>(null)

  useEffect(() => {
    fetchSubjects()
      .then((data) => {
        setSubjects(data)
        setError(null)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [refreshKey])

  function startEdit(subject: Subject) {
    setEditingId(subject.id)
    setName(subject.name)
    setColor(subject.color)
    setTarget(subject.target_hours_per_week)
    setEditError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditError(null)
  }

  async function saveEdit() {
    if (editingId === null) return
    try {
      await updateSubject(editingId, { name, color, target_hours_per_week: target })
      setEditingId(null)
      setEditError(null)
      onChanged()
    } catch (err) {
      setEditError((err as Error).message)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveEdit()
    } else if (e.key === 'Escape') {
      cancelEdit()
    }
  }

  async function handleDelete(subject: Subject) {
    if (!confirm(`Удалить «${subject.name}» вместе с сессиями и дедлайнами?`)) return
    try {
      await deleteSubject(subject.id)
      onChanged()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  if (loading) return <p className="empty">Загрузка...</p>
  if (error) return <p className="text-sm text-red-400">Ошибка: {error}</p>
  if (subjects.length === 0) return <p className="empty">Предметов пока нет</p>

  return (
    <ul className="space-y-2">
      {subjects.map((subject) =>
        editingId === subject.id ? (
          <li key={subject.id} className="row flex-wrap" onKeyDown={handleKeyDown}>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-8 w-8 shrink-0 cursor-pointer"
              aria-label="Цвет"
            />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="field min-w-32 flex-1"
              aria-label="Название"
            />
            <input
              type="number"
              min="0"
              step="any"
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
              className="field w-24"
              title="Часов в неделю"
            />
            <button onClick={saveEdit} className="btn">Сохранить</button>
            <button onClick={cancelEdit} className="btn-icon" aria-label="Отмена">✕</button>
            {editError && <p className="w-full text-sm text-red-400">Ошибка: {editError}</p>}
          </li>
        ) : (
          <li key={subject.id} className="row">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: subject.color }} />
            <span className="font-medium">{subject.name}</span>
            <span className="text-sm text-slate-400">{subject.target_hours_per_week} ч/нед</span>
            <button
              onClick={() => startEdit(subject)}
              className="btn-icon ml-auto"
              aria-label="Редактировать предмет"
            >
              ✎
            </button>
            <button
              onClick={() => handleDelete(subject)}
              className="btn-icon"
              aria-label="Удалить предмет"
            >
              ✕
            </button>
          </li>
        ),
      )}
    </ul>
  )
}

export default SubjectList
