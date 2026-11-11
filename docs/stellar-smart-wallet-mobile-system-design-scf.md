# Stellar Smart Wallet

## High-Level System Architecture

Stellar Smart Wallet is a mobile wallet that lets users access Stellar through familiar sign-in methods, review transactions in plain language, and authorize every signature without managing a secret key during normal use.

```mermaid
flowchart LR
    U["User"]

    subgraph APP["Stellar Smart Wallet — Mobile App"]
        UI["Login · Portfolio · Send/Receive<br/>Trustlines · Swap · Buy/Sell"]
        REVIEW["Transaction review<br/>and user approval"]
        UI --> REVIEW
    end

    PRIVY["Privy Embedded Wallet<br/>Authentication · User-owned wallet<br/>TEE-protected signing"]
    API["Wallet API<br/>Session · Balances · Activity<br/>Prepare XDR · Quotes/Orders"]
    STELLAR["Stellar Network<br/>Accounts · XLM/Assets · Trustlines<br/>Payments · Path payments"]
    SERVICES["Payment & KYC Services<br/>Identity verification<br/>Fiat on/off-ramp"]

    U <-->|"Use wallet and approve actions"| UI
    UI <-->|"Sign in · Restore wallet"| PRIVY
    REVIEW -->|"Authorize exact transaction hash"| PRIVY
    PRIVY -->|"Public G-address · Signature"| REVIEW
    UI <-->|"Wallet data · Transaction requests"| API
    REVIEW -->|"Signed transaction"| API
    API <-->|"Read Horizon · Submit transaction"| STELLAR
    API <-->|"KYC · Quote · Order status"| SERVICES
    SERVICES -->|"Asset settlement"| STELLAR

    classDef primary fill:#EEF4FF,stroke:#3B82F6,color:#111827,stroke-width:2px;
    classDef security fill:#F3E8FF,stroke:#8B5CF6,color:#111827,stroke-width:2px;
    classDef service fill:#ECFDF5,stroke:#10B981,color:#111827,stroke-width:2px;
    classDef network fill:#FFF7ED,stroke:#F97316,color:#111827,stroke-width:2px;
    class U,UI,REVIEW primary;
    class PRIVY security;
    class API,SERVICES service;
    class STELLAR network;
```

## How It Works

1. **Onboarding** — The user signs in with email, Google, or Apple. Privy creates or restores the user's embedded Stellar wallet and returns its public `G...` address.
2. **Wallet data** — The mobile app requests balances, assets, trustlines, and activity from the Wallet API. The API reads Stellar through Horizon and returns normalized data to the app.
3. **User-authorized transactions** — For send, trustline, swap, or withdrawal actions, the API prepares the Stellar transaction. The app shows the details, the user approves, Privy signs the exact transaction hash, and the API submits the signed transaction to Stellar.
4. **Fiat and KYC flow** — Buy/sell requests are coordinated through configured payment and KYC services. The app shows the resulting order status while asset settlement is recorded on Stellar.

## Key Architecture Principles

- **User-owned wallet:** the user controls transaction authorization.
- **Protected signing:** the mobile app and Wallet API do not store the complete Stellar secret key; Privy protects the wallet material and performs authorized signing inside its secure infrastructure.
- **No custom smart contract:** the current product uses Stellar Classic accounts, assets, trustlines, payments, and path payments through Horizon; it does not deploy a project-owned Soroban contract.
- **Clear network separation:** Mainnet and Testnet use separate network configuration, data, and transaction flows.
