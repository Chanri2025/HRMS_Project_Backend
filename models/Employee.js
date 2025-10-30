// models/Employee.js
module.exports = (sequelize, DataTypes) => {
    const Employee = sequelize.define('Employee', {
        user_id: {type: DataTypes.BIGINT, primaryKey: true},
        employee_id: {type: DataTypes.STRING(64), allowNull: false, unique: true},
        phone: {type: DataTypes.STRING(32), allowNull: false},
        address: {type: DataTypes.STRING(255), allowNull: false},
        fathers_name: {type: DataTypes.STRING(120), allowNull: false},
        aadhar_no: {type: DataTypes.STRING(32), allowNull: false, unique: true},
        date_of_birth: {type: DataTypes.DATEONLY, allowNull: false},
        work_position: {type: DataTypes.STRING(80), allowNull: false},
        created_at: {type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.fn('SYSUTCDATETIME')},
        updated_at: {type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.fn('SYSUTCDATETIME')},
    }, {
        tableName: 'employees',
        timestamps: false, // handled by triggers/defaults
        underscored: true
    });

    Employee.associate = (models) => {
        Employee.belongsTo(models.AuthUser, {foreignKey: 'user_id', as: 'User'});
    };

    return Employee;
};
