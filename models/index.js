const AuthUser = require('./AuthUser');
const Role = require('./Role');
const UserRole = require('./UserRole');
const RefreshToken = require('./RefreshToken');
const AttendanceLog = require('./AttendanceLog');
const Employee = require('./Employee');
const HrmUser = require('./HrmUser');
const Project = require('./Project');
const WorkDayEntry = require('./WorkDayEntry');

// Define relationships between models.  Sequelize automatically
// creates foreign key constraints and helper methods on the
// associated model instances.

// AuthUser <-> Role (many-to-many via UserRole)
AuthUser.belongsToMany(Role, {
  through: UserRole,
  foreignKey: 'user_id',
  otherKey: 'role_id'
});
Role.belongsToMany(AuthUser, {
  through: UserRole,
  foreignKey: 'role_id',
  otherKey: 'user_id'
});

// AuthUser -> RefreshToken (one-to-many)
AuthUser.hasMany(RefreshToken, { foreignKey: 'user_id', as: 'refreshTokens' });
RefreshToken.belongsTo(AuthUser, { foreignKey: 'user_id', as: 'user' });

// HrmUser -> Employee (one-to-one)
HrmUser.hasOne(Employee, { foreignKey: 'id', as: 'employee' });
Employee.belongsTo(HrmUser, { foreignKey: 'id', as: 'user' });

// HrmUser -> AttendanceLog (one-to-many via business key employee_id)
// Note: the AttendanceLog stores employee_id string, which refers
// to HrmUser.employee_id.  Sequelize does not automatically
// resolve this, so we do not define a formal association here.

module.exports = {
  AuthUser,
  Role,
  UserRole,
  RefreshToken,
  AttendanceLog,
  Employee,
  HrmUser,
  Project,
  WorkDayEntry
};