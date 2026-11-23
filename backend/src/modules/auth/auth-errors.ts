import { UnauthorizedException } from '@nestjs/common';

export const INVALID_CREDENTIALS_MESSAGE = 'Email o contraseña incorrectos';
export const SESSION_REQUIRED_MESSAGE = 'Sesión requerida';

export const invalidCredentials = () => new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
export const sessionRequired = () => new UnauthorizedException(SESSION_REQUIRED_MESSAGE);
