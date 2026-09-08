# Practice Memory architecture

## Application flow

```text
React UI
   ↓ HTTP / JSON
Spring MVC Controller
   ↓
Application Service
   ↓
Spring Data Repository
   ↓
JPA / Hibernate
   ↓
H2 database (MVP)
```

Controllers define HTTP shape, services own application behaviour, repositories own persistence access, entities hold persistent state/domain rules, and DTO records define API request/response payloads.

## Core model

```text
Patient
├── identity details: name + optional date of birth
├── active/inactive PhoneNumber records
├── active/inactive EmailAddress records
└── chronological activity
    ├── CallRecord
    ├── EmailRecord
    └── PatientNote
```

Removing a phone/email from a patient's contacts deactivates that contact for **future matching**. It does not detach or rewrite communications that were already matched historically.

## Call ingestion and matching

```text
phone provider / provider adapter
        ↓
POST /api/calls/events
        ↓
providerCallId lookup
├── existing → update same call lifecycle
└── new      → create CallRecord
        ↓
direction chooses patient-facing number
├── INBOUND  → fromNumber
└── OUTBOUND → toNumber
        ↓
normalise counterparty number
        ↓
spam-sender rule?
├── yes → store UNMATCHED + DISMISSED
└── no  → search active patient phone numbers
          ├── 0 patients → UNMATCHED
          ├── 1 patient  → MATCHED
          └── 2+ patients → AMBIGUOUS
        ↓
store/update one CallRecord
```

`providerCallId` is both the deduplication key and lifecycle correlation key. A sequence such as `RINGING → ANSWERED → COMPLETED` updates one row. Terminal call outcomes are protected from late non-terminal webhook events arriving out of order.

Old call rows created before direction existed read as `INBOUND`, preserving development-database compatibility. Private/withheld inbound calls are retained with no reusable counterparty number and therefore remain unmatched until staff manually associate them.

The core is provider-neutral. The real phone system still needs a provider-specific adapter or poller that maps its native call-detail events into this contract. See `CALL_INTEGRATION.md`.

## Email outbound

```text
React composer
   ↓
POST /api/patients/{patientId}/emails
   ↓
EmailService
   ↓
OutboundEmailSender
   ↓
SMTP provider
   ↓
store EmailRecord as SENT or FAILED
```

The SMTP adapter uses a `MimeMessage`, records the actual generated `Message-ID`, and adds `In-Reply-To` / `References` when replying to an inbound email.

## Email inbound and reply matching

There are two inbound paths that converge on the same `EmailService` logic:

```text
IMAP mailbox poller ─────┐
                         ├─→ EmailService.receiveIncomingEmail(...)
provider webhook endpoint┘
```

Matching order:

```text
incoming email
   ↓
sender spam rule?
├── yes → store UNMATCHED + DISMISSED
└── no
     ↓
In-Reply-To references a stored patient email?
├── yes → match that patient
└── no
     ↓
search active EmailAddress records by sender
├── 0 patients → UNMATCHED
├── 1 patient  → MATCHED
└── 2+ patients → AMBIGUOUS
```

Provider `Message-ID` is used for idempotency so repeated IMAP scans do not duplicate the same email.

The IMAP adapter opens the mailbox read-only and scans only the most recent configurable number of messages. It does not mark messages read in the provider mailbox.

## Activity versus work-queue state

These are deliberately separate concepts.

- `removedAt`: whether an already-associated communication is hidden from the normal patient activity feed. It remains stored and can be restored.
- `CommunicationTriageStatus`: whether a communication is active in staff triage or dismissed.
- call/email business statuses: e.g. `MISSED`, `FOLLOW_UP_REQUIRED`, `UNREAD`, `AWAITING_REPLY`, `RESOLVED`.
- patient match status: `MATCHED`, `UNMATCHED`, `AMBIGUOUS`.

Dismissal does not delete a communication or rewrite patient history.

## Sender spam rules

`SpamSenderRule` is separate from a single communication's triage state.

```text
Dismiss this communication
        ↓
optional: treat future sender as spam
        ↓
SpamSenderRule(channel, sender)
        ↓
future incoming communications are stored but automatically DISMISSED
```

Restoring a dismissed communication through the staff UI also re-allows that sender.

## Production boundary

The current persistence layer uses an H2 file database and `ddl-auto=update`, which is appropriate for the local pilot build but not the intended production architecture.

Before using real patient data, production work includes at minimum:

- authenticated users and role-based access
- HTTPS
- production database plus controlled schema migrations
- external secret management
- backups and restore testing
- monitoring and structured audit identity (`performedBy`)
- retention/deletion policy and GDPR/privacy review
- least-privilege, revocable support access
- provider-specific phone/email authentication where required
