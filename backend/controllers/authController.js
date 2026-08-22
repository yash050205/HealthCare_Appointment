const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, DoctorProfile } = require('../models');

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function sanitize(user) {
  const { id, name, email, role, phone } = user;
  return { id, name, email, role, phone };
}

// Public registration - always creates a 'patient'. Doctor/admin accounts are
// provisioned by an admin via /api/admin/doctors, never through self-signup.
async function register(req, res, next) {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email and password are required' });
    }

    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

    const password_hash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password_hash, phone, role: 'patient' });

    const token = signToken(user);
    res.status(201).json({ token, user: sanitize(user) });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

    const user = await User.findOne({ where: { email } });
    if (!user || !user.is_active) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const token = signToken(user);
    const payload = sanitize(user);

    if (user.role === 'doctor') {
      const profile = await DoctorProfile.findOne({ where: { user_id: user.id } });
      payload.doctorProfileId = profile ? profile.id : null;
    }

    res.json({ token, user: payload });
  } catch (err) {
    next(err);
  }
}

async function me(req, res) {
  res.json({ user: sanitize(req.user) });
}

module.exports = { register, login, me };
