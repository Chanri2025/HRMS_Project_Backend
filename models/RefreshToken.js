const {DataTypes} = require('sequelize');
const {sequelize} = require('../config/database');
const AuthUser = require('./AuthUser');

const RefreshToken = sequelize.define('RefreshToken', {
    id: {
        type: DataTypes.BIGINT,          // removed .UNSIGNED
        autoIncrement: true,
        primaryKey: true
    },
    user_id: {
        type: DataTypes.BIGINT,          // removed .UNSIGNED
        allowNull: false,
        references: {
            model: AuthUser,
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
        type: DataTypes.BOOLEAN,         // BIT on MSSQL
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
    schema: 'dbo',
    timestamps: false
});

module.exports = RefreshToken;
