const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * UserRole implements the many‑to‑many join between AuthUser and
 * Role.  Its composite primary key comprises the user_id and
 * role_id columns.  Cascading deletes ensure that removing a user
 * or role tears down the association automatically.
 */
const UserRole = sequelize.define('UserRole', {
  user_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    references: {
      model: 'users',
      key: 'user_id'
    },
    onDelete: 'CASCADE'
  },
  role_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    references: {
      model: 'roles',
      key: 'role_id'
    },
    onDelete: 'CASCADE'
  }
}, {
  tableName: 'user_roles',
  timestamps: false
});

module.exports = UserRole;