const express = require("express");
const pool = require("../db");
const authenticate = require("../middleware/authMiddleware");

const router = express.Router();

/* CREATE NOTARIZATION */
router.post("/", authenticate, async (req, res) => {
  try {
    const {
      document_id,
      transaction_hash,
      blockchain_network,
      contract_address,
      block_number,
      gas_used
    } = req.body;

    if (!document_id || !transaction_hash) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const result = await pool.query(
      `INSERT INTO notarizations 
       (document_id, notary_id, blockchain_network, contract_address,
        transaction_hash, block_number, gas_used, status, confirmed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'confirmed', NOW())
       RETURNING *`,
      [
        document_id,
        req.user.id,
        blockchain_network,
        contract_address,
        transaction_hash,
        block_number,
        gas_used
      ]
    );

    // Update document status
    await pool.query(
      `UPDATE documents 
       SET notarization_status = 'confirmed'
       WHERE id = $1`,
      [document_id]
    );

    res.status(201).json({
      message: "Notarization stored",
      notarization: result.rows[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;