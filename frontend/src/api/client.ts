import type { Subject, Session, Deadline } from '../types'

const API_BASE_URL = 'http://127.0.0.1:8000'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!response.ok) {
    throw new Error(`Request failed: ${init?.method ?? 'GET'} ${path} (${response.status})`)
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
