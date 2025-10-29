const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * AuthUser represents the ``users`` table used by the authentication
 * subsystem.  It mirrors the SQLAlchemy model defined in
 * ``models/auth_models.py``.  A user can have multiple roles via
 * the UserRole join table and possesses a collection of refresh
 * tokens that enable long‑lived sessions.
 */
const AuthUser = sequelize.define('AuthUser', {
  user_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
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
  full_name: {
    type: DataTypes.STRING(120),
    allowNull: false
  },
  profile_photo: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  email_verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  last_active: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'users',
  timestamps: false
});

module.exports = AuthUser;