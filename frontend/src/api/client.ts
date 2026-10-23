import type { Subject, Session, Deadline } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

export class ApiError extends Error {
  status: number
  detail: unknown

  constructor(message: string, status: number, detail: unknown) {
    super(message)
    this.status = status
    this.detail = detail
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new ApiError(
      `Request failed: ${init?.method ?? 'GET'} ${path} (${response.status})`,
      response.status,
      body?.detail,
    )
  }
  return response.status === 204 ? (undefined as T) : response.json()
}

export type SubjectInput = Omit<Subject, 'id'>
export type SessionInput = Omit<Session, 'id'>
export type DeadlineInput = Omit<Deadline, 'id'>

export const fetchSubjects = () => request<Subject[]>('/subjects/')
export const createSubject = (data: SubjectInput) =>
  request<Subject>('/subjects/', { method: 'POST', body: JSON.stringify(data) })
export const updateSubject = (id: number, data: SubjectInput) =>
  request<Subject>(`/subjects/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteAllSubjects = () => request<void>('/subjects/', { method: 'DELETE' })
export const deleteSubject = (id: number) =>
  request<void>(`/subjects/${id}`, { method: 'DELETE' })

export const fetchSessions = () => request<Session[]>('/sessions/')
export const createSession = (data: SessionInput) =>
  request<Session>('/sessions/', { method: 'POST', body: JSON.stringify(data) })
export const updateSession = (id: number, data: SessionInput) =>
  request<Session>(`/sessions/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteSession = (id: number) =>
  request<void>(`/sessions/${id}`, { method: 'DELETE' })

export const fetchDeadlines = () => request<Deadline[]>('/deadlines/')
export const createDeadline = (data: DeadlineInput) =>
  request<Deadline>('/deadlines/', { method: 'POST', body: JSON.stringify(data) })
export const updateDeadline = (id: number, data: DeadlineInput) =>
  request<Deadline>(`/deadlines/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteDeadline = (id: number) =>
  request<void>(`/deadlines/${id}`, { method: 'DELETE' })

export interface TimetableOption {
  id: number
  name: string
}
export interface ScheduleImportResult {
  created: Subject[]
  existing: string[]
  replaced: boolean
}
export interface PinnedGroup {
  faculty: number
  group: number
  group_name: string
}
export interface ActivityDetail {
  code: 'has_activity'
  sessions: number
  minutes: number
}

export const fetchFaculties = () => request<TimetableOption[]>('/schedule/faculties')
export const fetchGroups = (faculty: number) =>
  request<TimetableOption[]>(`/schedule/groups?faculty=${faculty}`)
export const fetchMyGroup = () => request<PinnedGroup | null>('/schedule/me')
export const importSchedule = (data: PinnedGroup & { confirm?: boolean }) =>
  request<ScheduleImportResult>('/schedule/import', {
    method: 'POST',
    body: JSON.stringify(data),
  })
