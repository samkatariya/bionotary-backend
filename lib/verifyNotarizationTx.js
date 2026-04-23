const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

function sha256HexToBytes32(sha256Hex) {
  const h = String(sha256Hex).replace(/^0x/i, '').trim();
  if (!/^[a-fA-F0-9]{64}$/.test(h)) {
    throw new Error('document sha256_hash must be 64 hex characters');
  }
  return ethers.zeroPadValue('0x' + h.toLowerCase(), 32);
}

/**
 * Confirms tx succeeded, targets the notary contract, and on-chain record exists for docHash.
 * @param {object} opts
 * @param {string} opts.rpcUrl
 * @param {string} opts.contractAddress checksummed or hex
 * @param {string} opts.transactionHash
 * @param {string} opts.documentSha256Hex sha256 of file (64 hex, optional 0x)
 */
async function verifyNotarizationOnChain(opts) {
  const { rpcUrl, contractAddress, transactionHash, documentSha256Hex } = opts;
  const abiPath = path.join(__dirname, '..', 'contracts', 'abi', 'BioNotary.json');
  const abi = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const receipt = await provider.getTransactionReceipt(transactionHash);
  if (!receipt) {
    throw new Error('Transaction receipt not found (wrong network or pending?)');
  }
  if (receipt.status !== 1) {
    throw new Error('Transaction failed on-chain (status != success)');
  }
  const tx = await provider.getTransaction(transactionHash);
  if (!tx) {
    throw new Error('Transaction not found');
  }
  const expectedTo = contractAddress.toLowerCase();
  if (tx.to && tx.to.toLowerCase() !== expectedTo) {
    throw new Error('Transaction does not call the configured notary contract');
  }
  const contract = new ethers.Contract(contractAddress, abi, provider);
  const docBytes32 = sha256HexToBytes32(documentSha256Hex);
  const record = await contract.getRecord(docBytes32);
  const notary = record.notary ?? record[1];
  if (!notary || notary === ethers.ZeroAddress) {
    throw new Error('Contract has no notarized record for this document hash');
  }
  const bn = receipt.blockNumber;
  return {
    notary: String(notary),
    blockNumber: typeof bn === 'bigint' ? Number(bn) : bn,
  };
}

module.exports = { verifyNotarizationOnChain, sha256HexToBytes32 };
