const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * HrmUser corresponds to the ``user`` table (note singular) used
 * elsewhere in the HRMS application.  It stores a separate set
 * of user credentials and links to an Employee via a one‑to‑one
 * association.  This model is distinct from ``AuthUser`` and is
 * named ``HrmUser`` to avoid confusion in the Node code.
 */
const HrmUser = sequelize.define('HrmUser', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  employee_id: {
    type: DataTypes.STRING(50),
    unique: true,
    allowNull: false
  },
  full_name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(255),
    unique: true,
    allowNull: false
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  role: {
    type: DataTypes.STRING(50),
    defaultValue: 'Employee'
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'user',
  timestamps: false
});

module.exports = HrmUser;