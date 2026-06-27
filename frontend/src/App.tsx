import { useState } from 'react'
import SubjectList from './components/SubjectList'
import SubjectForm from './components/SubjectForm'

function App() {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <h1 className="text-3xl font-bold text-blue-400 mb-6">Study Tracker</h1>
      <SubjectForm onSubjectCreated={() => setRefreshKey((k) => k + 1)} />
      <SubjectList key={refreshKey} />
    </div>
  )
}
// sd
export default App