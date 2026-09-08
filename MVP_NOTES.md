# MVP freeze notes

## Included in this build

- patient create/search/edit, including DOB and DOB-based lookup
- active/inactive phone and email contact management
- automatic call/email matching
- inbound and outbound call logging with direction-aware matching
- provider call lifecycle updates without duplicate call rows
- private/withheld inbound call retention
- historical communication preservation when a contact is removed
- chronological patient activity timeline
- standalone staff notes and call/email staff notes
- call follow-up and email attention status
- needs-attention inbox
- Inbox Today views for Dismissed / Resolved / All communication
- separate History navigation view for all-time communication browsing, date/range navigation and pagination
- unmatched communication queue
- manual patient assignment
- optional batch assignment for other unassigned communications from the same source
- optional saving of an assigned sender/caller as a patient contact
- non-destructive activity remove/restore
- non-destructive communication dismissal
- optional sender-level future-spam rule
- SMTP outbound email with automatic storage
- IMAP inbound email with automatic storage and matching
- email reply/thread matching using provider message headers
- reply from the patient activity timeline

## Still provider-dependent

### Phone

The application now has a provider-neutral inbound/outbound call lifecycle API, direction-aware patient matching, missed/no-answer attention behaviour, and private-call retention. The real practice phone provider has not been identified, so a provider adapter/webhook or call-log poller mapping is still required before live calls appear automatically.

### Email authentication

The generic SMTP/IMAP adapter is implemented. Whether it can connect directly depends on the practice mailbox provider and tenant security settings. Providers requiring OAuth/API integration need an adapter using that supported authentication method.

## Deliberately not part of the pilot MVP

- replacing the practice management/clinical system
- appointments, billing, x-rays or clinical records
- complex reporting/analytics
- multi-select filtering and advanced workflow customization
- provider-specific phone controls

## Required before real patient production use

This build is for local development/pilot validation with test data. Before storing real patient information, complete a production-hardening phase covering:

- login/authentication
- role-based authorization
- HTTPS
- secure hosting/network configuration
- production database
- controlled database migrations
- encryption/secret management
- backups and recovery testing
- monitoring and alerting
- audit events tied to authenticated staff identities
- privacy/retention policy and GDPR review
- least-privilege and revocable support access

Do not treat the local H2 database or development configuration as the final production deployment.

## Walkthrough questions intentionally deferred

The pre-demo bug/UX pass fixes broken dismissal, modal reachability, and the Edit patient save trap. The following are deliberately left for design-partner feedback rather than guessed before the walkthrough:

- whether Resolve should offer an Undo action
- whether standalone staff notes belong in Inbox/history
- richer validation/error wording

Real phone-provider ingestion and real practice mailbox credentials/authentication remain integration work after the practice confirms the workflow is useful.

## Edit patient save/cancel behaviour

Contact removals are non-destructive until the editor is saved: **Remove from contacts** stages the removal, **Save changes** commits it, and **Cancel** discards it. Explicit Add phone/Add email actions retain their existing immediate-add behaviour.
