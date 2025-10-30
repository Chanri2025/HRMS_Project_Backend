// config/database.js
const { Sequelize } = require('sequelize');
require('dotenv').config();

const {
  DB_HOST = '183.177.126.159',     // Prefer a DNS hostname to avoid SNI warnings
  DB_PORT = '1433',
  DB_USER = 'appynittyscrum',
  DB_PASSWORD = 'appynittyscrum@987',
  DB_NAME = 'AppynittyScrumDB',
  DB_INSTANCE = '',                 // e.g. 'SQLEXPRESS' or '' for default
  DB_ENCRYPT = 'true',
  DB_TRUST_SERVER_CERT = 'true',
  DB_ENABLE_LOG = 'false'
} = process.env;

const bool = v => String(v).toLowerCase() === 'true';

const dialectOptions = {
  options: {
    encrypt: bool(DB_ENCRYPT),
    trustServerCertificate: bool(DB_TRUST_SERVER_CERT),
    enableArithAbort: true,
    ...(DB_INSTANCE ? { instanceName: DB_INSTANCE } : {}),
    // If you MUST use an IP, SNI will warn on Node 22+. Prefer a hostname (DNS).
    // serverName: DB_HOST, // uncomment if you switch to a hostname
    // requestTimeout: 300000, // optional long queries
  }
};

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  port: Number(DB_PORT),
  dialect: 'mssql',
  logging: bool(DB_ENABLE_LOG) ? console.log : false,
  pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
  dialectOptions
});

module.exports = { sequelize, Sequelize };
