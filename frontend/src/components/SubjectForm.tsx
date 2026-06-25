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
      onSubjectCreated()
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Название предмета"
        required
        className="px-3 py-2 rounded bg-slate-800 text-white border border-slate-600"
      />
      <input
        type="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        className="w-12 h-10 rounded cursor-pointer"
      />
      <input
        type="number"
        value={targetHours}
        onChange={(e) => setTargetHours(Number(e.target.value))}
        placeholder="Часов/нед"
        min="0"
        className="px-3 py-2 rounded bg-slate-800 text-white border border-slate-600 w-28"
      />
      <button
        type="submit"
        disabled={submitting}
        className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
      >
        {submitting ? 'Сохранение...' : 'Добавить'}
      </button>
    </form>
  )
}

export default SubjectForm