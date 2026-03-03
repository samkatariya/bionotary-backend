const express = require("express");
const pool = require("../db");
const authenticate = require("../middleware/authMiddleware");

const router = express.Router();

/* LIST MY DOCUMENTS */
router.get("/my-documents", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM documents WHERE owner_id = $1 ORDER BY created_at DESC",
      [req.user.id]
    );
    res.json({ documents: result.rows });
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