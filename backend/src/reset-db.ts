// src/reset-db.ts

import sequelize from './config/db';
// This line is crucial as it ensures Sequelize is aware of all your models
import './models/associations'; 

const truncateAllTables = async () => {
  console.log('--- Database Truncate Script ---');
  console.warn('⚠️  WARNING: This will permanently delete all data from all tables.');

  // Get all your defined models from Sequelize
  const models = sequelize.models;

  try {
    // 1. Disable Foreign Key Checks
    // This allows us to truncate tables in any order without errors.
    console.log('Disabling foreign key checks...');
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0', { raw: true });

    // 2. Truncate every table
    console.log('Beginning truncation...');
    for (const modelName in models) {
      console.log(`  -> Truncating ${modelName}...`);
      await models[modelName].destroy({
        where: {},
        truncate: true, // This uses the TRUNCATE command
        cascade: false // Do not use cascade when truncating this way
      });
    }
    
    console.log('✅ All tables truncated successfully!');

  } catch (error) {
    console.error('❌ An error occurred while truncating tables:', error);
  } finally {
    // 3. Re-enable Foreign Key Checks
    // This is in a 'finally' block to ensure it ALWAYS runs, even if an error occurs.
    console.log('Re-enabling foreign key checks...');
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1', { raw: true });
    
    // Close the database connection
    await sequelize.close();
    console.log('Connection closed.');
  }
};

// This confirmation check remains the same
if (process.argv[2] === 'confirm') {
  truncateAllTables();
} else {
  console.log("--------------------------------------------------");
  console.log("This script will delete all data. To run it, you must provide the 'confirm' argument:");
  console.log("Example: npm run db:reset confirm");
  console.log("--------------------------------------------------");
}