const bitcoin = require('bitcoinjs-lib');
const ECPair = require('ecpair');
const { ECPairFactory } = require('ecpair');
const ecc = require('tiny-secp256k1');
const axios = require('axios');
const readline = require('readline');

// Initialize ECPair with secp256k1
const ECPairAPI = ECPairFactory(ecc);

// Network configurations
const NETWORKS = {
  mainnet: {
    network: bitcoin.networks.bitcoin,
    apiBase: 'https://blockstream.info/api',
    name: 'Bitcoin Mainnet',
    faucetUrl: null,
    wifPrefix: 'mainnet (starts with 5, K, or L)'
  },
  testnet: {
    network: bitcoin.networks.testnet,
    apiBase: 'https://blockstream.info/testnet/api',
    name: 'Bitcoin Testnet',
    faucetUrl: 'https://coinfaucet.eu/en/btc-testnet/',
    wifPrefix: 'testnet (starts with 9 or c)'
  }
};

let currentNetwork = null;
let API_BASE = null;

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

// Function to select network
async function selectNetwork() {
  console.log('Available networks:');
  console.log('1. Bitcoin Mainnet');
  console.log('2. Bitcoin Testnet');
  
  const choice = await getUserInput('\nSelect network (1 for mainnet, 2 for testnet): ');
  
  if (choice === '1' || choice.toLowerCase() === 'mainnet') {
    currentNetwork = NETWORKS.mainnet;
    API_BASE = NETWORKS.mainnet.apiBase;
    console.log(`Selected: ${NETWORKS.mainnet.name}`);
    console.log('WARNING: You are using REAL BITCOIN on mainnet!');
  } else if (choice === '2' || choice.toLowerCase() === 'testnet') {
    currentNetwork = NETWORKS.testnet;
    API_BASE = NETWORKS.testnet.apiBase;
    console.log(`Selected: ${NETWORKS.testnet.name}`);
    console.log('You are using test Bitcoin - safe for testing');
  } else {
    throw new Error('Invalid network selection');
  }
  
  console.log(`Required WIF format: ${currentNetwork.wifPrefix}\n`);
}

// Function to get address from private key
function getAddressFromPrivateKey(privateKeyWIF) {
  try {
    const keyPair = ECPairAPI.fromWIF(privateKeyWIF, currentNetwork.network);
    const { address } = bitcoin.payments.p2pkh({ 
      pubkey: keyPair.publicKey, 
      network: currentNetwork.network 
    });
    return { address, keyPair };
  } catch (error) {
    throw new Error(`Invalid private key WIF format for ${currentNetwork.name}`);
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
    const feeRate = Math.ceil(response.data['6'] || response.data['3'] || 2);
    return feeRate;
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
    network: currentNetwork.network 
  }).address;

  // Get UTXOs
  const utxos = await getUTXOs(fromAddress);
  if (utxos.length === 0) {
    throw new Error('No UTXOs available for spending');
  }

  // Get fee rate
  const feeRate = await getFeeRate();
  console.log(`Current fee rate: ${feeRate} sat/vbyte`);
  
  // Create transaction builder
  const psbt = new bitcoin.Psbt({ network: currentNetwork.network });
  
  let totalInput = 0;
  let inputCount = 0;
  
  // Add inputs (only use what we need)
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
    inputCount++;
    
    // Rough estimate: if we have enough for amount + reasonable fee, break
    const roughFeeEstimate = (inputCount * 148 + 2 * 34 + 10) * feeRate;
    if (totalInput >= amountSats + roughFeeEstimate + 1000) break;
  }

  // More accurate transaction size estimation
  const estimatedSize = inputCount * 148 + 2 * 34 + 10; // inputs + outputs + overhead
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
  const dustThreshold = 546; // Bitcoin dust threshold
  
  if (change > dustThreshold) {
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
    fee: estimatedFee,
    change: change > dustThreshold ? change : 0
  };
}

// Function to validate Bitcoin address for current network
function validateAddress(address) {
  try {
    bitcoin.address.toOutputScript(address, currentNetwork.network);
    return true;
  } catch (error) {
    return false;
  }
}

// Main function
async function main() {
  try {
    console.log('Bitcoin Transaction Generator\n');
    
    // Select network first
    await selectNetwork();
    
    // Get private key from user
    const privateKeyWIF = await getUserInput(`Enter your private key (${currentNetwork.wifPrefix}): `);
    
    // Get address and keypair
    const { address, keyPair } = getAddressFromPrivateKey(privateKeyWIF);
    console.log(`\n Your ${currentNetwork.name} address: ${address}`);
    
    // Get balance
    console.log('\n Fetching balance...');
    const balance = await getBalance(address);
    
    const btcBalance = balance.total / 100000000;
    console.log(`Confirmed balance: ${balance.confirmed} satoshis (${balance.confirmed / 100000000} BTC)`);
    console.log(`Unconfirmed balance: ${balance.unconfirmed} satoshis`);
    console.log(`Total balance: ${balance.total} satoshis (${btcBalance} BTC)`);
    
    if (balance.total === 0) {
      if (currentNetwork.faucetUrl) {
        console.log(`\nNo funds available. Get test coins from: ${currentNetwork.faucetUrl}`);
      } else {
        console.log('\nNo funds available. You need to deposit Bitcoin to this address.');
      }
      rl.close();
      return;
    }
    
    // Ask if user wants to send a transaction
    const sendTx = await getUserInput('\n Do you want to send a transaction? (y/n): ');
    
    if (sendTx.toLowerCase() === 'y' || sendTx.toLowerCase() === 'yes') {
      // Get recipient address
      let toAddress;
      while (true) {
        toAddress = await getUserInput(`Enter recipient ${currentNetwork.name} address: `);
        if (validateAddress(toAddress)) {
          break;
        } else {
          console.log(`Invalid address for ${currentNetwork.name}. Please try again.`);
        }
      }
      
      // Get amount
      const amountInput = await getUserInput(`Enter amount in satoshis (max: ${balance.total}): `);
      const amountSats = parseInt(amountInput);
      
      if (isNaN(amountSats) || amountSats <= 0) {
        console.log('Invalid amount');
        rl.close();
        return;
      }
      
      if (amountSats > balance.total) {
        console.log('Amount exceeds available balance');
        rl.close();
        return;
      }
      
      // Ask about fee handling
      const subtractFeeInput = await getUserInput('Subtract fee from amount? (y/n): ');
      const subtractFee = subtractFeeInput.toLowerCase() === 'y' || subtractFeeInput.toLowerCase() === 'yes';
      
      console.log('\nCreating transaction...');
      const txData = await createTransaction(keyPair, toAddress, amountSats, subtractFee);
      
      console.log(`\nTransaction created successfully:`);
      console.log(`Transaction ID: ${txData.txId}`);
      console.log(`Size: ${txData.size} vbytes`);
      console.log(`Fee: ${txData.fee} satoshis (${txData.fee / 100000000} BTC)`);
      if (txData.change > 0) {
        console.log(`Change: ${txData.change} satoshis (${txData.change / 100000000} BTC)`);
      }
      console.log(`Raw transaction: ${txData.txHex.substring(0, 100)}...`);
      
      // Ask if user wants to broadcast
      const broadcast = await getUserInput('\n📡 Broadcast transaction to network? (y/n): ');
      
      if (broadcast.toLowerCase() === 'y' || broadcast.toLowerCase() === 'yes') {
        console.log('\nBroadcasting transaction...');
        const txId = await broadcastTransaction(txData.txHex);
        console.log(`Transaction broadcast successfully!`);
        console.log(`Transaction ID: ${txId}`);
        
        const explorerUrl = currentNetwork.network === bitcoin.networks.bitcoin 
          ? `https://blockstream.info/tx/${txId}`
          : `https://blockstream.info/testnet/tx/${txId}`;
        console.log(`View on explorer: ${explorerUrl}`);
      } else {
        console.log('\nTransaction created but not broadcast. You can broadcast the raw transaction manually.');
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