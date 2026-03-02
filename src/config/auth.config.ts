import { registerAs } from '@nestjs/config';

export const authConfig = registerAs('auth', () => ({
  jwt: {
    secret: process.env.AUTH_JWT_SECRET!,
    expiresIn: process.env.AUTH_JWT_EXPIRES_IN!,
  },
}));
