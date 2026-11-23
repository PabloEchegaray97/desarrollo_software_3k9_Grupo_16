import { apiRequest } from '../../shared/api/client'
import type { SessionResponse } from './types'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api'

export function login(email: string, contrasena: string): Promise<SessionResponse> {
  return apiRequest<SessionResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, contrasena }) })
}

export function fetchSession(): Promise<SessionResponse> {
  return apiRequest<SessionResponse>('/auth/sesion')
}

/** `apiRequest` siempre interpreta JSON; el logout responde 204 sin cuerpo. */
export async function logout(): Promise<void> {
  await fetch(`${apiBaseUrl}/auth/logout`, { method: 'POST', credentials: 'include' })
}
