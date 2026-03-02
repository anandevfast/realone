import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => ({
  mongo: {
    host: process.env.MONGO_HOST,
    port: process.env.MONGO_PORT,
    db: process.env.MONGO_DB,
    user: process.env.MONGO_USER,
    password: process.env.MONGO_PASSWORD,
    connectDelay: Number(process.env.MONGO_CONNECT_DELAY ?? 5000),
  },
  mysql: {
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT ?? 3306),
    database: process.env.MYSQL_DB,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
  },
}));
