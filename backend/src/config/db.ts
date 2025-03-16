import { Sequelize } from 'sequelize';

// We pull in environment variables for production, but default to local values for development.
const sequelize = new Sequelize(
  process.env.DB_NAME || 'artepovera',        // DB name
  process.env.DB_USERNAME || 'root',          // DB user
  process.env.DB_PASSWORD || '',              // DB password
  {
    host: process.env.DB_HOST || '127.0.0.1', // DB host
    dialect: 'mysql',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,  // Keep it on 3306
    logging: console.log, // Enable SQL query logging
  }
);

export default sequelize;
