import { useState, useEffect } from 'react'
import { fetchSubjects } from '../api/client'
import type { Subject } from '../types'

function SubjectList() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSubjects()
      .then((data) => {
        setSubjects(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  if (loading) return <p className="text-slate-400">Загрузка...</p>
  if (error) return <p className="text-red-400">Ошибка: {error}</p>

  return (
    <ul className="space-y-2">
      {subjects.map((subject) => (
        <li
          key={subject.id}
          className="p-3 rounded-lg bg-slate-800 border-l-4"
          style={{ borderColor: subject.color }}
        >
          <span className="font-semibold">{subject.name}</span>
          <span className="text-slate-400 text-sm ml-2">
            {subject.target_hours_per_week} ч/нед
          </span>
        </li>
      ))}
    </ul>
  )
}

export default SubjectList