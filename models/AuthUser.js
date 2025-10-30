const {DataTypes} = require('sequelize');
const {sequelize} = require('../config/database');

const AuthUser = sequelize.define('AuthUser', {
    user_id: {
        type: DataTypes.BIGINT,          // removed .UNSIGNED
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
        // NVARCHAR(MAX) on MSSQL (good for base64 strings). If you store raw bytes, use BLOB/VARBINARY via DataTypes.BLOB.
        type: DataTypes.TEXT,
        allowNull: true
    },
    is_active: {
        type: DataTypes.BOOLEAN,          // maps to BIT
        defaultValue: true
    },
    email_verified: {
        type: DataTypes.BOOLEAN,          // maps to BIT
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
    schema: 'dbo',                      // <- optional but recommended on MSSQL
    timestamps: false,
    hooks: {
        // keep updated_at fresh (MSSQL has no ON UPDATE CURRENT_TIMESTAMP)
        beforeUpdate: (instance) => {
            instance.set('updated_at', new Date());
        }
    }
});

module.exports = AuthUser;
