import { Sequelize } from 'sequelize';

let sequelize: Sequelize;

// 1) If `DATABASE_URL` exists, we use that (Railway or any other host).
if (process.env.DATABASE_URL) {
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'mysql',
    logging: console.log,
  });
} else {
  // 2) Otherwise, fall back to local environment vars (dev).
  sequelize = new Sequelize(
    process.env.DB_NAME || 'artepovera',
    process.env.DB_USERNAME || 'root',
    process.env.DB_PASSWORD || '',
    {
      host: process.env.DB_HOST || '127.0.0.1',
      dialect: 'mysql',
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
      logging: console.log,
    }
  );
}

export default sequelize;
