const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const pool = require('./db');
const authRoutes = require('./routes/auth');
const authenticate = require('./middleware/authMiddleware');
const documentRoutes = require('./routes/document');
const notarizationRoutes = require('./routes/notarization');
const biometricAuthRoutes = require('./routes/biometricAuth');
const { ensureSchema } = require('./db/ensureSchema');

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS;
const corsConfig = {
  origin:
    allowedOrigins && allowedOrigins.trim()
      ? allowedOrigins.split(',').map((s) => s.trim())
      : true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsConfig));
app.use(express.json());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/auth', authLimiter);
app.use('/auth', authRoutes);
app.use('/auth/fingerprint', biometricAuthRoutes);
app.use('/documents', documentRoutes);
app.use('/notarizations', notarizationRoutes);

app.get('/', (req, res) => {
  res.send('BioNotary Backend Running');
});

app.get('/profile', authenticate, async (req, res) => {
  res.json({
    message: 'Access granted',
    user: req.user,
  });
});

if (process.env.NODE_ENV !== 'production') {
  app.get('/test-db', async (req, res) => {
    try {
      const result = await pool.query('SELECT NOW()');
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

app.post('/applicants', authenticate, async (req, res) => {
  const {
    first_name,
    middle_name,
    last_name,
    aadhaar,
    email,
    pan,
    phone,
  } = req.body;

  if (!first_name || !last_name || !aadhaar || !email) {
    return res.status(400).json({
      error: 'first_name, last_name, aadhaar and email are required',
    });
  }

  if (req.user && req.user.email && email !== req.user.email) {
    return res.status(403).json({ error: 'Email does not match logged-in user' });
  }

  try {
    await pool.query(
      `INSERT INTO applicants
        (user_id, first_name, middle_name, last_name, aadhaar, email, pan, phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id) DO UPDATE SET
         first_name = EXCLUDED.first_name,
         middle_name = EXCLUDED.middle_name,
         last_name = EXCLUDED.last_name,
         aadhaar = EXCLUDED.aadhaar,
         email = EXCLUDED.email,
         pan = EXCLUDED.pan,
         phone = EXCLUDED.phone,
         updated_at = NOW()`,
      [
        req.user.id,
        first_name,
        middle_name || null,
        last_name,
        aadhaar,
        email,
        pan || null,
        phone || null,
      ],
    );

    res.json({ message: 'Applicant saved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;

async function start() {
  await ensureSchema();
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Server running on port ${PORT}`);
  });
}

function isConnectionRefused(err) {
  if (!err) return false;
  if (err.code === 'ECONNREFUSED') return true;
  if (err.name === 'AggregateError' && Array.isArray(err.errors)) {
    return err.errors.some((e) => e && e.code === 'ECONNREFUSED');
  }
  return false;
}

if (require.main === module) {
  start().catch((err) => {
    if (isConnectionRefused(err)) {
      const host = process.env.DB_HOST || 'localhost';
      const dbPort = process.env.DB_PORT || '5432';
      // eslint-disable-next-line no-console
      console.error(`
PostgreSQL refused the connection (${host}:${dbPort}).

- Start PostgreSQL, or run from this project folder:
    docker compose up -d
  (Uses postgres / yourpassword / bionotary — match DB_* in your .env)

- WSL: ensure Postgres runs in the same environment as \`node\`, or set DB_HOST to the host IP that runs Docker.
`);
    }
    // eslint-disable-next-line no-console
    console.error('Failed to start:', err);
    process.exit(1);
  });
}

module.exports = app;
