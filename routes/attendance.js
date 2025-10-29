const express = require('express');
const router = express.Router();

const { AttendanceLog } = require('../models');

/**
 * Attendance API routes.  These endpoints allow clients to create,
 * list, update and delete attendance logs.  The logic follows
 * closely the original FastAPI implementation but uses Sequelize
 * instead of SQLAlchemy.
 */

// Create a single attendance log entry
router.post('/', async (req, res) => {
  const { employee_id, date, in_time, out_time } = req.body || {};
  if (!employee_id || !date) {
    return res.status(400).json({ detail: 'employee_id and date are required' });
  }
  try {
    const log = await AttendanceLog.create({ employee_id, date, in_time, out_time });
    return res.status(201).json(log);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ detail: 'Error creating log', error: err.message });
  }
});

// Insert multiple attendance logs
router.post('/mass-entry', async (req, res) => {
  const payload = req.body;
  if (!Array.isArray(payload) || payload.length === 0) {
    return res.status(400).json({ detail: 'Request must be a non-empty list of attendance logs' });
  }
  const success = [];
  const failed = [];
  for (const record of payload) {
    const { employee_id, date, in_time, out_time } = record;
    if (!employee_id || !date) {
      failed.push({ record, error: 'employee_id and date are required' });
      continue;
    }
    try {
      const log = await AttendanceLog.create({ employee_id, date, in_time, out_time });
      success.push(log);
    } catch (err) {
      failed.push({ record, error: err.message });
    }
  }
  return res.json({
    message: 'Mass entry completed',
    successful_entries: success.length,
    failed_entries: failed
  });
});

// Return all attendance logs
router.get('/all', async (req, res) => {
  try {
    const logs = await AttendanceLog.findAll();
    return res.json(logs);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ detail: 'Error fetching logs', error: err.message });
  }
});

// Get a single log by id
router.get('/:log_id', async (req, res) => {
  const id = req.params.log_id;
  try {
    const log = await AttendanceLog.findByPk(id);
    if (!log) {
      return res.status(404).json({ detail: 'Attendance log not found' });
    }
    return res.json(log);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ detail: 'Error fetching log', error: err.message });
  }
});

// Update an existing attendance log
router.put('/:log_id', async (req, res) => {
  const id = req.params.log_id;
  const { employee_id, date, in_time, out_time } = req.body || {};
  try {
    const log = await AttendanceLog.findByPk(id);
    if (!log) {
      return res.status(404).json({ detail: 'Attendance log not found' });
    }
    if (employee_id !== undefined) log.employee_id = employee_id;
    if (date !== undefined) log.date = date;
    if (in_time !== undefined) log.in_time = in_time;
    if (out_time !== undefined) log.out_time = out_time;
    await log.save();
    return res.json({ message: 'Attendance log updated successfully.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ detail: 'Error updating log', error: err.message });
  }
});

// Delete an attendance log by id
router.delete('/delete/:log_id', async (req, res) => {
  const id = req.params.log_id;
  try {
    const log = await AttendanceLog.findByPk(id);
    if (!log) {
      return res.status(404).json({ detail: 'Attendance log not found' });
    }
    await log.destroy();
    return res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ detail: 'Error deleting log', error: err.message });
  }
});

// Return all logs for a given employee id
router.get('/employee/:employee_id', async (req, res) => {
  const empId = req.params.employee_id;
  try {
    const logs = await AttendanceLog.findAll({ where: { employee_id: empId } });
    return res.json(logs);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ detail: 'Error fetching logs', error: err.message });
  }
});

module.exports = router;