import { SetMetadata } from '@nestjs/common';

export const PUBLIC_ROUTE = 'auth:public-route';

/** Marca un handler propio de C-04 como accesible sin sesión. */
export const PublicRoute = () => SetMetadata(PUBLIC_ROUTE, true);
