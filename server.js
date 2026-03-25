const express = require('express');
const cors = require('cors');
require('dotenv').config();

const pool = require('./db');
const authRoutes = require('./routes/auth');
const authenticate = require('./middleware/authMiddleware');

const documentRoutes = require("./routes/document");
const notarizationRoutes = require("./routes/notarization");

const app = express();

const corsConfig = {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsConfig));
app.use(express.json());
app.use('/auth', authRoutes);
app.use("/documents", documentRoutes);
app.use("/notarizations", notarizationRoutes);

app.get('/', (req, res) => {
  res.send('BioNotary Backend Running');
});

app.get('/profile', authenticate, async (req, res) => {
  res.json({
    message: 'Access granted',
    user: req.user
  });
});

app.get('/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json(result.rows);
  } catch (err) {
    // For now, surface the error message to help debugging.
    res.status(500).json({ error: err.message });
  }
});

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

  // Prevent saving applicant details for a different account.
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

async function ensureApplicantsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS applicants (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      first_name VARCHAR(100) NOT NULL,
      middle_name VARCHAR(100),
      last_name VARCHAR(100) NOT NULL,
      aadhaar VARCHAR(12) NOT NULL,
      email VARCHAR(150) NOT NULL,
      pan VARCHAR(10),
      phone VARCHAR(20),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await ensureApplicantsTable();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to ensure applicants table:', err);
    process.exit(1);
  }

  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Server running on port ${PORT}`);
  });
})();

