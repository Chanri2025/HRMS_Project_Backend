const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

// Load environment variables from a .env file if present.  The
// application will fall back to the defaults defined in
// `.env.example` if values are not provided.  This allows the
// repository to ship sensible defaults while still supporting
// override in production deployments.
dotenv.config();

// Read connection settings from environment.  Note that all values
// are strings, so numeric conversion happens implicitly where
// necessary.  See the `.env.example` file for documentation on
// each variable.
const {
  DB_HOST = 'localhost',
  DB_PORT = '3306',
  DB_USER = 'root',
  DB_PASSWORD = '',
  DB_NAME = 'appynitty-hrms'
} = process.env;

// Initialise a Sequelize instance.  We specify the MySQL dialect
// explicitly and disable logging by default to avoid cluttering
// console output.  Connection pooling parameters mirror those used
// in the original FastAPI stack.
const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: 'mysql',
  logging: false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

module.exports = { sequelize };