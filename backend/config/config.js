
module.exports = {
  development: {
    username: "root",
    password: "",
    database: "artepovera",
    host: "127.0.0.1",
    dialect: "mysql",
    port: 3306
  },
  test: {
    username: "root",
    password: "",
    database: "artepovera_test",
    host: "127.0.0.1",
    dialect: "mysql",
    port: 3306
  },
  production: {
    username: process.env.DB_USERNAME, // Set these in your deployment environment
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    dialect: "mysql",
    port: process.env.DB_PORT || 3306
  }
};
