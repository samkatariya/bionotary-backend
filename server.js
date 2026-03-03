const express = require('express');
const cors = require('cors');
require('dotenv').config();

const pool = require('./db');
const authRoutes = require('./routes/auth');
const authenticate = require('./middleware/authMiddleware');

const documentRoutes = require("./routes/document");
const notarizationRoutes = require("./routes/notarization");

const app = express();

app.use(cors());
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

app.post('/notarize', async (req, res) => {
  const { wallet_address, doc_hash, tx_hash } = req.body;
  if (!wallet_address || !doc_hash || !tx_hash) {
    return res.status(400).json({ error: 'wallet_address, doc_hash and tx_hash are required' });
  }

  try {
    await pool.query(
      'INSERT INTO notarizations (wallet_address, doc_hash, tx_hash) VALUES ($1, $2, $3)',
      [wallet_address, doc_hash, tx_hash],
    );

    res.json({ message: 'Stored successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/applicants', async (req, res) => {
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

  try {
    await pool.query(
      `INSERT INTO applicants
        (first_name, middle_name, last_name, aadhaar, email, pan, phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
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

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on port ${PORT}`);
});

