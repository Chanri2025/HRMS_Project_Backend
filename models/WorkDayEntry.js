const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * WorkDayEntry corresponds to the ``work_day_entry`` table.  Each
 * record captures the work performed on a given day, including
 * hours, project information, and who assigned the task.  This
 * schema is faithful to the original SQLAlchemy model.
 */
const WorkDayEntry = sequelize.define('WorkDayEntry', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false
  },
  work_date: {
    type: DataTypes.DATEONLY,
    defaultValue: DataTypes.NOW
  },
  hours_elapsed: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  project_name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  project_subpart: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  issues: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  is_done: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  assigned_by: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false
  },
  assigned_to: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'work_day_entry',
  timestamps: false
});

module.exports = WorkDayEntry;