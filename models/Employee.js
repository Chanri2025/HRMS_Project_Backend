const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Employee stores personal details for a user.  It shares its
 * primary key with the ``user`` table.  Deleting a user cascades to
 * delete the associated employee record.  See
 * ``models/employee.py`` in the original project for details.
 */
const Employee = sequelize.define('Employee', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    references: {
      model: 'user',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  work_position: {
    type: DataTypes.STRING(120),
    allowNull: false
  },
  date_of_birth: {
    type: DataTypes.DATE,
    allowNull: false
  },
  profile_photo: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  address: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  fathers_name: {
    type: DataTypes.STRING(120),
    allowNull: false
  },
  aadhar_no: {
    type: DataTypes.STRING(12),
    unique: true,
    allowNull: false
  }
}, {
  tableName: 'employees',
  timestamps: false
});

module.exports = Employee;