const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Project model matches the ``project`` table.  Projects contain
 * subparts encoded as JSON arrays as well as aggregate hours
 * tracking fields.  See ``models/project.py`` for the original
 * definition.
 */
const Project = sequelize.define('Project', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  project_name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  project_subparts: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: []
  },
  total_estimate_hrs: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  total_elapsed_hrs: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  assigned_ids: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: []
  },
  is_completed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  created_by: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false
  },
  client_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
    defaultValue: 1
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
  tableName: 'project',
  timestamps: false
});

module.exports = Project;