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

    const tx = String(transaction_hash).trim();
    if (!/^0x[a-fA-F0-9]{64}$/.test(tx)) {
      return res.status(400).json({
        message:
          "transaction_hash must be a full 32-byte hex hash: 0x followed by 64 hex characters (no ellipsis).",
      });
    }

    const docCheck = await pool.query(
      "SELECT id FROM documents WHERE id = $1 AND owner_id = $2",
      [document_id, req.user.id]
    );
    if (docCheck.rows.length === 0) {
      return res.status(404).json({
        message:
          "No document with this id for your account. Use GET /documents/my-documents with the same JWT and send the exact id from that response.",
      });
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
        tx,
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
    res.status(500).json({
      message: "Server error",
      detail: err.message,
    });
  }
});

module.exports = router;