// routes/auth.js
const express = require('express');
const router = express.Router();
const {Op} = require('sequelize');

const {
    AuthUser,
    Role,
    UserRole,
    RefreshToken,
    Employee,
    sequelize, // from models/index.js
} = require('../models');

const {
    hashPassword,
    verifyPassword,
    createAccessToken,
    decodeAccessToken,
    makeRefreshToken,
    refreshExp,
} = require('../utils/security');

/* ---------------- Utilities ---------------- */

function normaliseRole(v) {
    if (!v) return null;
    let r = v.trim().replace(/[ _]/g, '-').toUpperCase();
    if (r === 'SUPERADMIN' || r === 'SUPER_ADMIN') r = 'SUPER-ADMIN';
    return r;
}

async function getRoleByName(name) {
    return Role.findOne({where: {name}});
}

async function ensureRole(name) {
    let r = await getRoleByName(name);
    if (!r) r = await Role.create({name});
    return r;
}

async function getAllRoleNames() {
    const rows = await Role.findAll({attributes: ['name']});
    return rows.map((r) => r.name);
}

/**
 * Default role resolution:
 * 1) DEFAULT_ROLE (if exists in DB)
 * 2) EMPLOYEE (if exists)
 * 3) first role found
 * 4) create EMPLOYEE
 */
async function resolveDefaultRole() {
    const envDefault = normaliseRole(process.env.DEFAULT_ROLE || '');
    if (envDefault) {
        const envRole = await getRoleByName(envDefault);
        if (envRole) return envDefault;
    }
    const all = await getAllRoleNames();
    if (all.includes('EMPLOYEE')) return 'EMPLOYEE';
    if (all.length > 0) return all[0];
    await ensureRole('EMPLOYEE');
    return 'EMPLOYEE';
}

/* Shape response with roles + employee */
function toUserResponse(userInstance) {
    const roles = userInstance.Roles ? userInstance.Roles.map((r) => r.name) : [];
    const e = userInstance.Employee || null;

    return {
        user_id: userInstance.user_id,
        email: userInstance.email,
        full_name: userInstance.full_name,
        profile_photo: userInstance.profile_photo,
        is_active: userInstance.is_active,
        email_verified: userInstance.email_verified,
        created_at: userInstance.created_at,
        updated_at: userInstance.updated_at,
        last_active: userInstance.last_active,
        role: roles.length ? roles[0] : null,
        roles: roles.length ? roles : null,
        employee: e
            ? {
                employee_id: e.employee_id,
                phone: e.phone,
                address: e.address,
                fathers_name: e.fathers_name,
                aadhar_no: e.aadhar_no,
                date_of_birth: e.date_of_birth,
                work_position: e.work_position,
                created_at: e.created_at,
                updated_at: e.updated_at,
            }
            : null,
    };
}

/* ---------------- Auth middleware ---------------- */

async function getCurrentUser(req, res, next) {
    const auth = req.headers['authorization'];
    if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({detail: 'Not authenticated'});
    }
    const token = auth.slice(7).trim();
    try {
        const payload = decodeAccessToken(token);
        const user = await AuthUser.findOne({
            where: {user_id: payload.sub},
            include: [
                {model: Role, through: {attributes: []}},
                {model: Employee, as: 'Employee'},
            ],
        });
        if (!user || !user.is_active) {
            return res.status(401).json({detail: 'User not found or inactive'});
        }
        req.currentUser = user;
        next();
    } catch (err) {
        return res.status(401).json({detail: 'Invalid or expired access token'});
    }
}

function requireRoles(...allowed) {
    const allowedSet = new Set(allowed.map(normaliseRole));
    return function (req, res, next) {
        const user = req.currentUser;
        if (!user) {
            return res.status(401).json({detail: 'Not authenticated'});
        }
        const userRoles = new Set((user.Roles || []).map((r) => r.name));
        const ok = [...allowedSet].some((r) => userRoles.has(r));
        if (!ok) {
            return res.status(403).json({detail: 'Forbidden'});
        }
        next();
    };
}

/* --------- Env-driven role policy for protected endpoints --------- */
const USERS_ENDPOINT_ALLOWED = (process.env.USERS_ENDPOINT_ALLOWED || 'SUPER-ADMIN,ADMIN,MANAGER')
    .split(',')
    .map((s) => normaliseRole(s));

const USER_GET_ENDPOINT_ALLOWED = (process.env.USER_GET_ENDPOINT_ALLOWED || 'SUPER-ADMIN,ADMIN')
    .split(',')
    .map((s) => normaliseRole(s));

/* ---------------- Public endpoints ---------------- */

// POST /auth/register — simple self-register (no employee row)
router.post('/register', async (req, res) => {
    const {email, password, full_name, profile_photo = null} = req.body || {};
    if (!email || !password || !full_name) {
        return res.status(400).json({detail: 'email, password and full_name are required'});
    }
    try {
        const exists = await AuthUser.findOne({where: {email}});
        if (exists) {
            return res.status(409).json({detail: 'Email already exists'});
        }
        const pwHash = await hashPassword(password);
        const user = await AuthUser.create({
            email,
            password_hash: pwHash,
            full_name,
            profile_photo,
        });

        const roleName = await resolveDefaultRole();
        const roleObj = await ensureRole(roleName);
        await user.setRoles([roleObj]);

        await user.reload({include: [{model: Role, through: {attributes: []}}, {model: Employee, as: 'Employee'}]});
        return res.json(toUserResponse(user));
    } catch (err) {
        console.error(err);
        return res.status(500).json({detail: 'Error registering user', error: err.message});
    }
});

// POST /auth/login
router.post('/login', async (req, res) => {
    const {email, password} = req.body || {};
    if (!email || !password) {
        return res.status(400).json({detail: 'email and password are required'});
    }
    try {
        const user = await AuthUser.findOne({
            where: {email},
            include: [{model: Role, through: {attributes: []}}, {model: Employee, as: 'Employee'}],
        });
        if (!user || !(await verifyPassword(password, user.password_hash))) {
            return res.status(401).json({detail: 'Invalid credentials'});
        }

        user.last_active = new Date();
        await user.save();

        const roles = user.Roles ? user.Roles.map((r) => r.name) : [];
        const accessToken = createAccessToken(String(user.user_id), roles);

        const {raw: refreshTokenRaw, digest: refreshDigest} = makeRefreshToken();
        await RefreshToken.create({
            user_id: user.user_id,
            token_hash: refreshDigest,
            expires_at: refreshExp(),
            user_agent: req.headers['user-agent'] ? String(req.headers['user-agent']).slice(0, 255) : null,
            ip: req.ip || null,
        });

        return res.json({
            access_token: accessToken,
            refresh_token: refreshTokenRaw,
            token_type: 'bearer',
            user: toUserResponse(user),
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({detail: 'Error logging in', error: err.message});
    }
});

// GET /auth/me
router.get('/me', getCurrentUser, (req, res) => res.json(toUserResponse(req.currentUser)));

// POST /auth/refresh
router.post('/refresh', async (req, res) => {
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
        return res.status(401).json({detail: 'Missing refresh token'});
    }
    try {
        const digest = require('crypto').createHash('sha256').update(token).digest('hex');
        const rt = await RefreshToken.findOne({where: {token_hash: digest, revoked: false}});
        if (!rt) return res.status(401).json({detail: 'Invalid refresh token'});
        if (new Date(rt.expires_at) <= new Date()) return res.status(401).json({detail: 'Refresh expired'});

        const user = await AuthUser.findOne({
            where: {user_id: rt.user_id},
            include: [{model: Role, through: {attributes: []}}, {model: Employee, as: 'Employee'}],
        });
        if (!user || !user.is_active) return res.status(401).json({detail: 'User inactive or missing'});

        user.last_active = new Date();
        await user.save();

        rt.revoked = true;
        await rt.save();

        const {raw: newRaw, digest: newDigest} = makeRefreshToken();
        await RefreshToken.create({
            user_id: user.user_id,
            token_hash: newDigest,
            expires_at: refreshExp(),
            user_agent: req.headers['user-agent'] ? String(req.headers['user-agent']).slice(0, 255) : null,
            ip: req.ip || null,
        });

        const roles = user.Roles ? user.Roles.map((r) => r.name) : [];
        const newAccess = createAccessToken(String(user.user_id), roles);

        return res.json({
            access_token: newAccess,
            refresh_token: newRaw,
            token_type: 'bearer',
            user: toUserResponse(user),
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({detail: 'Error refreshing token', error: err.message});
    }
});

/* ---------------- Admin endpoints ---------------- */

// POST /auth/users — create user + employee atomically
router.post(
    '/users',
    getCurrentUser,
    requireRoles(...USERS_ENDPOINT_ALLOWED), // e.g. SUPER-ADMIN, ADMIN, MANAGER
    async (req, res) => {
        const {
            email, full_name, password, profile_photo = null,
            employee_id, phone, address, fathers_name, aadhar_no,
            date_of_birth, work_position,
            role, // optional pretty label, e.g., "Attendance Team"
        } = req.body || {};

        const required = [
            'email', 'full_name', 'password',
            'employee_id', 'phone', 'address', 'fathers_name', 'aadhar_no', 'date_of_birth', 'work_position',
        ];
        const missing = required.filter((k) => !req.body?.[k]);
        if (missing.length) return res.status(400).json({detail: `Missing fields: ${missing.join(', ')}`});

        const t = await sequelize.transaction();
        try {
            const dupEmail = await AuthUser.findOne({where: {email}, transaction: t});
            if (dupEmail) throw new Error('Email already exists');

            const dupEmp = await Employee.findOne({where: {employee_id}, transaction: t});
            if (dupEmp) throw new Error('employee_id already exists');

            const dupAad = await Employee.findOne({where: {aadhar_no}, transaction: t});
            if (dupAad) throw new Error('aadhar_no already exists');

            const pwHash = await hashPassword(password);
            const user = await AuthUser.create(
                {email, password_hash: pwHash, full_name, profile_photo},
                {transaction: t}
            );

            await Employee.create(
                {
                    user_id: user.user_id,
                    employee_id,
                    phone,
                    address,
                    fathers_name,
                    aadhar_no,
                    date_of_birth,
                    work_position
                },
                {transaction: t}
            );

            const wantedRole = role ? normaliseRole(role) : await resolveDefaultRole();
            const roleObj = await ensureRole(wantedRole);
            await user.setRoles([roleObj], {transaction: t});

            await t.commit();

            const created = await AuthUser.findOne({
                where: {user_id: user.user_id},
                include: [{model: Role, through: {attributes: []}}, {model: Employee, as: 'Employee'}],
            });

            return res.status(201).json(toUserResponse(created));
        } catch (err) {
            if (!t.finished) await t.rollback();
            const msg = (err.original && err.original.message) || err.message || 'Error creating user';
            return res.status(400).json({detail: msg});
        }
    }
);

// GET /auth/users — now includes employee; supports ?q= and ?employee_id=
router.get(
    '/users',
    getCurrentUser,
    requireRoles(...USERS_ENDPOINT_ALLOWED),
    async (req, res) => {
        const q = req.query.q ? String(req.query.q) : null;
        const employee_id = req.query.employee_id ? String(req.query.employee_id) : null;

        try {
            const where = {};
            if (q) {
                where[Op.or] = [
                    {email: {[Op.like]: `%${q}%`}},
                    {full_name: {[Op.like]: `%${q}%`}},
                ];
            }

            const users = await AuthUser.findAll({
                where,
                include: [
                    {model: Role, through: {attributes: []}},
                    {model: Employee, as: 'Employee'},
                ],
                order: [['created_at', 'DESC']],
            });

            const filtered = employee_id
                ? users.filter((u) => u.Employee?.employee_id === employee_id)
                : users;

            return res.json(filtered.map(toUserResponse));
        } catch (err) {
            console.error(err);
            return res.status(500).json({detail: 'Error listing users', error: err.message});
        }
    }
);

// GET /auth/users/:user_id — includes employee
router.get(
    '/users/:user_id',
    getCurrentUser,
    requireRoles(...USER_GET_ENDPOINT_ALLOWED),
    async (req, res) => {
        const id = req.params.user_id;
        try {
            const user = await AuthUser.findOne({
                where: {user_id: id},
                include: [{model: Role, through: {attributes: []}}, {model: Employee, as: 'Employee'}],
            });
            if (!user) return res.status(404).json({detail: 'User not found'});
            return res.json(toUserResponse(user));
        } catch (err) {
            console.error(err);
            return res.status(500).json({detail: 'Error getting user', error: err.message});
        }
    }
);

// PATCH /auth/me/photo
router.patch('/me/photo', getCurrentUser, async (req, res) => {
    const {profile_photo} = req.body || {};
    if (!profile_photo) return res.status(400).json({detail: 'profile_photo is required'});

    let data = String(profile_photo).trim();
    if (data.startsWith('data:image')) {
        const comma = data.indexOf(',');
        if (comma >= 0) data = data.slice(comma + 1);
    }
    try {
        const user = req.currentUser;
        user.profile_photo = data;
        await user.save();
        await user.reload({include: [{model: Role, through: {attributes: []}}, {model: Employee, as: 'Employee'}]});
        return res.json(toUserResponse(user));
    } catch (err) {
        console.error(err);
        return res.status(500).json({detail: 'Error updating photo', error: err.message});
    }
});

// PATCH /auth/users/:user_id — user core fields (not employee fields)
router.patch(
    '/users/:user_id',
    getCurrentUser,
    requireRoles(...USERS_ENDPOINT_ALLOWED),
    async (req, res) => {
        const id = req.params.user_id;
        const {full_name, profile_photo, is_active} = req.body || {};
        try {
            const user = await AuthUser.findOne({
                where: {user_id: id},
                include: [{model: Role, through: {attributes: []}}, {model: Employee, as: 'Employee'}],
            });
            if (!user) return res.status(404).json({detail: 'User not found'});

            if (full_name !== undefined) user.full_name = String(full_name).trim();
            if (profile_photo !== undefined) user.profile_photo = String(profile_photo).trim();
            if (is_active !== undefined) user.is_active = Boolean(is_active);

            await user.save();
            await user.reload({include: [{model: Role, through: {attributes: []}}, {model: Employee, as: 'Employee'}]});

            return res.json(toUserResponse(user));
        } catch (err) {
            console.error(err);
            return res.status(500).json({detail: 'Error updating user', error: err.message});
        }
    }
);

// POST /auth/assign-roles
router.post('/assign-roles', getCurrentUser, requireRoles('SUPER-ADMIN', 'ADMIN'), async (req, res) => {
    const {user_id, roles} = req.body || {};
    if (!user_id || !roles || !Array.isArray(roles) || roles.length === 0) {
        return res.status(400).json({detail: 'user_id and roles (array) are required'});
    }
    const wanted = new Set();
    for (const r of roles) {
        const nr = normaliseRole(r);
        if (!nr) return res.status(400).json({detail: `Invalid role: ${r}`});
        wanted.add(nr);
    }
    try {
        const user = await AuthUser.findOne({
            where: {user_id},
            include: [{model: Role, through: {attributes: []}}, {model: Employee, as: 'Employee'}],
        });
        if (!user) return res.status(404).json({detail: 'User not found'});

        const roleObjs = [];
        for (const r of wanted) {
            const obj = await ensureRole(r);
            roleObjs.push(obj);
        }
        await user.setRoles(roleObjs);
        await user.reload({include: [{model: Role, through: {attributes: []}}, {model: Employee, as: 'Employee'}]});

        return res.json(toUserResponse(user));
    } catch (err) {
        console.error(err);
        return res.status(500).json({detail: 'Error assigning roles', error: err.message});
    }
});

module.exports = router;
