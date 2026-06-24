import { useState } from 'react'
import './App.css'
import SubjectList from './components/SubjectList'

function App() {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
      <h1 className="text-4xl font-bold text-blue-400">Study Tracker</h1>
      <SubjectList />
    </div>
  )
}

export default App
