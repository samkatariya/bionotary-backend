const express = require("express");
const pool = require("../db");
const authenticate = require("../middleware/authMiddleware");

const router = express.Router();

/* LIST MY DOCUMENTS (includes latest notarization tx per document) */
router.get("/my-documents", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.*, n.transaction_hash, n.contract_address, n.blockchain_network,
              n.block_number AS notarization_block_number
       FROM documents d
       LEFT JOIN LATERAL (
         SELECT transaction_hash, contract_address, blockchain_network, block_number
         FROM notarizations
         WHERE document_id = d.id
         ORDER BY confirmed_at DESC NULLS LAST
         LIMIT 1
       ) n ON true
       WHERE d.owner_id = $1
       ORDER BY d.created_at DESC`,
      [req.user.id],
    );
    res.json({ documents: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* Lookup registered document + anchor by SHA-256 (for integrity checks) */
router.get("/lookup-by-hash", authenticate, async (req, res) => {
  try {
    let h = req.query.sha256;
    if (!h || typeof h !== "string") {
      return res.status(400).json({ message: "Query sha256 is required" });
    }
    h = h.trim().replace(/^0x/i, "");
    if (!/^[a-fA-F0-9]{64}$/.test(h)) {
      return res.status(400).json({ message: "sha256 must be 64 hex characters" });
    }
    const result = await pool.query(
      `SELECT d.id, d.file_name, d.sha256_hash, d.notarization_status,
              n.transaction_hash, n.contract_address, n.blockchain_network
       FROM documents d
       LEFT JOIN LATERAL (
         SELECT transaction_hash, contract_address, blockchain_network
         FROM notarizations
         WHERE document_id = d.id
         ORDER BY confirmed_at DESC NULLS LAST
         LIMIT 1
       ) n ON true
       WHERE d.owner_id = $1 AND LOWER(d.sha256_hash) = LOWER($2)`,
      [req.user.id, h],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "No document with this hash for your account" });
    }
    res.json({ document: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* CREATE DOCUMENT */
router.post("/", authenticate, async (req, res) => {
  try {
    const { file_name, file_type, file_size, sha256_hash } = req.body;

    if (!file_name || !sha256_hash) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const result = await pool.query(
      `INSERT INTO documents 
       (owner_id, file_name, file_type, file_size, sha256_hash) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [req.user.id, file_name, file_type, file_size, sha256_hash]
    );

    res.status(201).json({
      message: "Document created",
      document: result.rows[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;