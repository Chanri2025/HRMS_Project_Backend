const Sequelize = require("sequelize");
const { sequelize } = require("../config/database");

const AuthUser = require("./AuthUser");
const Role = require("./Role");
const UserRole = require("./UserRole");
const RefreshToken = require("./RefreshToken");

let Employee = require("./Employee");
// If Employee is a factory, call it; otherwise use it directly.
if (typeof Employee === "function") {
  Employee = Employee(sequelize, Sequelize.DataTypes);
}

const db = {
  sequelize,
  Sequelize,
  AuthUser,
  Role,
  UserRole,
  RefreshToken,
  Employee,
};

/* ------------ Associations ------------ */

// AuthUser <-> Role (many-to-many)
AuthUser.belongsToMany(Role, {
  through: UserRole,
  foreignKey: "user_id",
  otherKey: "role_id",
});
Role.belongsToMany(AuthUser, {
  through: UserRole,
  foreignKey: "role_id",
  otherKey: "user_id",
});

// AuthUser -> RefreshToken (1-to-many)
AuthUser.hasMany(RefreshToken, { foreignKey: "user_id", onDelete: "CASCADE" });
RefreshToken.belongsTo(AuthUser, { foreignKey: "user_id" });

// AuthUser <-> Employee (1-to-1)
AuthUser.hasOne(Employee, {
  foreignKey: "user_id",
  as: "Employee",
  onDelete: "CASCADE",
});
Employee.belongsTo(AuthUser, { foreignKey: "user_id", as: "User" });

module.exports = db;
