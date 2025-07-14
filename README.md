# Bitcoin Address Generator & Transaction Tool

A comprehensive Bitcoin toolkit for generating private keys, public keys, addresses, and creating transactions on both mainnet and testnet networks.

Features

- Private Key Generation: Generate cryptographically secure Bitcoin private keys
- Address Generation: Create Bitcoin addresses from private keys (compressed/uncompressed)
- Multiple Formats: Support for WIF, hex, base64, and integer representations
- Network Support: Both Bitcoin mainnet and testnet
- Transaction Creation: Build and broadcast Bitcoin transactions
- Balance Checking: Query address balances via Blockstream API
- Educational: Complete elliptic curve cryptography implementation from scratch

Files Overview

1. `private_pubic_keys_and_adress_generator.py`
A complete Bitcoin key and address generator implementing:
- Elliptic curve cryptography (secp256k1)
- Private key generation using Python's `secrets` module
- Public key derivation through point multiplication
- Address creation with proper hashing (SHA256 + RIPEMD160)
- Multiple encoding formats (WIF, Base58Check, etc.)

2. `transaction.js`
A Bitcoin transaction tool that supports:
- Network selection (mainnet/testnet)
- Balance checking
- Transaction creation and broadcasting
- Fee estimation and handling
- Address validation

Installation

Prerequisites
- Python 3.6+ (for address generator)
- Node.js 14+ (for transaction tool)

Setup

1. Clone or download the project files

2. Install Node.js dependencies:
   ```bash
   npm install
   ```

3. Python is ready to use (uses only built-in modules)

# Usage Guide

# Generating Bitcoin Keys and Addresses

Run the Python script to generate a complete set of Bitcoin keys and addresses:

```bash
python private_pubic_keys_and_adress_generator.py
```

Sample Output:
```
--------------PRIVATE KEY--------------
Private key (int): 39920032949666039652460926669504249481527718088650888599203731204066808453798
Private key (hex): 5841F01D86846A367FCB43DD907B2CFB6F9D53D73046BAA9A7B28A98B11C5AA6
Private key (base64): WEHwHYaEajZ/y0PdkHss+2+dU9cwRrqpp7KKmLEcWqY=
Private key (wallet import format WIF): 5JVA17HHiZNggYnzny6TfgimmbLZh7hg23DVdWYFo584bKeDDwM
Compressed (i.e.with suffix) Private key (wallet import format WIF): KzBGjUitnRti9ZL25tb6hkKNbpZMJ4aXDan9N9NxJMCArAsSndDU

--------------PUBLIC KEY--------------
Public key (uncompressed): 04[x-coordinate][y-coordinate]
Public key (compressed): 02/03[x-coordinate]

--------------ADDRESS--------------
Uncompressed bitcoin address: 1[address]
Compressed bitcoin address: 1[address]
```

# Creating and Broadcasting Transactions

Run the transaction script:

```bash
node transaction.js
```

Interactive Process:

1. Select Network:
   ```
   Bitcoin Transaction Generator

   Available networks:
   1. Bitcoin Mainnet
   2. Bitcoin Testnet
   
   Select network (1 for mainnet, 2 for testnet): 2
   Selected: Bitcoin Testnet
   You are using test Bitcoin - safe for testing
   Required WIF format: testnet (starts with 9 or c)
   ```

2. Enter Private Key:
   ```
   Enter your private key (testnet (starts with 9 or c)): 9[your-testnet-wif]
   
   Your Bitcoin Testnet address: mxxxxx...
   ```

3. Check Balance:
   ```
   Fetching balance...
   Confirmed balance: 100000 satoshis (0.001 BTC)
   Unconfirmed balance: 0 satoshis
   Total balance: 100000 satoshis (0.001 BTC)
   ```

4. Send Transaction:
   ```
   Do you want to send a transaction? (y/n): y
   Enter recipient Bitcoin Testnet address: mxxxxx...
   Enter amount in satoshis (max: 100000): 50000
   Subtract fee from amount? (y/n): n
   
   Creating transaction...
   Current fee rate: 2 sat/vbyte
   
   Transaction created successfully:
   Transaction ID: abc123...
   Size: 225 vbytes
   Fee: 450 satoshis (0.0000045 BTC)
   Change: 49550 satoshis (0.0004955 BTC)
   Raw transaction: 0200000001...
   
   Broadcast transaction to network? (y/n): y
   Broadcasting transaction...
   Transaction broadcast successfully!
   Transaction ID: abc123...
   View on explorer: https://blockstream.info/testnet/tx/abc123...
   ```

# Network Types

# Mainnet (Real Bitcoin)
- WIF Format: Starts with `5`, `K`, or `L`
- Addresses: Start with `1`, `3`, or `bc1`
- Explorer: https://blockstream.info/
- WARNING: Uses real Bitcoin with monetary value

# Testnet (Test Bitcoin)
- WIF Format: Starts with `9` or `c`
- Addresses: Start with `m`, `n`, or `tb1`
- Explorer: https://blockstream.info/testnet/
- Faucet: https://coinfaucet.eu/en/btc-testnet/
- Safe: No monetary value, for testing only

# Key Formats Explained

# Private Key Formats
- Integer: Raw 256-bit number
- Hex: 64-character hexadecimal string
- WIF: Wallet Import Format (Base58Check encoded)
- Base64: Base64 encoded representation

# WIF (Wallet Import Format)
```
Mainnet: 5JVA17HHiZNggYnzny6TfgimmbLZh7hg23DVdWYFo584bKeDDwM
Testnet: 92Qr8AQ4GgLroyGjdGmf3sJdVqVj7fqMcxHtaN9RpfZN8FVCMJr
```

# Security Considerations

# Important Warnings

1. Private Key Security
   - Never share your private keys
   - Store them securely and offline
   - Private keys = full control over funds

2. Mainnet vs Testnet
   - Always test on testnet first
   - Mainnet transactions use real Bitcoin
   - Testnet is for development and testing

3. Address Validation
   - Always verify recipient addresses
   - Use the correct network (mainnet/testnet)
   - Double-check before broadcasting

# Best Practices

- Use testnet for development and learning
- Keep private keys offline and encrypted
- Verify all transaction details before broadcasting
- Start with small amounts on mainnet
- Use proper random number generation

# API Dependencies

The transaction tool uses the Blockstream API:
- Mainnet: https://blockstream.info/api
- Testnet: https://blockstream.info/testnet/api

Functions:
- Balance checking: `/address/{address}`
- UTXO retrieval: `/address/{address}/utxo`
- Fee estimation: `/fee-estimates`
- Transaction broadcasting: `/tx`

# Dependencies

# Node.js Packages
```json
{
  "bitcoinjs-lib": "^6.1.5",
  "ecpair": "^2.1.0",
  "tiny-secp256k1": "^2.2.3",
  "axios": "^1.6.0"
}
```

# Python Modules
- `secrets` (built-in)
- `hashlib` (built-in)
- `base64` (built-in)

# Educational Value

This project demonstrates:
- Elliptic Curve Cryptography: Complete secp256k1 implementation
- Bitcoin Key Derivation: From private key to address
- Cryptographic Hashing: SHA256 and RIPEMD160
- Base58 Encoding: Bitcoin's address encoding
- Transaction Construction: UTXO management and signing
- Network Protocols: API interaction and broadcasting

# Common Issues

1. "Invalid private key WIF format"
   - Ensure correct WIF format for selected network
   - Mainnet: starts with 5, K, L
   - Testnet: starts with 9, c

2. "No UTXOs available"
   - Address has no funds
   - Use testnet faucet for test coins
   - Check address balance first

3. "Insufficient funds"
   - Amount + fees exceeds balance
   - Try smaller amount or subtract fees

4. Network connection errors
   - Check internet connection
   - Blockstream API might be temporarily down
   - Try again after a few minutes