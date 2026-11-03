import mysql from 'mysql2/promise';

let pool;

export function getDb() {
  if (!pool) {
    const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
    for (const key of required) {
      if (!process.env[key]) throw new Error(`Missing environment variable: ${key}`);
    }
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      charset: 'utf8mb4',
      timezone: '+07:00',
      ssl: process.env.DB_SSL === 'true' ? { minVersion: 'TLSv1.2' } : undefined
    });
  }
  return pool;
}
