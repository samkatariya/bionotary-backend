const pool = require('../db');

/**
 * Creates all application tables if missing (idempotent).
 * Safe to run on every server start and via `npm run migrate`.
 */
async function ensureSchema() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(200) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        phone VARCHAR(40),
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'user',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        file_name VARCHAR(512) NOT NULL,
        file_type VARCHAR(100),
        file_size BIGINT,
        sha256_hash VARCHAR(128) NOT NULL,
        notarization_status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_id);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_documents_sha256 ON documents(sha256_hash);`,
    );

    await client.query(`
      CREATE TABLE IF NOT EXISTS notarizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        notary_id UUID NOT NULL REFERENCES users(id),
        blockchain_network VARCHAR(64),
        contract_address VARCHAR(66),
        transaction_hash VARCHAR(78) NOT NULL,
        block_number BIGINT,
        gas_used BIGINT,
        status VARCHAR(50) DEFAULT 'confirmed',
        confirmed_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_notarizations_tx UNIQUE (transaction_hash)
      );
    `);
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_notarizations_document ON notarizations(document_id);`,
    );

    await client.query(`
      CREATE TABLE IF NOT EXISTS applicants (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        first_name VARCHAR(100) NOT NULL,
        middle_name VARCHAR(100),
        last_name VARCHAR(100) NOT NULL,
        aadhaar VARCHAR(12) NOT NULL,
        email VARCHAR(150) NOT NULL,
        pan VARCHAR(10),
        phone VARCHAR(20),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_biometrics (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        r307_template_id INTEGER NOT NULL,
        enrolled_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_user_biometrics_template UNIQUE (r307_template_id)
      );
    `);

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { ensureSchema };
