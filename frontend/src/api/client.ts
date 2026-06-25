const API_BASE_URL = 'http://127.0.0.1:8000'

export async function fetchSubjects() {
  const response = await fetch(`${API_BASE_URL}/subjects/`)
  if (!response.ok) {
    throw new Error('Failed to fetch subjects')
  }
  return response.json()
}

export async function createSubject(data: {
  name: string
  color: string
  target_hours_per_week: number
}) {
  const response = await fetch(`${API_BASE_URL}/subjects/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    throw new Error('Failed to create subject')
  }
  return response.json()
}