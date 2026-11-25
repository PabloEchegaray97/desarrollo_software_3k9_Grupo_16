/**
 * Helpers del recorrido extremo a extremo de C-08.
 * Usa los harness reales de C-04/C-06 contra MariaDB; no crea dobles de persistencia.
 */
import request from 'supertest';
import type { LifecycleApiContext } from '../../src/modules/appointments/lifecycle/testing/appointment-lifecycle-api.support-spec.js';
import { FICTIONAL_ACCOUNT } from '../../src/modules/auth/testing/session-test.support-spec.js';

export const MVP_DATE = '2027-03-10';

export interface LoginResult {
  cookie: string;
}

export async function loginForMvp(context: LifecycleApiContext): Promise<LoginResult> {
  const response = await request(context.app.getHttpServer())
    .post('/api/auth/login')
    .send({ email: FICTIONAL_ACCOUNT.email, contrasena: FICTIONAL_ACCOUNT.password })
    .expect(200);
  const cookies = response.headers['set-cookie'] as string[] | string | undefined;
  if (cookies === undefined) throw new Error('Login did not set a session cookie');
  const cookie = Array.isArray(cookies) ? cookies[0] : cookies;
  return { cookie: cookie.split(';', 1)[0] };
}

export function authenticated(context: LifecycleApiContext, cookie: string) {
  const server = context.app.getHttpServer();
  return {
    get: (path: string) => request(server).get(`/api${path}`).set('Cookie', cookie),
    post: (path: string, body: object) => request(server).post(`/api${path}`).set('Cookie', cookie).send(body),
    put: (path: string, body: object) => request(server).put(`/api${path}`).set('Cookie', cookie).send(body),
    patch: (path: string, body: object) => request(server).patch(`/api${path}`).set('Cookie', cookie).send(body),
  };
}
