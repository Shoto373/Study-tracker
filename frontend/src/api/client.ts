const API_BASE_URL = 'http://127.0.0.1:8000'

export async function fetchSubjects() {
  const response = await fetch(`${API_BASE_URL}/subjects/`)
  if (!response.ok) {
    throw new Error('Failed to fetch subjects')
  }
  return response.json()
}