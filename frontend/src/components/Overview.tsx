import { useEffect, useState } from 'react'
import { fetchSessions } from '../api/client'
import type { Session, Subject } from '../types'

interface Props {
  subjects: Subject[]
  refreshKey: number
}

// Текущая неделя: с понедельника по воскресенье (включительно), в местном времени.
function weekRange(): { start: string; end: string } {
  const d = new Date()
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  const start = d.toLocaleDateString('sv-SE')
  d.setDate(d.getDate() + 6)
  return { start, end: d.toLocaleDateString('sv-SE') }
}

function Overview({ subjects, refreshKey }: Props) {
  const [sessions, setSessions] = useState<Session[]>([])

  useEffect(() => {
    fetchSessions().then(setSessions).catch(console.error)
  }, [refreshKey])

  const { start, end } = weekRange()
  const thisWeek = sessions.filter((s) => s.date >= start && s.date <= end)
  const totalMinutes = thisWeek.reduce((sum, s) => sum + s.duration_minutes, 0)
  const totalTarget = subjects.reduce((sum, s) => sum + s.target_hours_per_week, 0)

  return (
    <section className="card">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Эта неделя</h2>
        <span className="text-sm text-slate-400">
          {(totalMinutes / 60).toFixed(1)} ч{totalTarget > 0 && ` из ${totalTarget} ч`}
        </span>
      </div>
      {subjects.length === 0 ? (
        <p className="empty">Добавьте первый предмет, чтобы увидеть прогресс</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {subjects.map((subject) => {
            const minutes = thisWeek
              .filter((s) => s.subject_id === subject.id)
              .reduce((sum, s) => sum + s.duration_minutes, 0)
            const target = subject.target_hours_per_week * 60
            const pct = target > 0 ? Math.min(100, Math.round((minutes / target) * 100)) : 0
            return (
              <li key={subject.id}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: subject.color }} />
                    {subject.name}
                  </span>
                  <span className="text-slate-400">
                    {(minutes / 60).toFixed(1)}
                    {target > 0 && ` / ${subject.target_hours_per_week}`} ч
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${target > 0 ? pct : 0}%`, background: subject.color }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export default Overview
