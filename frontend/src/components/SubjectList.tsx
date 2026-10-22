import { useState, useEffect } from 'react'
import { fetchSubjects, deleteSubject } from '../api/client'
import type { Subject } from '../types'

interface SubjectListProps {
  refreshKey: number
  onChanged: () => void
}

function SubjectList({ refreshKey, onChanged }: SubjectListProps) {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSubjects()
      .then((data) => {
        setSubjects(data)
        setError(null)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [refreshKey])

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
      {subjects.map((subject) => (
        <li key={subject.id} className="row">
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: subject.color }} />
          <span className="font-medium">{subject.name}</span>
          <span className="text-sm text-slate-400">{subject.target_hours_per_week} ч/нед</span>
          <button
            onClick={() => handleDelete(subject)}
            className="btn-icon ml-auto"
            aria-label="Удалить предмет"
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  )
}

export default SubjectList
