const express = require('express');
const router = express.Router();
const { Op, fn, col, literal } = require('sequelize');

const { Project } = require('../models');

/**
 * Project routes.  These endpoints allow clients to create, retrieve,
 * update, delete and filter projects.  The logic preserves the
 * semantics of the original FastAPI implementation but adapts it
 * to Sequelize and Express.
 */

// Create a new project
router.post('/create', async (req, res) => {
  const payload = req.body || {};
  try {
    const newProject = await Project.create({
      project_name: (payload.project_name || '').trim(),
      project_subparts: payload.project_subparts || [],
      total_estimate_hrs: payload.total_estimate_hrs || 0,
      total_elapsed_hrs: payload.total_elapsed_hrs || 0,
      assigned_ids: payload.assigned_ids || [],
      is_completed: payload.is_completed || false,
      created_by: payload.created_by,
      client_id: payload.client_id || 1
    });
    return res.status(201).json(newProject);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ detail: 'Error creating project', error: err.message });
  }
});

// Return all projects
router.get('/all', async (req, res) => {
  try {
    const projects = await Project.findAll();
    return res.json(projects);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ detail: 'Error fetching projects', error: err.message });
  }
});

// Return a single project by id
router.get('/:project_id', async (req, res) => {
  const id = req.params.project_id;
  try {
    const project = await Project.findByPk(id);
    if (!project) {
      return res.status(404).json({ detail: 'Project not found' });
    }
    return res.json(project);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ detail: 'Error fetching project', error: err.message });
  }
});

// Update an existing project
router.put('/update/:project_id', async (req, res) => {
  const id = req.params.project_id;
  const payload = req.body || {};
  try {
    const project = await Project.findByPk(id);
    if (!project) {
      return res.status(404).json({ detail: 'Project not found' });
    }
    if (payload.project_name !== undefined) project.project_name = String(payload.project_name).trim();
    if (payload.project_subparts !== undefined) {
      if (!Array.isArray(payload.project_subparts)) {
        return res.status(400).json({ detail: 'project_subparts must be an array' });
      }
      project.project_subparts = payload.project_subparts;
    }
    if (payload.total_estimate_hrs !== undefined) project.total_estimate_hrs = payload.total_estimate_hrs;
    if (payload.total_elapsed_hrs !== undefined) project.total_elapsed_hrs = payload.total_elapsed_hrs;
    if (payload.assigned_ids !== undefined) {
      if (!Array.isArray(payload.assigned_ids)) {
        return res.status(400).json({ detail: 'assigned_ids must be an array' });
      }
      project.assigned_ids = payload.assigned_ids;
    }
    if (payload.is_completed !== undefined) project.is_completed = payload.is_completed;
    await project.save();
    return res.json({ message: 'Project updated successfully' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ detail: 'Error updating project', error: err.message });
  }
});

// Delete a project by id
router.delete('/delete/:project_id', async (req, res) => {
  const id = req.params.project_id;
  try {
    const project = await Project.findByPk(id);
    if (!project) {
      return res.status(404).json({ detail: 'Project not found' });
    }
    await project.destroy();
    return res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ detail: 'Error deleting project', error: err.message });
  }
});

// Filter projects based on query parameters
router.get('/filter', async (req, res) => {
  const created_by = req.query.created_by ? Number(req.query.created_by) : undefined;
  const assigned_id = req.query.assigned_id ? Number(req.query.assigned_id) : undefined;
  const project_name = req.query.project_name ? String(req.query.project_name) : undefined;
  const start_date = req.query.start_date ? String(req.query.start_date) : undefined;
  const end_date = req.query.end_date ? String(req.query.end_date) : undefined;
  const offset = req.query.offset ? Number(req.query.offset) : 0;
  const where = {};
  const conditions = [];
  if (created_by !== undefined) {
    conditions.push({ created_by });
  }
  if (assigned_id !== undefined) {
    // Use JSON search: the assigned_ids column is JSON, so cast to string and search
    conditions.push({
      assigned_ids: {
        [Op.like]: `%${assigned_id}%`
      }
    });
  }
  if (project_name !== undefined) {
    conditions.push({ project_name: { [Op.like]: `%${project_name}%` } });
  }
  // We'll filter by dates by casting created_at to DATE string
  const dateConditions = [];
  if (start_date) {
    const sd = new Date(start_date);
    if (isNaN(sd)) {
      return res.status(400).json({ detail: 'Invalid start_date format. Use YYYY-MM-DD' });
    }
    dateConditions.push({ created_at: { [Op.gte]: sd } });
  }
  if (end_date) {
    const ed = new Date(end_date);
    if (isNaN(ed)) {
      return res.status(400).json({ detail: 'Invalid end_date format. Use YYYY-MM-DD' });
    }
    dateConditions.push({ created_at: { [Op.lte]: ed } });
  }
  try {
    const query = {};
    if (conditions.length) {
      query.where = { [Op.and]: conditions };
    }
    if (dateConditions.length) {
      query.where = query.where ? { [Op.and]: [query.where, { [Op.and]: dateConditions }] } : { [Op.and]: dateConditions };
    }
    query.limit = 10;
    query.offset = offset || 0;
    const projects = await Project.findAll(query);
    return res.json(projects);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ detail: 'Error filtering projects', error: err.message });
  }
});

module.exports = router;