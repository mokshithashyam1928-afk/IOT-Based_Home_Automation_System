import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { executeSql, queryAll, queryOne } from '../config/database.ts';
import { AuthenticatedRequest, signToken } from '../middleware/authMiddleware.ts';

export const registerUser = (req: Request, res: Response) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = queryOne('SELECT id FROM users WHERE email = ?;', [normalizedEmail]);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = bcrypt.hashSync(String(password), 10);
    const assignedRole = role === 'ADMIN' ? 'ADMIN' : 'USER';
    const nowSql = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const { lastInsertRowid } = executeSql(
      `INSERT INTO users (name, email, password_hash, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [String(name).trim(), normalizedEmail, passwordHash, assignedRole, nowSql, nowSql]
    );

    const user = {
      id: lastInsertRowid,
      name: String(name).trim(),
      email: normalizedEmail,
      role: assignedRole as 'ADMIN' | 'USER'
    };

    executeSql(
      `INSERT INTO activity_logs (actor, action_type, entity_type, entity_id, details, protocol, latency_ms)
       VALUES (?, 'USER_REGISTER', 'USER', ?, ?, 'REST/JWT', 12);`,
      [user.email, user.id, `Registered new ${user.role} account (${user.name})`]
    );

    const token = signToken(user);
    return res.status(201).json({ token, user });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Registration failed' });
  }
};

export const loginUser = (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const userRow = queryOne<{
      id: number;
      name: string;
      email: string;
      password_hash: string;
      role: 'ADMIN' | 'USER';
      created_at: string;
    }>('SELECT * FROM users WHERE email = ?;', [normalizedEmail]);

    if (!userRow || !bcrypt.compareSync(String(password), userRow.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password credentials.' });
    }

    const payload = {
      id: userRow.id,
      name: userRow.name,
      email: userRow.email,
      role: userRow.role
    };

    executeSql(
      `INSERT INTO activity_logs (actor, action_type, entity_type, entity_id, details, protocol, latency_ms)
       VALUES (?, 'USER_LOGIN', 'USER', ?, ?, 'REST/JWT', 9);`,
      [userRow.email, userRow.id, `Authenticated session started (${userRow.role})`]
    );

    const token = signToken(payload);
    return res.json({
      token,
      user: {
        ...payload,
        created_at: userRow.created_at
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Authentication failed' });
  }
};

export const getCurrentUser = (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const userRow = queryOne<{ id: number; name: string; email: string; role: string; created_at: string }>(
    'SELECT id, name, email, role, created_at FROM users WHERE id = ?;',
    [req.user.id]
  );
  if (!userRow) {
    return res.status(404).json({ error: 'User not found' });
  }
  return res.json({ user: userRow });
};

export const updateProfile = (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const { name, role } = req.body;
    const nowSql = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const updatedRole = role === 'ADMIN' || role === 'USER' ? role : req.user.role;
    executeSql(
      `UPDATE users SET name = ?, role = ?, updated_at = ? WHERE id = ?;`,
      [String(name || req.user.name).trim(), updatedRole, nowSql, req.user.id]
    );

    const updated = queryOne<{ id: number; name: string; email: string; role: 'ADMIN' | 'USER'; created_at: string }>(
      'SELECT id, name, email, role, created_at FROM users WHERE id = ?;',
      [req.user.id]
    );
    if (!updated) return res.status(404).json({ error: 'User not found' });

    const newToken = signToken({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role
    });

    return res.json({ user: updated, token: newToken });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update profile' });
  }
};

export const getAllUsers = (_req: AuthenticatedRequest, res: Response) => {
  const users = queryAll('SELECT id, name, email, role, created_at, updated_at FROM users ORDER BY id ASC;');
  return res.json(users);
};
