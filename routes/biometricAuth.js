const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const authenticate = require('../middleware/authMiddleware');
const {
  enrollFingerprint,
  verifyFingerprint,
  listFingerprints,
  deleteFingerprint,
} = require('../lib/fingerprintClient');

const router = express.Router();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * POST /auth/fingerprint/enroll
 * Authenticated user: capture fingerprint on module, store template_id mapping.
 */
router.post('/enroll', authenticate, async (req, res) => {
  try {
    let label = typeof req.body?.label === 'string' ? req.body.label.trim() : '';
    if (!label) {
      const userResult = await pool.query(
        'SELECT name, email FROM users WHERE id = $1',
        [req.user.id],
      );
      const row = userResult.rows[0];
      label = row?.name || row?.email || `User ${req.user.id}`;
    }
    const fp = await enrollFingerprint(label);
    const templateId = fp.template_id;
    if (templateId == null || Number.isNaN(Number(templateId))) {
      return res.status(502).json({ message: 'Invalid response from fingerprint service' });
    }
    const tid = Number(templateId);
    await pool.query(
      `INSERT INTO user_biometrics (user_id, r307_template_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET
         r307_template_id = EXCLUDED.r307_template_id,
         enrolled_at = NOW()`,
      [req.user.id, tid],
    );
    res.json({
      message: 'Fingerprint enrolled',
      template_id: tid,
      label: fp.label || label,
      enrolled_at: fp.enrolled_at || new Date().toISOString(),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ message: 'Enroll failed', detail: err.message });
  }
});

/**
 * POST /auth/fingerprint/login
 * Public: verify scan against module, issue JWT if template maps to a user.
 */
router.post('/login', async (req, res) => {
  try {
    const fp = await verifyFingerprint();
    if (!fp.matched || fp.template_id == null) {
      return res.status(401).json({ message: 'Fingerprint not recognized' });
    }
    const tid = Number(fp.template_id);
    const row = await pool.query(
      `SELECT u.id, u.email, u.role FROM user_biometrics b
       JOIN users u ON u.id = b.user_id
       WHERE b.r307_template_id = $1`,
      [tid],
    );
    if (row.rows.length === 0) {
      return res.status(401).json({ message: 'No account linked to this fingerprint' });
    }
    const user = row.rows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN },
    );
    res.json({
      message: 'Login successful',
      token,
      email: user.email,
      expires_in: JWT_EXPIRES_IN,
      template_id: tid,
      accuracy_score: fp.accuracy_score ?? null,
      fingerprint_label: fp.label ?? null,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ message: 'Fingerprint login failed', detail: err.message });
  }
});

router.get('/status', authenticate, async (_req, res) => {
  try {
    const list = await listFingerprints();
    res.json(list);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ message: 'Fingerprint status failed', detail: err.message });
  }
});

router.delete('/template/:templateId', authenticate, async (req, res) => {
  try {
    const templateId = Number(req.params.templateId);
    if (!Number.isInteger(templateId) || templateId < 0) {
      return res.status(400).json({ message: 'Invalid template id' });
    }
    const owner = await pool.query(
      'SELECT user_id FROM user_biometrics WHERE r307_template_id = $1',
      [templateId],
    );
    if (owner.rows.length === 0) {
      return res.status(404).json({ message: 'Template mapping not found' });
    }
    if (owner.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ message: 'Cannot delete another user fingerprint' });
    }
    await deleteFingerprint(templateId);
    await pool.query('DELETE FROM user_biometrics WHERE user_id = $1', [req.user.id]);
    res.json({ message: 'Fingerprint template deleted', template_id: templateId });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ message: 'Fingerprint delete failed', detail: err.message });
  }
});

module.exports = router;
