import { useState } from 'react'
import { createSubject } from '../api/client'

interface SubjectFormProps {
  onSubjectCreated: () => void
}

function SubjectForm({ onSubjectCreated }: SubjectFormProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#3B82F6')
  const [targetHours, setTargetHours] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await createSubject({
        name,
        color,
        target_hours_per_week: targetHours,
      })
      setName('')
      setColor('#3B82F6')
      setTargetHours(0)
      setError(null)
      onSubjectCreated()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-5 flex flex-wrap items-center gap-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Название предмета"
        required
        className="field min-w-48 flex-1"
      />
      <input
        type="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        title="Цвет"
        className="h-10 w-12 cursor-pointer rounded-lg border border-slate-700 bg-slate-800 p-1"
      />
      <input
        type="number"
        value={targetHours}
        onChange={(e) => setTargetHours(Number(e.target.value))}
        title="Цель, часов в неделю"
        placeholder="Ч/нед"
        min="0"
        className="field w-24"
      />
      <button type="submit" disabled={submitting} className="btn">
        {submitting ? 'Сохранение...' : 'Добавить'}
      </button>
      {error && <p className="w-full text-sm text-red-400">Ошибка: {error}</p>}
    </form>
  )
}

export default SubjectForm
