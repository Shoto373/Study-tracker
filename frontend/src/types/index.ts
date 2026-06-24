export interface Subject {
  id: number
  name: string
  color: string
  target_hours_per_week: number
}

export interface Session {
  id: number
  subject_id: number
  date: string
  duration_minutes: number
  session_type: string
  note: string | null
}

export interface Deadline {
  id: number
  subject_id: number
  title: string
  due_date: string
  is_done: boolean
}