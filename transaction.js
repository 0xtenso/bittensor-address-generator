const bitcoin = require('bitcoinjs-lib');
const ECPair = require('ecpair');
const { ECPairFactory } = require('ecpair');
const ecc = require('tiny-secp256k1');
const axios = require('axios');
const readline = require('readline');

// Initialize ECPair with secp256k1
const ECPairAPI = ECPairFactory(ecc);

// Bitcoin testnet network
const TESTNET = bitcoin.networks.testnet;

// Blockstream testnet API
const API_BASE = 'https://blockstream.info/testnet/api';

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Utility function to get user input
function getUserInput(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

// Function to get address from private key
function getAddressFromPrivateKey(privateKeyWIF) {
  try {
    const keyPair = ECPairAPI.fromWIF(privateKeyWIF, TESTNET);
    const { address } = bitcoin.payments.p2pkh({ 
      pubkey: keyPair.publicKey, 
      network: TESTNET 
    });
    return { address, keyPair };
  } catch (error) {
    throw new Error('Invalid private key WIF format');
  }
}

// Function to get balance for an address
async function getBalance(address) {
  try {
    const response = await axios.get(`${API_BASE}/address/${address}`);
    const data = response.data;
    
    return {
      confirmed: data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum,
      unconfirmed: data.mempool_stats.funded_txo_sum - data.mempool_stats.spent_txo_sum,
      total: (data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum) + 
             (data.mempool_stats.funded_txo_sum - data.mempool_stats.spent_txo_sum)
    };
  } catch (error) {
    throw new Error(`Failed to get balance: ${error.message}`);
  }
}

// Function to get UTXOs for an address
async function getUTXOs(address) {
  try {
    const response = await axios.get(`${API_BASE}/address/${address}/utxo`);
    return response.data;
  } catch (error) {
    throw new Error(`Failed to get UTXOs: ${error.message}`);
  }
}

// Function to get recommended fee rate
async function getFeeRate() {
  try {
    const response = await axios.get(`${API_BASE}/fee-estimates`);
    // Use the fee rate for 6 blocks confirmation (medium priority)
    return Math.ceil(response.data['6'] || 2); // fallback to 2 sat/vbyte
  } catch (error) {
    console.log('Using fallback fee rate: 2 sat/vbyte');
    return 2;
  }
}

// Function to broadcast transaction
async function broadcastTransaction(txHex) {
  try {
    const response = await axios.post(`${API_BASE}/tx`, txHex, {
      headers: { 'Content-Type': 'text/plain' }
    });
    return response.data;
  } catch (error) {
    throw new Error(`Failed to broadcast transaction: ${error.response?.data || error.message}`);
  }
}

// Function to create and send transaction
async function createTransaction(fromKeyPair, toAddress, amountSats, subtractFee = false) {
  const fromAddress = bitcoin.payments.p2pkh({ 
    pubkey: fromKeyPair.publicKey, 
    network: TESTNET 
  }).address;

  // Get UTXOs
  const utxos = await getUTXOs(fromAddress);
  if (utxos.length === 0) {
    throw new Error('No UTXOs available for spending');
  }

  // Get fee rate
  const feeRate = await getFeeRate();
  
  // Create transaction builder
  const psbt = new bitcoin.Psbt({ network: TESTNET });
  
  let totalInput = 0;
  
  // Add inputs
  for (const utxo of utxos) {
    // Get transaction details for this UTXO
    const txResponse = await axios.get(`${API_BASE}/tx/${utxo.txid}/hex`);
    const txHex = txResponse.data;
    
    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      nonWitnessUtxo: Buffer.from(txHex, 'hex'),
    });
    
    totalInput += utxo.value;
    
    // Break if we have enough funds
    if (totalInput >= amountSats + 1000) break; // rough fee estimate
  }

  // Estimate transaction size (roughly)
  const estimatedSize = utxos.length * 148 + 2 * 34 + 10; // inputs + outputs + overhead
  const estimatedFee = estimatedSize * feeRate;

  let actualAmount = amountSats;
  if (subtractFee) {
    actualAmount = amountSats - estimatedFee;
    if (actualAmount <= 0) {
      throw new Error('Amount too small to cover fees');
    }
  }

  // Check if we have enough funds
  const totalNeeded = actualAmount + (subtractFee ? 0 : estimatedFee);
  if (totalInput < totalNeeded) {
    throw new Error(`Insufficient funds. Need ${totalNeeded} sats, have ${totalInput} sats`);
  }

  // Add output to recipient
  psbt.addOutput({
    address: toAddress,
    value: actualAmount,
  });

  // Add change output if needed
  const change = totalInput - actualAmount - estimatedFee;
  if (change > 546) { // dust threshold
    psbt.addOutput({
      address: fromAddress,
      value: change,
    });
  }

  // Sign all inputs
  for (let i = 0; i < psbt.inputCount; i++) {
    psbt.signInput(i, fromKeyPair);
  }

  // Finalize and extract transaction
  psbt.finalizeAllInputs();
  const tx = psbt.extractTransaction();
  
  return {
    txHex: tx.toHex(),
    txId: tx.getId(),
    size: tx.virtualSize(),
    fee: estimatedFee
  };
}

// Main function
async function main() {
  try {
    console.log('=== Bitcoin Testnet Transaction Generator ===\n');
    
    // Get private key from user
    const privateKeyWIF = await getUserInput('Enter your private key (WIF format for testnet): ');
    
    // Get address and keypair
    const { address, keyPair } = getAddressFromPrivateKey(privateKeyWIF);
    console.log(`\nYour testnet address: ${address}`);
    
    // Get balance
    console.log('\nFetching balance...');
    const balance = await getBalance(address);
    console.log(`Confirmed balance: ${balance.confirmed} satoshis (${balance.confirmed / 100000000} BTC)`);
    console.log(`Unconfirmed balance: ${balance.unconfirmed} satoshis`);
    console.log(`Total balance: ${balance.total} satoshis (${balance.total / 100000000} BTC)`);
    
    if (balance.total === 0) {
      console.log('\n No funds available. Get testnet coins from: https://coinfaucet.eu/en/btc-testnet/');
      rl.close();
      return;
    }
    
    // Ask if user wants to send a transaction
    const sendTx = await getUserInput('\nDo you want to send a transaction? (y/n): ');
    
    if (sendTx.toLowerCase() === 'y' || sendTx.toLowerCase() === 'yes') {
      // Get recipient address
      const toAddress = await getUserInput('Enter recipient testnet address: ');
      
      // Get amount
      const amountInput = await getUserInput(`Enter amount in satoshis (max: ${balance.total}): `);
      const amountSats = parseInt(amountInput);
      
      if (isNaN(amountSats) || amountSats <= 0) {
        console.log('Invalid amount');
        rl.close();
        return;
      }
      
      // Ask about fee handling
      const subtractFeeInput = await getUserInput('Subtract fee from amount? (y/n): ');
      const subtractFee = subtractFeeInput.toLowerCase() === 'y' || subtractFeeInput.toLowerCase() === 'yes';
      
      console.log('\nCreating transaction...');
      const txData = await createTransaction(keyPair, toAddress, amountSats, subtractFee);
      
      console.log(`\nTransaction created:`);
      console.log(`Transaction ID: ${txData.txId}`);
      console.log(`Size: ${txData.size} vbytes`);
      console.log(`Fee: ${txData.fee} satoshis`);
      console.log(`Raw transaction: ${txData.txHex}`);
      
      // Ask if user wants to broadcast
      const broadcast = await getUserInput('\nBroadcast transaction to testnet? (y/n): ');
      
      if (broadcast.toLowerCase() === 'y' || broadcast.toLowerCase() === 'yes') {
        console.log('\nBroadcasting transaction...');
        const txId = await broadcastTransaction(txData.txHex);
        console.log(`Transaction broadcast successfully!`);
        console.log(`Transaction ID: ${txId}`);
        console.log(`View on explorer: https://blockstream.info/testnet/tx/${txId}`);
      }
    }
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
  } finally {
    rl.close();
  }
}

// Run the application
if (require.main === module) {
  main();
}