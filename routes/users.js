const express = require('express');
const router = express.Router();

const { HrmUser, Employee } = require('../models');
const { hashPassword } = require('../utils/security');

/**
 * HRM User and Employee routes.  These endpoints provide CRUD
 * functionality for users and their linked employees.  The logic is
 * adapted from the FastAPI version and uses Sequelize for
 * persistence.
 */

// Create a new user along with its associated employee
router.post('/', async (req, res) => {
  const data = req.body || {};
  const required = ['employee_id', 'full_name', 'email', 'password', 'role', 'phone', 'work_position', 'date_of_birth', 'address', 'fathers_name', 'aadhar_no'];
  for (const key of required) {
    if (data[key] === undefined || data[key] === null || data[key] === '') {
      return res.status(400).json({ detail: `${key} is required` });
    }
  }
  try {
    // Check uniqueness
    const existingEmpId = await HrmUser.findOne({ where: { employee_id: data.employee_id } });
    if (existingEmpId) {
      return res.status(400).json({ detail: 'Employee ID already exists' });
    }
    const existingEmail = await HrmUser.findOne({ where: { email: data.email } });
    if (existingEmail) {
      return res.status(400).json({ detail: 'Email already exists' });
    }
    const existingAadhar = await Employee.findOne({ where: { aadhar_no: data.aadhar_no } });
    if (existingAadhar) {
      return res.status(400).json({ detail: 'Aadhar already exists' });
    }
    const pwHash = await hashPassword(data.password);
    const user = await HrmUser.create({
      employee_id: data.employee_id,
      full_name: data.full_name,
      email: data.email,
      password_hash: pwHash,
      role: data.role
    });
    // create employee record
    const employee = await Employee.create({
      id: user.id,
      phone: data.phone,
      work_position: data.work_position,
      date_of_birth: data.date_of_birth,
      profile_photo: data.profile_photo || null,
      address: data.address,
      fathers_name: data.fathers_name,
      aadhar_no: data.aadhar_no
    });
    return res.status(201).json({
      id: user.id,
      employee_id: user.employee_id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      phone: employee.phone,
      work_position: employee.work_position,
      date_of_birth: employee.date_of_birth,
      address: employee.address,
      fathers_name: employee.fathers_name,
      aadhar_no: employee.aadhar_no,
      profile_photo: employee.profile_photo
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ detail: 'Error creating user', error: err.message });
  }
});

// List all users and their employee details
router.get('/', async (req, res) => {
  try {
    const users = await HrmUser.findAll({
      include: [{ model: Employee, as: 'employee' }],
      order: [['id', 'ASC']]
    });
    const out = users.map(u => {
      const e = u.employee || {};
      return {
        id: u.id,
        employee_id: u.employee_id,
        full_name: u.full_name,
        email: u.email,
        role: u.role,
        phone: e.phone || null,
        work_position: e.work_position || null,
        date_of_birth: e.date_of_birth || null,
        address: e.address || null,
        fathers_name: e.fathers_name || null,
        aadhar_no: e.aadhar_no || null,
        profile_photo: e.profile_photo || null
      };
    });
    return res.json(out);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ detail: 'Error listing users', error: err.message });
  }
});

// Fetch a single user by numeric id
router.get('/:user_id', async (req, res) => {
  const id = req.params.user_id;
  try {
    const u = await HrmUser.findByPk(id, { include: [{ model: Employee, as: 'employee' }] });
    if (!u) {
      return res.status(404).json({ detail: 'User not found' });
    }
    const e = u.employee || {};
    return res.json({
      id: u.id,
      employee_id: u.employee_id,
      full_name: u.full_name,
      email: u.email,
      role: u.role,
      phone: e.phone || null,
      work_position: e.work_position || null,
      date_of_birth: e.date_of_birth || null,
      address: e.address || null,
      fathers_name: e.fathers_name || null,
      aadhar_no: e.aadhar_no || null,
      profile_photo: e.profile_photo || null
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ detail: 'Error fetching user', error: err.message });
  }
});

// Update a user and their linked employee
router.put('/:user_id', async (req, res) => {
  const id = req.params.user_id;
  const data = req.body || {};
  try {
    const u = await HrmUser.findByPk(id, { include: [{ model: Employee, as: 'employee' }] });
    if (!u) {
      return res.status(404).json({ detail: 'User not found' });
    }
    // Update user fields
    if (data.full_name !== undefined) u.full_name = data.full_name;
    if (data.email !== undefined) {
      const existing = await HrmUser.findOne({ where: { email: data.email } });
      if (existing && existing.id !== Number(id)) {
        return res.status(400).json({ detail: 'Email already exists' });
      }
      u.email = data.email;
    }
    if (data.role !== undefined) u.role = data.role;
    if (data.password !== undefined) {
      u.password_hash = await hashPassword(data.password);
    }
    // Update employee fields
    let e = u.employee;
    if (!e) {
      // Create a new employee if none exists
      e = await Employee.create({ id: u.id });
    }
    if (data.date_of_birth !== undefined) e.date_of_birth = data.date_of_birth;
    if (data.phone !== undefined) e.phone = data.phone;
    if (data.work_position !== undefined) e.work_position = data.work_position;
    if (data.address !== undefined) e.address = data.address;
    if (data.fathers_name !== undefined) e.fathers_name = data.fathers_name;
    if (data.aadhar_no !== undefined) {
      const existingAadhar = await Employee.findOne({ where: { aadhar_no: data.aadhar_no } });
      if (existingAadhar && existingAadhar.id !== u.id) {
        return res.status(400).json({ detail: 'Aadhar already exists' });
      }
      e.aadhar_no = data.aadhar_no;
    }
    if (data.profile_photo !== undefined) e.profile_photo = data.profile_photo;
    await u.save();
    await e.save();
    return res.json({ message: 'User and Employee updated successfully' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ detail: 'Error updating user', error: err.message });
  }
});

// Delete a user and linked employee
router.delete('/:user_id', async (req, res) => {
  const id = req.params.user_id;
  try {
    const u = await HrmUser.findByPk(id);
    if (!u) {
      return res.status(404).json({ detail: 'User not found' });
    }
    await u.destroy();
    return res.json({ message: 'User (and linked Employee) deleted' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ detail: 'Error deleting user', error: err.message });
  }
});

// Change a user's password
router.put('/:user_id/password', async (req, res) => {
  const id = req.params.user_id;
  const { new_password } = req.body || {};
  if (!new_password) {
    return res.status(400).json({ detail: 'new_password is required' });
  }
  try {
    const user = await HrmUser.findByPk(id);
    if (!user) {
      return res.status(404).json({ detail: 'User not found' });
    }
    user.password_hash = await hashPassword(new_password);
    await user.save();
    return res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ detail: 'Error updating password', error: err.message });
  }
});

// Fetch a user and employee by the business key employee_id
router.get('/profile/:employee_id', async (req, res) => {
  const empId = req.params.employee_id;
  try {
    const u = await HrmUser.findOne({ where: { employee_id: empId }, include: [{ model: Employee, as: 'employee' }] });
    if (!u) {
      return res.status(404).json({ detail: 'User not found' });
    }
    const e = u.employee || {};
    return res.json({
      id: u.id,
      employee_id: u.employee_id,
      full_name: u.full_name,
      email: u.email,
      role: u.role,
      phone: e.phone || null,
      work_position: e.work_position || null,
      date_of_birth: e.date_of_birth || null,
      address: e.address || null,
      fathers_name: e.fathers_name || null,
      aadhar_no: e.aadhar_no || null,
      profile_photo: e.profile_photo || null
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ detail: 'Error fetching user', error: err.message });
  }
});

module.exports = router;