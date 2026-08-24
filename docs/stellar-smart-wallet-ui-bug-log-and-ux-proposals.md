# Stellar Smart Wallet - Internal UI Testing Notes

## Overview

During internal testing, minor UI issues were usually fixed immediately instead of being recorded in a formal bug tracker. This document is a short retrospective summary of common findings and UX feedback from the founders.

## UI bugs identified during self-testing

| Issue | Description | Resolution | Status |
| --- | --- | --- | --- |
| Loading feedback | Some wallet actions did not clearly show that processing was in progress. | Added loading indicators and disabled repeated taps while processing. | Resolved |
| Popup behavior | A popup could occasionally remain above the current screen or block interaction. | Improved popup dismissal and overlay behavior. | Resolved |
| Session loading | The wallet could briefly appear empty while restoring a saved login session. | Added a clearer session-restoring state and loading placeholders. | Resolved |
| Transaction history | Recent transactions were not always refreshed immediately after returning to the app. | Refresh transaction history when the app becomes active again. | Resolved |
| Long text | Email addresses, wallet addresses, or transaction hashes could be too long for small screens. | Added masking, truncation, and copy actions where appropriate. | Resolved |
| Error messages | Some error messages did not clearly tell users what to do next. | Replaced generic messages with shorter, more actionable guidance. | Improved |
| Bottom sheets | Modal and bottom-sheet spacing was not fully consistent between screens. | Standardized layout, close behavior, backdrop, and safe-area spacing. | Resolved |

## UX optimization proposals from the founders

- Keep long-running wallet actions non-blocking and always show progress.
- Clearly display whether the wallet is using Mainnet or Testnet.
- Show the amount, estimated fee, slippage, and destination before transaction confirmation.
- Make login session restoration and wallet initialization easier to understand.
- Use consistent empty, loading, success, and error states across all screens.
- Keep advanced wallet tools separate from the main send, receive, and swap actions.
- Show a clear success screen with the transaction hash and explorer link.
- Maintain a short QA note and screen recording for future releases.

## Note

This is a retrospective internal testing summary, not a production incident report or an external usability study. It contains no customer data, credentials, or private keys.
