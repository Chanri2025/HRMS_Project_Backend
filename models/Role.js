const {DataTypes} = require('sequelize');
const {sequelize} = require('../config/database');

const Role = sequelize.define('Role', {
    role_id: {
        type: DataTypes.INTEGER,     // removed .UNSIGNED
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
    schema: 'dbo',
    timestamps: false
});

module.exports = Role;
