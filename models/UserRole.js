const {DataTypes} = require('sequelize');
const {sequelize} = require('../config/database');
const AuthUser = require('./AuthUser');
const Role = require('./Role');

const UserRole = sequelize.define('UserRole', {
    user_id: {
        type: DataTypes.BIGINT,          // removed .UNSIGNED
        primaryKey: true,
        allowNull: false,
        references: {
            model: AuthUser,               // model reference (not string)
            key: 'user_id'
        },
        onDelete: 'CASCADE'
    },
    role_id: {
        type: DataTypes.INTEGER,         // removed .UNSIGNED
        primaryKey: true,
        allowNull: false,
        references: {
            model: Role,
            key: 'role_id'
        },
        onDelete: 'CASCADE'
    }
}, {
    tableName: 'user_roles',
    schema: 'dbo',
    timestamps: false
});

module.exports = UserRole;
