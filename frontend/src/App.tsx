import { useState, useEffect } from 'react'
import SubjectList from './components/SubjectList'
import SubjectForm from './components/SubjectForm'
import SessionPanel from './components/SessionPanel'
import DeadlinePanel from './components/DeadlinePanel'
import Timer from './components/Timer'
import Overview from './components/Overview'
import GroupBar from './components/GroupBar'
import Logo from './components/Logo'
import { fetchSubjects } from './api/client'
import type { Subject } from './types'

const TABS = [
  { id: 'subjects', label: 'Предметы' },
  { id: 'sessions', label: 'Сессии' },
  { id: 'deadlines', label: 'Дедлайны' },
  { id: 'timer', label: 'Таймер' },
] as const

type TabId = (typeof TABS)[number]['id']

function App() {
  const [refreshKey, setRefreshKey] = useState(0)
  // Bumped to remount GroupBar so it forgets the group after all subjects are deleted.
  const [groupKey, setGroupKey] = useState(0)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [tab, setTab] = useState<TabId>('subjects')
  const refresh = () => setRefreshKey((k) => k + 1)

  useEffect(() => {
    fetchSubjects().then(setSubjects).catch(console.error)
  }, [refreshKey])

  return (
    <div className="mx-auto min-h-screen max-w-3xl space-y-6 px-4 py-10">
      <header className="flex items-center gap-4">
        <Logo className="h-12 w-12 shrink-0 drop-shadow-lg" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Study <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Tracker</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">Учёба, сессии и дедлайны в одном месте</p>
        </div>
      </header>

      <GroupBar key={groupKey} onImported={refresh} />

      <Overview subjects={subjects} refreshKey={refreshKey} />

      <nav className="flex gap-1 rounded-xl border border-slate-800 bg-slate-900/70 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 cursor-pointer rounded-lg py-2 text-sm font-medium transition ${
              tab === t.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="card">
        {tab === 'subjects' && (
          <>
            <SubjectForm onSubjectCreated={refresh} />
            <SubjectList
              refreshKey={refreshKey}
              onChanged={refresh}
              onCleared={() => {
                refresh()
                setGroupKey((k) => k + 1)
              }}
            />
          </>
        )}
        {tab === 'sessions' && (
          <SessionPanel subjects={subjects} refreshKey={refreshKey} onChanged={refresh} />
        )}
        {tab === 'deadlines' && <DeadlinePanel subjects={subjects} refreshKey={refreshKey} />}
        {tab === 'timer' && <Timer subjects={subjects} onSaved={refresh} />}
      </main>
    </div>
  )
}

export default App
