const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../lib/db');
const logger = require('../lib/logger');
const { z } = require('zod');

const createUserSchema = z.object({
  username: z.string().min(3, 'Username debe tener al menos 3 caracteres').max(50),
  password: z.string().min(6, 'Contraseña debe tener al menos 6 caracteres'),
  role: z.enum(['admin', 'editor', 'viewer']).default('viewer'),
  permissions: z.record(z.boolean()).default({}),
  email: z.string().email('Email inválido').optional()
});

const updateUserSchema = z.object({
  password: z.string().min(6, 'Contraseña debe tener al menos 6 caracteres').optional(),
  role: z.enum(['admin', 'editor', 'viewer']).optional(),
  permissions: z.record(z.boolean()).optional(),
  active: z.boolean().optional(),
  email: z.string().email('Email inválido').optional()
});

const listUsersSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(30),
  role: z.enum(['admin', 'editor', 'viewer']).optional(),
  active: z.boolean().optional(),
  q: z.string().optional()
});

async function getUsers(req, res) {
  try {
    const parsed = listUsersSchema.safeParse(req.query || {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' });
    }
    const { page, limit, role, active, q } = parsed.data;
    const offset = (page - 1) * limit;
    const params = [];
    let where = 'WHERE 1=1';

    if (role) { params.push(role); where += ` AND role = $${params.length}`; }
    if (active !== undefined) { params.push(active); where += ` AND active = $${params.length}`; }
    if (q) { params.push(`%${q}%`); where += ` AND (username ILIKE $${params.length} OR email ILIKE $${params.length})`; }

    const countResult = await query(`SELECT COUNT(*) as total FROM users ${where}`, params);
    const total = Number(countResult.rows[0]?.total || 0);

    params.push(limit, offset);
    const result = await query(
      `SELECT id, username, role, permissions, active, email, last_login, created_at, updated_at FROM users ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      users: result.rows,
      total,
      page,
      pages: Math.ceil(total / limit),
      hasMore: page * limit < total
    });
  } catch (err) {
    logger.error({ err: err.message }, 'Error listando usuarios');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function getUser(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json({ error: 'ID de usuario inválido' });

    const result = await query(
      'SELECT id, username, role, permissions, active, email, last_login, created_at, updated_at FROM users WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    logger.error({ err: err.message }, 'Error obteniendo usuario');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function createUser(req, res) {
  try {
    const parsed = createUserSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' });
    }

    const { username, password, role, permissions, email } = parsed.data;

    const existing = await query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'El username ya existe' });
    }

    if (email) {
      const emailExisting = await query('SELECT id FROM users WHERE email = $1', [email]);
      if (emailExisting.rows.length > 0) {
        return res.status(409).json({ error: 'El email ya está registrado' });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO users (username, password_hash, role, permissions, active, email, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE(current_setting('app.current_tenant', TRUE), 'default'))
       RETURNING id, username, role, permissions, active, email, created_at`,
      [username, passwordHash, role || 'viewer', JSON.stringify(permissions || {}), true, email || null]
    );

    logger.info({ username, role: role || 'viewer' }, 'Usuario creado');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    logger.error({ err: err.message }, 'Error creando usuario');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function updateUser(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json({ error: 'ID de usuario inválido' });

    const parsed = updateUserSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' });
    }

    const { password, role, permissions, active, email } = parsed.data;
    const updates = {};
    const values = [];

    if (password !== undefined) {
      const passwordHash = await bcrypt.hash(password, 10);
      updates.password_hash = passwordHash;
    }
    if (role !== undefined) updates.role = role;
    if (permissions !== undefined) updates.permissions = JSON.stringify(permissions);
    if (active !== undefined) updates.active = active;
    if (email !== undefined) updates.email = email;

    if (!Object.keys(updates).length) return res.status(400).json({ error: 'Sin datos para actualizar' });

    values.push(id);
    const setClause = Object.keys(updates).map((key, i) => `${key} = $${i + 1}`).join(', ');
    const result = await query(
      `UPDATE users SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length} RETURNING id, username, role, permissions, active, email, last_login, created_at, updated_at`,
      values
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

    logger.info({ userId: id }, 'Usuario actualizado');
    res.json(result.rows[0]);
  } catch (err) {
    logger.error({ err: err.message }, 'Error actualizando usuario');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function deleteUser(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json({ error: 'ID de usuario inválido' });

    const result = await query('SELECT id, username FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

    await query('DELETE FROM users WHERE id = $1', [id]);

    logger.info({ userId: id, username: result.rows[0].username }, 'Usuario eliminado');
    res.json({ ok: true, message: `Usuario ${result.rows[0].username} eliminado` });
  } catch (err) {
    logger.error({ err: err.message }, 'Error eliminando usuario');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function loginUser(req, res) {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Usuario y contraseña requeridos' });

    const dbUser = await query(
      "SELECT id, username, password_hash, role, permissions, active, tenant_id FROM users WHERE username = $1 AND active = TRUE",
      [username.trim()]
    );

    if (dbUser.rows.length === 0) return res.status(401).json({ error: 'Credenciales inválidas' });

    const u = dbUser.rows[0];
    const match = await bcrypt.compare(password, u.password_hash);
    if (!match) return res.status(401).json({ error: 'Credenciales inválidas' });

    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) return res.status(500).json({ error: 'JWT_SECRET no configurado' });

    const permissions = typeof u.permissions === 'string' ? JSON.parse(u.permissions || '{}') : (u.permissions || {});
    const token = jwt.sign({ role: u.role, user: u.username, permissions, tenant_id: u.tenant_id || 'default' }, JWT_SECRET, { expiresIn: '15m' });

    res.json({ token, user: u.username, role: u.role, permissions });
  } catch (err) {
    logger.error({ err: err.message }, 'Error en login de usuario');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { getUsers, getUser, createUser, updateUser, deleteUser, loginUser };
