export const SESSION_COOKIE_NAME = 'session';
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

export interface SessionCookieContract {
  readonly httpOnly: true;
  readonly sameSite: 'strict';
  readonly secureInProduction: true;
  readonly ttlSeconds: typeof SESSION_TTL_SECONDS;
}

export const SESSION_COOKIE_CONTRACT: SessionCookieContract = {
  httpOnly: true,
  sameSite: 'strict',
  secureInProduction: true,
  ttlSeconds: SESSION_TTL_SECONDS,
};
