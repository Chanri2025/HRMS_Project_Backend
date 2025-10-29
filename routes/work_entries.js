const express = require('express');
const router = express.Router();
const { Op, and, or } = require('sequelize');

const { WorkDayEntry, Project } = require('../models');

/**
 * Work day entry routes.  These endpoints provide CRUD and
 * filtering operations for work day entries.  They mirror the logic
 * of the original FastAPI implementation while using Sequelize to
 * interact with the database.
 */

// Create a new work day entry
router.post('/create', async (req, res) => {
  const payload = req.body || {};
  const { user_id, work_date, hours_elapsed, project_name, project_subpart, issues = [], is_done = false, assigned_by, assigned_to } = payload;
  if (!user_id || !hours_elapsed || !project_name || !project_subpart || !assigned_by || !assigned_to) {
    return res.status(400).json({ detail: 'user_id, hours_elapsed, project_name, project_subpart, assigned_by and assigned_to are required' });
  }
  if (hours_elapsed > 8) {
    return res.status(400).json({ detail: 'hours_elapsed cannot be more than 8' });
  }
  try {
    const date = work_date ? new Date(work_date) : new Date();
    if (work_date && isNaN(date)) {
      return res.status(400).json({ detail: 'Invalid work_date format, expected YYYY-MM-DD' });
    }
    const entry = await WorkDayEntry.create({
      user_id,
      work_date: date,
      hours_elapsed,
      project_name,
      project_subpart,
      issues,
      is_done: !!is_done,
      assigned_by,
      assigned_to
    });
    // update project hours and subparts
    const project = await Project.findOne({ where: { project_name } });
    if (project) {
      project.total_elapsed_hrs = (project.total_elapsed_hrs || 0) + hours_elapsed;
      const updatedSubparts = [];
      for (const sub of project.project_subparts) {
        if (typeof sub === 'object' && sub.project_subpart_name === project_subpart) {
          sub.hours_elapsed = (sub.hours_elapsed || 0) + hours_elapsed;
        }
        updatedSubparts.push(sub);
      }
      project.project_subparts = updatedSubparts;
      await project.save();
    }
    return res.status(201).json(entry);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ detail: 'Error creating work entry', error: err.message });
  }
});

// Return all work day entries ordered by work_date descending
router.get('/all', async (req, res) => {
  try {
    const entries = await WorkDayEntry.findAll({ order: [['work_date', 'DESC']] });
    return res.json(entries);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ detail: 'Error fetching entries', error: err.message });
  }
});

// Update a work day entry and adjust project hours accordingly
router.put('/update/:entry_id', async (req, res) => {
  const id = req.params.entry_id;
  const payload = req.body || {};
  try {
    const entry = await WorkDayEntry.findByPk(id);
    if (!entry) {
      return res.status(404).json({ detail: 'Work entry not found' });
    }
    const oldHours = entry.hours_elapsed;
    // update fields
    if (payload.hours_elapsed !== undefined) {
      if (payload.hours_elapsed > 8) {
        return res.status(400).json({ detail: 'hours_elapsed cannot be more than 8' });
      }
      entry.hours_elapsed = payload.hours_elapsed;
    }
    if (payload.project_name !== undefined) entry.project_name = payload.project_name;
    if (payload.project_subpart !== undefined) entry.project_subpart = payload.project_subpart;
    if (payload.issues !== undefined) entry.issues = payload.issues;
    if (payload.is_done !== undefined) entry.is_done = payload.is_done;
    if (payload.work_date !== undefined) {
      const dt = new Date(payload.work_date);
      if (isNaN(dt)) {
        return res.status(400).json({ detail: 'Invalid work_date format, expected YYYY-MM-DD' });
      }
      entry.work_date = dt;
    }
    await entry.save();
    // adjust project hours
    const project = await Project.findOne({ where: { project_name: entry.project_name } });
    if (project) {
      const diff = (entry.hours_elapsed || 0) - (oldHours || 0);
      project.total_elapsed_hrs = (project.total_elapsed_hrs || 0) + diff;
      const updatedSubparts = [];
      for (const sub of project.project_subparts) {
        if (typeof sub === 'object' && sub.project_subpart_name === entry.project_subpart) {
          sub.hours_elapsed = (sub.hours_elapsed || 0) + diff;
        }
        updatedSubparts.push(sub);
      }
      project.project_subparts = updatedSubparts;
      await project.save();
    }
    return res.json({ message: 'Work entry updated successfully' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ detail: 'Error updating work entry', error: err.message });
  }
});

// Filtering configuration mapping similar to Python version
const FILTERS = {
  user_id:        { col: 'user_id',       type: v => parseInt(v, 10), op: 'eq' },
  assigned_by:    { col: 'assigned_by',   type: v => parseInt(v, 10), op: 'eq' },
  assigned_to:    { col: 'assigned_to',   type: v => parseInt(v, 10), op: 'eq' },
  is_done:        { col: 'is_done',       type: v => String(v).toLowerCase() === 'true', op: 'eq' },
  project_name:   { col: 'project_name',  type: String, op: 'ilike' },
  project_subpart:{ col: 'project_subpart', type: String, op: 'ilike' },
  work_date:      { col: 'work_date',     type: v => new Date(v), op: 'eq' }
};

// Filter work day entries
router.get('/filter', async (req, res) => {
  let matchAny = req.query.match_any === 'true' || false;
  // Determine default OR logic if both user_id and assigned_to present
  const params = {
    user_id: req.query.user_id,
    assigned_by: req.query.assigned_by,
    assigned_to: req.query.assigned_to,
    is_done: req.query.is_done,
    project_name: req.query.project_name,
    project_subpart: req.query.project_subpart,
    work_date: req.query.work_date
  };
  if (!matchAny && params.user_id !== undefined && params.assigned_to !== undefined) {
    matchAny = true;
  }
  const conditions = [];
  for (const key of Object.keys(params)) {
    const raw = params[key];
    if (raw === undefined) continue;
    const cfg = FILTERS[key];
    if (!cfg) continue;
    try {
      const val = cfg.type(raw);
      if (val === undefined || (cfg.op === 'eq' && (val === null || isNaN(val) && typeof val !== 'boolean'))) {
        continue;
      }
      if (cfg.op === 'eq') {
        conditions.push({ [cfg.col]: val });
      } else if (cfg.op === 'ilike') {
        conditions.push({ [cfg.col]: { [Op.like]: `%${val}%` } });
      }
    } catch (err) {
      // Skip invalid values silently
      continue;
    }
  }
  try {
    let where = {};
    if (conditions.length) {
      if (matchAny) {
        where = { [Op.or]: conditions };
      } else {
        where = { [Op.and]: conditions };
      }
    }
    const entries = await WorkDayEntry.findAll({ where, distinct: true, order: [['work_date', 'DESC']] });
    return res.json(entries);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ detail: 'Error filtering entries', error: err.message });
  }
});

module.exports = router;