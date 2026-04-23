const { test } = require('node:test');
const assert = require('node:assert');
const { sha256HexToBytes32 } = require('../lib/verifyNotarizationTx');

test('sha256HexToBytes32 accepts 64 hex chars', () => {
  const hex = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const b32 = sha256HexToBytes32(hex);
  assert.strictEqual(b32.length, 66);
  assert.ok(b32.startsWith('0x'));
});

test('sha256HexToBytes32 accepts 0x prefix', () => {
  const hex =
    '0x' + 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  sha256HexToBytes32(hex);
});
