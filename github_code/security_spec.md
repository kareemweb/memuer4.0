# Security Specification for Memuer

## Data Invariants
1. A **User** profile must belong to the authenticated user and have a valid public key for E2EE.
2. A **Chat** must have at least two participants.
3. A **Message** must belong to an existing chat where the sender is a participant.
4. **End-to-End Encryption** is enforced; decryption occurs client-side, but metadata must be valid.

## The Dirty Dozen Payloads (Rejection Targets)
1. **Identity Theft**: Creating a user profile with a different UID.
2. **Key Spoofing**: Updating another user's public key.
3. **Shadow Field Injection**: Adding `isAdmin: true` to a user profile.
4. **Chat Hijacking**: Adding oneself to a private chat without an invite/friendship.
5. **Orphaned Message**: Sending a message to a chat ID that doesn't exist.
6. **Impersonation**: Sending a message as another user.
7. **Junk ID Poisoning**: Creating a chat with a 1MB string as the ID.
8. **PII Leak**: A non-friend attempting to 'get' a user's private email (if stored).
9. **History Manipulation**: Updating an old message's content.
10. **Signal Spam**: Sending 1000 friend requests in a second.
11. **State Skipping**: Accepting a friend request that doesn't exist.
12. **System Spoof**: Sending a message as 'memuer-ai' from a client.

## Test Runner (Logic Verification)
The `firestore.rules` will be verified against these patterns.
