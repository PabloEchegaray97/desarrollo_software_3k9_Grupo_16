/**
 * Integración de C-04 contra MariaDB real (`TEST_DATABASE_*`); nunca SQLite ni memoria.
 * Requiere CR-C04-02 para que Jest descubra `src/**\/*.integration-spec.ts`.
 */
import request from 'supertest';
import { startIntegrationApp, stopIntegrationApp, type IntegrationContext } from '../catalogs/testing/integration-harness.support-spec.js';
import { provisionInitialAccount } from './account-provisioning.js';
import { ScryptPasswordHasher } from './scrypt-password-hasher.js';
import {
  FICTIONAL_ACCOUNT,
  TEST_AUTH_SECRET,
  createSessionCookie,
  insertTestUser,
} from './testing/session-test.support-spec.js';

type ErrorBody = { error: { code: string; message: string; requestId: string } };

const setCookies = (response: request.Response): string[] => {
  const header = response.headers['set-cookie'] as string[] | string | undefined;
  return header === undefined ? [] : Array.isArray(header) ? header : [header];
};

describe('authentication (MariaDB)', () => {
  let context: IntegrationContext | undefined;
  const server = () => context!.app.getHttpServer();

  beforeAll(async () => {
    context = await startIntegrationApp();
  });

  afterAll(async () => {
    await stopIntegrationApp(context);
  });

  beforeEach(async () => {
    await context!.dataSource.query('DELETE FROM users');
  });

  describe('provisioning', () => {
    it('creates the normalized account once and never rewrites it', async () => {
      const hasher = new ScryptPasswordHasher();
      const email = ' Odontologo.Ficticio@Example.test ';
      await expect(provisionInitialAccount(context!.dataSource, email, FICTIONAL_ACCOUNT.password, hasher)).resolves.toBe('created');
      const [first]: Array<{ email: string; password_hash: string; role: string }> = await context!.dataSource.query(
        'SELECT email, password_hash, role FROM users',
      );
      expect(first.email).toBe(FICTIONAL_ACCOUNT.email);
      expect(first.role).toBe('ODONTOLOGO');
      expect(first.password_hash).toMatch(/^scrypt\$/);
      expect(first.password_hash).not.toContain(FICTIONAL_ACCOUNT.password);

      await expect(provisionInitialAccount(context!.dataSource, email, 'otra-contrasena-ficticia', hasher)).resolves.toBe('existing');
      const rows: Array<{ password_hash: string }> = await context!.dataSource.query('SELECT password_hash FROM users');
      expect(rows).toHaveLength(1);
      expect(rows[0].password_hash).toBe(first.password_hash);
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      await insertTestUser(context!.dataSource);
    });

    it('accepts the email with any casing and sets a strict HttpOnly cookie', async () => {
      const response = await request(server())
        .post('/api/auth/login')
        .send({ email: ' ODONTOLOGO.Ficticio@example.TEST ', contrasena: FICTIONAL_ACCOUNT.password })
        .expect(200);
      expect(response.body).toEqual({ usuario: { id: expect.any(String), email: FICTIONAL_ACCOUNT.email } });
      const [cookie] = setCookies(response);
      expect(cookie).toMatch(/^session=[\w-]+\.[\w-]+\.[\w-]+;/);
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Strict');
      expect(cookie).toContain('Max-Age=28800');
      expect(cookie).toContain('Path=/');
      expect(cookie).not.toContain('Secure');
      expect(JSON.stringify(response.body)).not.toContain(FICTIONAL_ACCOUNT.password);
    });

    it('answers unknown email and wrong password identically, without cookie', async () => {
      const unknown = await request(server())
        .post('/api/auth/login')
        .send({ email: 'nadie@example.test', contrasena: FICTIONAL_ACCOUNT.password });
      const wrong = await request(server())
        .post('/api/auth/login')
        .send({ email: FICTIONAL_ACCOUNT.email, contrasena: 'otra-contrasena-ficticia' });
      for (const response of [unknown, wrong]) {
        expect(response.status).toBe(401);
        expect(setCookies(response)).toEqual([]);
      }
      const strip = (body: ErrorBody) => ({ code: body.error.code, message: body.error.message });
      expect(strip(unknown.body as ErrorBody)).toEqual(strip(wrong.body as ErrorBody));
      expect((unknown.body as ErrorBody).error.message).toBe('Email o contraseña incorrectos');
    });

    it.each([
      { contrasena: FICTIONAL_ACCOUNT.password },
      { email: FICTIONAL_ACCOUNT.email },
      { email: 'no-es-email', contrasena: FICTIONAL_ACCOUNT.password },
      { email: FICTIONAL_ACCOUNT.email, contrasena: '' },
    ])('rejects incomplete input %p with VALIDATION_ERROR', async (body) => {
      const response = await request(server()).post('/api/auth/login').send(body).expect(400);
      expect((response.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('session and protection', () => {
    it('reports the current session and rejects missing or expired tokens', async () => {
      const userId = await insertTestUser(context!.dataSource);
      const cookie = createSessionCookie(TEST_AUTH_SECRET, userId);
      await request(server())
        .get('/api/auth/sesion')
        .set('Cookie', cookie)
        .expect(200, { usuario: { id: userId, email: FICTIONAL_ACCOUNT.email } });

      await request(server()).get('/api/auth/sesion').expect(401);
      const expired = createSessionCookie(TEST_AUTH_SECRET, userId, { now: () => new Date(Date.now() - 9 * 60 * 60 * 1000) });
      await request(server()).get('/api/auth/sesion').set('Cookie', expired).expect(401);
      const foreign = createSessionCookie('another-fictional-secret-with-32-characters', userId);
      await request(server()).get('/api/auth/sesion').set('Cookie', foreign).expect(401);
    });

    it('rejects a token whose user no longer exists', async () => {
      const userId = await insertTestUser(context!.dataSource);
      const cookie = createSessionCookie(TEST_AUTH_SECRET, userId);
      await context!.dataSource.query('DELETE FROM users');
      await request(server()).get('/api/auth/sesion').set('Cookie', cookie).expect(401);
    });

    it('clears the cookie on logout', async () => {
      const response = await request(server()).post('/api/auth/logout').expect(204);
      const [cookie] = setCookies(response);
      expect(cookie).toMatch(/^session=;/);
      expect(cookie).toContain('Max-Age=0');
    });

    it('protects other modules and keeps the healthcheck public', async () => {
      const userId = await insertTestUser(context!.dataSource);
      await request(server()).get('/api/pacientes').expect(401);
      await request(server()).get('/api/pacientes').set('Cookie', createSessionCookie(TEST_AUTH_SECRET, userId)).expect(200);
      await request(server()).get('/api/health').expect(200);
    });

    it('exposes no public registration', async () => {
      await request(server()).post('/api/auth/registro').send({ email: 'nuevo@example.test' }).expect(404);
      const rows: unknown[] = await context!.dataSource.query('SELECT id FROM users');
      expect(rows).toHaveLength(0);
    });
  });
});
