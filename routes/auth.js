const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');

const {
  AuthUser,
  Role,
  UserRole,
  RefreshToken
} = require('../models');
const {
  hashPassword,
  verifyPassword,
  createAccessToken,
  decodeAccessToken,
  makeRefreshToken,
  refreshExp
} = require('../utils/security');

/**
 * Helper to normalise role names.  Roles are stored in
 * uppercase with hyphens instead of spaces or underscores.  The
 * mapping mirrors the logic in the FastAPI implementation.
 *
 * @param {string|null|undefined} v Input role name
 * @returns {string|null} Normalised role or null
 */
function normaliseRole(v) {
  if (!v) return null;
  let r = v.trim().replace(/[ _]/g, '-').toUpperCase();
  if (r === 'SUPERADMIN' || r === 'SUPER_ADMIN') {
    r = 'SUPER-ADMIN';
  }
  return r;
}

// Allowed roles for the /register endpoint.  Users cannot assign
// themselves privileged roles via public registration.
const ALLOWED_PUBLIC_ROLES = new Set(['USER', 'GUEST']);
const ALLOWED_ALL_ROLES = new Set([
  'SUPER-ADMIN', 'ADMIN', 'USER', 'GUEST',
  'ADMIN-PROCUREMENT', 'MANAGER-PROCUREMENT', 'EMPLOYEE-PROCUREMENT',
  'ADMIN-DISTRIBUTION', 'MANAGER-DISTRIBUTION', 'EMPLOYEE-DISTRIBUTION'
]);

/**
 * Convert an AuthUser instance into the public response shape.  The
 * returned object closely matches the Pydantic models used in
 * FastAPI, with minor naming differences (e.g. camelCase vs
 * snake_case) omitted for simplicity.
 *
 * @param {object} user Sequelize user instance with roles loaded
 * @returns {object} Sanitised user representation
 */
function toUserWithRole(user) {
  const roles = user.Roles ? user.Roles.map(r => r.name) : [];
  return {
    user_id: user.user_id,
    email: user.email,
    full_name: user.full_name,
    profile_photo: user.profile_photo,
    is_active: user.is_active,
    email_verified: user.email_verified,
    created_at: user.created_at,
    updated_at: user.updated_at,
    last_active: user.last_active,
    role: roles.length ? roles[0] : null,
    roles: roles.length ? roles : null
  };
}

/**
 * Middleware that extracts the bearer token from the Authorization
 * header, verifies it, and loads the associated user.  If the
 * token is missing, invalid, or the user is inactive the request
 * fails with 401 Unauthorized.  On success the user instance is
 * attached to ``req.currentUser``.
 */
async function getCurrentUser(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ detail: 'Not authenticated' });
  }
  const token = auth.slice(7).trim();
  try {
    const payload = decodeAccessToken(token);
    const user = await AuthUser.findOne({
      where: { user_id: payload.sub },
      include: [{ model: Role, through: { attributes: [] } }]
    });
    if (!user || !user.is_active) {
      return res.status(401).json({ detail: 'User not found or inactive' });
    }
    req.currentUser = user;
    next();
  } catch (err) {
    return res.status(401).json({ detail: 'Invalid or expired access token' });
  }
}

/**
 * Create a middleware that ensures the current user has at least one
 * of the specified roles.  Roles are compared case‑sensitively.
 *
 * @param {...string} allowed Role names that are permitted
 */
function requireRoles(...allowed) {
  return function (req, res, next) {
    const user = req.currentUser;
    if (!user) {
      return res.status(401).json({ detail: 'Not authenticated' });
    }
    const userRoles = new Set((user.Roles || []).map(r => r.name));
    const ok = allowed.some(r => userRoles.has(r));
    if (!ok) {
      return res.status(403).json({ detail: 'Forbidden' });
    }
    next();
  };
}

// ---------------- API Endpoints ----------------

// POST /auth/register
router.post('/register', async (req, res) => {
  const { email, password, full_name, profile_photo = null, role = null } = req.body || {};
  if (!email || !password || !full_name) {
    return res.status(400).json({ detail: 'email, password and full_name are required' });
  }
  const normRole = normaliseRole(role);
  if (normRole && !ALLOWED_PUBLIC_ROLES.has(normRole)) {
    return res.status(400).json({ detail: `role must be one of ${[...ALLOWED_PUBLIC_ROLES].join(', ')}` });
  }
  try {
    const exists = await AuthUser.findOne({ where: { email } });
    if (exists) {
      return res.status(409).json({ detail: 'Email already exists' });
    }
    const pwHash = await hashPassword(password);
    const user = await AuthUser.create({
      email,
      password_hash: pwHash,
      full_name,
      profile_photo
    });
    // Determine role: default to USER when none provided
    const roleName = normRole || 'USER';
    let roleObj = await Role.findOne({ where: { name: roleName } });
    if (!roleObj) {
      roleObj = await Role.create({ name: roleName });
    }
    await user.setRoles([roleObj]);
    await user.reload({ include: [{ model: Role, through: { attributes: [] } }] });
    return res.json(toUserWithRole(user));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ detail: 'Error registering user', error: err.message });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ detail: 'email and password are required' });
  }
  try {
    const user = await AuthUser.findOne({
      where: { email },
      include: [{ model: Role, through: { attributes: [] } }]
    });
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return res.status(401).json({ detail: 'Invalid credentials' });
    }
    // Update last_active
    user.last_active = new Date();
    await user.save();
    const roles = user.Roles ? user.Roles.map(r => r.name) : [];
    const accessToken = createAccessToken(String(user.user_id), roles);
    const { raw: refreshTokenRaw, digest: refreshDigest } = makeRefreshToken();
    await RefreshToken.create({
      user_id: user.user_id,
      token_hash: refreshDigest,
      expires_at: refreshExp(),
      user_agent: req.headers['user-agent'] ? String(req.headers['user-agent']).slice(0, 255) : null,
      ip: req.ip || null
    });
    return res.json({
      access_token: accessToken,
      refresh_token: refreshTokenRaw,
      token_type: 'bearer',
      user: toUserWithRole(user)
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ detail: 'Error logging in', error: err.message });
  }
});

// GET /auth/me
router.get('/me', getCurrentUser, (req, res) => {
  return res.json(toUserWithRole(req.currentUser));
});

// POST /auth/refresh
router.post('/refresh', async (req, res) => {
  // Extract refresh token from body, cookie or headers similar to Python
  let token = null;
  const bodyToken = req.body && req.body.refresh_token ? String(req.body.refresh_token).trim() : null;
  if (bodyToken) {
    token = bodyToken;
  } else if (req.cookies && req.cookies.refresh_token) {
    token = String(req.cookies.refresh_token).trim();
  } else if (req.headers['x-refresh-token']) {
    token = String(req.headers['x-refresh-token']).trim();
  } else if (req.headers['authorization']) {
    const auth = req.headers['authorization'];
    const [scheme, value] = auth.split(' ');
    if (scheme && scheme.toLowerCase() === 'refresh' && value) {
      token = value.trim();
    }
  }
  if (!token) {
    return res.status(401).json({ detail: 'Missing refresh token' });
  }
  try {
    const digest = require('crypto').createHash('sha256').update(token).digest('hex');
    const rt = await RefreshToken.findOne({ where: { token_hash: digest, revoked: false } });
    if (!rt) {
      return res.status(401).json({ detail: 'Invalid refresh token' });
    }
    if (new Date(rt.expires_at) <= new Date()) {
      return res.status(401).json({ detail: 'Refresh expired' });
    }
    const user = await AuthUser.findOne({
      where: { user_id: rt.user_id },
      include: [{ model: Role, through: { attributes: [] } }]
    });
    if (!user || !user.is_active) {
      return res.status(401).json({ detail: 'User inactive or missing' });
    }
    // update last_active
    user.last_active = new Date();
    await user.save();
    // revoke old token
    rt.revoked = true;
    await rt.save();
    // issue new refresh token
    const { raw: newRaw, digest: newDigest } = makeRefreshToken();
    await RefreshToken.create({
      user_id: user.user_id,
      token_hash: newDigest,
      expires_at: refreshExp(),
      user_agent: req.headers['user-agent'] ? String(req.headers['user-agent']).slice(0, 255) : null,
      ip: req.ip || null
    });
    const roles = user.Roles ? user.Roles.map(r => r.name) : [];
    const newAccess = createAccessToken(String(user.user_id), roles);
    return res.json({
      access_token: newAccess,
      refresh_token: newRaw,
      token_type: 'bearer',
      user: toUserWithRole(user)
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ detail: 'Error refreshing token', error: err.message });
  }
});

// GET /auth/users
router.get('/users', getCurrentUser, requireRoles('SUPER-ADMIN', 'ADMIN', 'MANAGER-PROCUREMENT', 'MANAGER-DISTRIBUTION'), async (req, res) => {
  const q = req.query.q ? String(req.query.q) : null;
  try {
    const where = {};
    if (q) {
      where[Op.or] = [
        { email: { [Op.like]: `%${q}%` } },
        { full_name: { [Op.like]: `%${q}%` } }
      ];
    }
    const users = await AuthUser.findAll({
      where,
      include: [{ model: Role, through: { attributes: [] } }],
      order: [['created_at', 'DESC']]
    });
    return res.json(users.map(u => toUserWithRole(u)));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ detail: 'Error listing users', error: err.message });
  }
});

// GET /auth/users/:user_id
router.get('/users/:user_id', getCurrentUser, requireRoles('SUPER-ADMIN', 'ADMIN'), async (req, res) => {
  const id = req.params.user_id;
  try {
    const user = await AuthUser.findOne({
      where: { user_id: id },
      include: [{ model: Role, through: { attributes: [] } }]
    });
    if (!user) {
      return res.status(404).json({ detail: 'User not found' });
    }
    return res.json(toUserWithRole(user));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ detail: 'Error getting user', error: err.message });
  }
});

// PATCH /auth/me/photo
router.patch('/me/photo', getCurrentUser, async (req, res) => {
  const { profile_photo } = req.body || {};
  if (!profile_photo) {
    return res.status(400).json({ detail: 'profile_photo is required' });
  }
  let data = String(profile_photo).trim();
  if (data.startsWith('data:image')) {
    const comma = data.indexOf(',');
    if (comma >= 0) {
      data = data.slice(comma + 1);
    }
  }
  try {
    const user = req.currentUser;
    user.profile_photo = data;
    await user.save();
    await user.reload({ include: [{ model: Role, through: { attributes: [] } }] });
    return res.json(toUserWithRole(user));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ detail: 'Error updating photo', error: err.message });
  }
});

// PATCH /auth/users/:user_id
router.patch('/users/:user_id', getCurrentUser, requireRoles('SUPER-ADMIN', 'ADMIN', 'MANAGER-PROCUREMENT', 'MANAGER-DISTRIBUTION'), async (req, res) => {
  const id = req.params.user_id;
  const { full_name, profile_photo, is_active } = req.body || {};
  try {
    const user = await AuthUser.findOne({
      where: { user_id: id },
      include: [{ model: Role, through: { attributes: [] } }]
    });
    if (!user) {
      return res.status(404).json({ detail: 'User not found' });
    }
    if (full_name !== undefined) user.full_name = String(full_name).trim();
    if (profile_photo !== undefined) user.profile_photo = String(profile_photo).trim();
    if (is_active !== undefined) user.is_active = Boolean(is_active);
    await user.save();
    await user.reload({ include: [{ model: Role, through: { attributes: [] } }] });
    return res.json(toUserWithRole(user));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ detail: 'Error updating user', error: err.message });
  }
});

// POST /auth/assign-roles
router.post('/assign-roles', getCurrentUser, requireRoles('SUPER-ADMIN', 'ADMIN'), async (req, res) => {
  const { user_id, roles } = req.body || {};
  if (!user_id || !roles || !Array.isArray(roles) || roles.length === 0) {
    return res.status(400).json({ detail: 'user_id and roles (array) are required' });
  }
  const wanted = new Set();
  for (const r of roles) {
    const nr = normaliseRole(r);
    if (!nr || !ALLOWED_ALL_ROLES.has(nr)) {
      return res.status(400).json({ detail: `Invalid role: ${r}` });
    }
    wanted.add(nr);
  }
  try {
    const user = await AuthUser.findOne({
      where: { user_id },
      include: [{ model: Role, through: { attributes: [] } }]
    });
    if (!user) {
      return res.status(404).json({ detail: 'User not found' });
    }
    const roleObjs = [];
    for (const r of wanted) {
      let obj = await Role.findOne({ where: { name: r } });
      if (!obj) {
        obj = await Role.create({ name: r });
      }
      roleObjs.push(obj);
    }
    await user.setRoles(roleObjs);
    await user.reload({ include: [{ model: Role, through: { attributes: [] } }] });
    return res.json(toUserWithRole(user));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ detail: 'Error assigning roles', error: err.message });
  }
});

module.exports = router;