G-Naira (gNGN) - Digital Naira Token
A secure, governance-enabled digital representation of the Nigerian Naira on blockchain**

[🔗 View on BaseScan](https://sepolia.basescan.org/address/0x6C1C7f8B805394a6f342a86f63124b64a79c75A4) • [📖 Documentation](#-documentation) • [🚀 Quick Start](#-quick-start)
🌟 Overview

G-Naira (gNGN) is a sophisticated ERC20 token that digitizes the Nigerian Naira on the blockchain. Built with enterprise-grade security features and multi-signature governance, it provides a stable foundation for digital financial transactions while maintaining full regulatory compliance capabilities.
✨ Key Features

- 🛡️ Multi-Signature Security - 6-owner wallet with 3-signature requirement
- 🏛️ Governance-Controlled - All minting operations require consensus
- ⏸️ Emergency Controls- Pausable transfers for security incidents
- 🔐 Role-Based Access - Granular permission system
- 📊 ERC20 Compliant - Full compatibility with the existing DeFi ecosystem
- 🌐 Layer 2 Optimized - Deployed on Base for low-cost transactions


 🏗️ Architecture
 Smart Contracts

 🪙 GNaira Token Contract
- Address: `0x6C1C7f8B805394a6f342a86f63124b64a79c75A4`
- Name: G-Naira
- Symbol: gNGN
- Decimals: 18
- Standard: ERC20 with OpenZeppelin extensions

 🔐 MultiSig Governance Wallet
- Address: `0x5Da2368ad035a1A8b9Ef53a2D5EFA83567b95361`
- Owners: 6 authorized signers
- Threshold: 3 confirmations required
- Purpose: Controls all administrative functions



 🔒 Security Features

 Multi-Layer Protection

1. Multi-Signature Governance
   - 6 trusted owners
   - 3-signature threshold
   - Time-locked critical operations

2. Emergency Controls
   - Pausable transfers
   - Role-based access control
   - Upgradeable governance structure

3. Code Security
   - OpenZeppelin battle-tested contracts
   - Comprehensive test coverage
   - Automated security checks


 📋 Project Structure

```
G-Naira/
├── contracts/
│   ├── GNaira.sol              # Main token contract
│   ├── MultiSigWallet.sol      # Governance wallet
│   └── interfaces/             # Contract interfaces
├── scripts/
│   ├── deploy.js               # Deployment script
│   ├── verify.js               # Verification script
│   └── interact.js             # Interaction examples
├── test/
│   ├── GNaira.test.js         # Token tests
│   └── MultiSigWallet.test.js  # Governance tests
├── docs/                       # Documentation
├── hardhat.config.js           # Hardhat configuration
└── package.json               # Dependencies
