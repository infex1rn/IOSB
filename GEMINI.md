# IOSB Project Mandates

- **No Mock Code:** All implementations must be functional. Do not use "to be implemented" placeholders or "Phase X" strings.
- **No Seed Data:** Do not include mock database seeding in the codebase.
- **Real Logic:** All command handlers must interact with the actual database or API services.
- **Zero Hardcoding:** NO phone numbers, names, IDs, or bot names should be hardcoded. Everything must be fetched from `process.env`.
- **Security:** Rigorously protect session data and environment variables.
- **Atomic Transactions:** All wallet operations must use the `adjust_balance` RPC to prevent race conditions.
