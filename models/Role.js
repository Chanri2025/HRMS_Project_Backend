const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Role model maps to the ``roles`` table.  Each role has a unique
 * name and participates in a many‑to‑many relationship with
 * AuthUser through the UserRole join table.
 */
const Role = sequelize.define('Role', {
  role_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(50),
    unique: true,
    allowNull: false
  }
}, {
  tableName: 'roles',
  timestamps: false
});

module.exports = Role;