const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * RefreshToken model stores digest of refresh tokens issued to
 * authenticated users.  The original FastAPI implementation
 * computes a SHA‑256 digest of a randomly generated token; the raw
 * value is sent to the client and the digest persists in the
 * database for validation.  We follow the same convention here.
 */
const RefreshToken = sequelize.define('RefreshToken', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
    references: {
      model: 'users',
      key: 'user_id'
    },
    onDelete: 'CASCADE'
  },
  token_hash: {
    type: DataTypes.STRING(64),
    unique: true,
    allowNull: false
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  revoked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  user_agent: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  ip: {
    type: DataTypes.STRING(45),
    allowNull: true
  }
}, {
  tableName: 'refresh_tokens',
  timestamps: false
});

module.exports = RefreshToken;