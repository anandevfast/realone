// src/config/env.schema.ts
import * as Joi from 'joi';

export const envSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'staging', 'production')
    .default('development'),

  /* ---------- App ---------- */
  APP_PORT: Joi.number().required(),
  APP_TZ: Joi.string().required(),
  APP_SERVER_TIMEOUT: Joi.number().default(600000),

  /* ---------- Auth ---------- */
  AUTH_JWT_SECRET: Joi.string().min(16).required(),
  AUTH_JWT_EXPIRES_IN: Joi.string().required(),

  /* ---------- Mongo (critical) ---------- */
  MONGO_HOST: Joi.string().required(),
  MONGO_PORT: Joi.number().default(27017),
  MONGO_DB: Joi.string().required(),
  MONGO_USER: Joi.string().allow('').optional(),
  MONGO_PASSWORD: Joi.string().allow('').optional(),
  MONGO_CONNECT_DELAY: Joi.number().default(0),

  /* ---------- MySQL (prepared) ---------- */
  MYSQL_HOST: Joi.string().required(),
  MYSQL_PORT: Joi.number().default(3306),
  MYSQL_DB: Joi.string().required(),
  MYSQL_USER: Joi.string().required(),
  MYSQL_PASSWORD: Joi.string().required(),
});
