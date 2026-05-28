# Security specification checklist for Firestore rules

This document specifications security models, rules of validation, and potential exploit vectors (the "Dirty Dozen" payloads) for the Pharmacy Firestore database.

## 1. Data Invariants
- **Medicine**: A medicine must possess a positive numeric `sellingPrice` and `purchasePrice`. `stock` cannot drop below zero.
- **Bill**: Must have a valid total calculation. Items purchased must have positive quantity.
- **Order**: Can only transition status from `Pending` -> `Received` or `Cancelled`. Once terminal, it is immutable. Must refer to a valid medicine name & ID.
- **Return**: Bill references and quantities must correspond to positive integer ranges.

## 2. The "Dirty Dozen" Exploit Payloads (Tested for Rejection)
1. **Malicious Role Update**: Setting user privilege claim directly on profiles to lock/unlock admin.
2. **Infinite Stock injection**: Adding stock values exceeding 1,000,000 to spoof reserves.
3. **Price Manipulation**: Submitting a medicine with a `sellingPrice` of `0` or negative.
4. **Incorrect ID Spoofing**: Document ID matching different internal field ID to confuse indices.
5. **Junk Field Poisoning**: Adding a 1MB string field to exhaustion.
6. **Negative Bill Total**: Creating a bill invoice of `-500` to skew ledgers.
7. **Bypassing Invariant**: Modifying terminal purchase order statuses from `Received` back to `Pending`.
8. **Malicious Date Override**: Backdating transaction inputs to prior years.
9. **Guest Spoofing**: Submitting anonymous cashier credentials.
10. **Suppliers Invalidation**: Registering random characters as authorized supplier fields.
11. **Negative Returns**: Making returns of `-20` to reduce stock values manually.
12. **Out of Range expiry**: Injecting non-date string values inside the expiry date field.

## 3. Security Rules Verification Test Blueprint
Rules are configured to check:
1. `request.auth != null` (Signed-in status verification)
2. `isValidId()` limits (Prevents ID Poisoning strings)
3. Direct `resource.data` restriction during reads (No unrestricted data collection reads)
