const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * AttendanceLog records a single day's attendance for an employee.
 * The employee is referenced via the business key ``employee_id``
 * rather than the primary key on the HRM user table.  This
 * preserves logs when numeric ids change.  See the FastAPI model
 * ``models/attendance_log.py`` for further commentary.
 */
const AttendanceLog = sequelize.define('AttendanceLog', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  employee_id: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  date: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  in_time: {
    type: DataTypes.STRING(10),
    allowNull: true
  },
  out_time: {
    type: DataTypes.STRING(10),
    allowNull: true
  }
}, {
  tableName: 'attendance_logs',
  timestamps: false
});

module.exports = AttendanceLog;