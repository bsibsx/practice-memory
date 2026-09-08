# Email setup

Practice Memory's email MVP has two adapters:

- **SMTP** for sending mail.
- **IMAP** for automatically importing received mail.

Both are enabled by the Spring `email` profile. The existing `POST /api/emails/incoming` endpoint remains available for a future provider webhook/integration.

## 1. Copy the example settings

Use `.env.example` as the checklist for required environment variables. Do **not** put real credentials into Git.

Required outbound values:

```text
SPRING_PROFILES_ACTIVE=email
PRACTICE_EMAIL_FROM=practice@example.com
PRACTICE_MAIL_HOST=smtp.example.com
PRACTICE_MAIL_PORT=587
PRACTICE_MAIL_USERNAME=practice@example.com
PRACTICE_MAIL_PASSWORD=...
PRACTICE_MAIL_AUTH=true
PRACTICE_MAIL_STARTTLS=true
```

To automatically receive mail, also configure:

```text
PRACTICE_EMAIL_INBOUND_ENABLED=true
PRACTICE_IMAP_HOST=imap.example.com
PRACTICE_IMAP_PORT=993
PRACTICE_IMAP_USERNAME=practice@example.com
PRACTICE_IMAP_PASSWORD=...
PRACTICE_IMAP_FOLDER=INBOX
PRACTICE_IMAP_POLL_MS=60000
```

## 2. Set environment variables on Windows PowerShell

Example for the current terminal only:

```powershell
$env:SPRING_PROFILES_ACTIVE="email"
$env:PRACTICE_EMAIL_FROM="practice@example.com"
$env:PRACTICE_MAIL_HOST="smtp.example.com"
$env:PRACTICE_MAIL_PORT="587"
$env:PRACTICE_MAIL_USERNAME="practice@example.com"
$env:PRACTICE_MAIL_PASSWORD="replace-with-real-secret"
$env:PRACTICE_MAIL_AUTH="true"
$env:PRACTICE_MAIL_STARTTLS="true"

$env:PRACTICE_EMAIL_INBOUND_ENABLED="true"
$env:PRACTICE_IMAP_HOST="imap.example.com"
$env:PRACTICE_IMAP_PORT="993"
$env:PRACTICE_IMAP_USERNAME="practice@example.com"
$env:PRACTICE_IMAP_PASSWORD="replace-with-real-secret"
$env:PRACTICE_IMAP_FOLDER="INBOX"
```

Then start:

```powershell
.\gradlew.bat bootRun
```

## 3. Test the complete loop

Use a test patient with a real email address that you control.

1. Open that patient's activity page.
2. Send an email from Practice Memory.
3. Confirm the outbound email appears automatically in the timeline as `SENT`.
4. Reply from the recipient mailbox.
5. Wait for the IMAP polling interval (default 60 seconds).
6. Confirm the inbound reply appears in the same patient's timeline.
7. Click `Reply` on the inbound activity item and send a response.
8. Confirm the outgoing reply is stored and the inbound item becomes resolved.

The app stores outbound `Message-ID` values and uses `In-Reply-To` / `References` headers for reply continuity. Inbound replies can therefore be matched through the thread as well as by active patient email address.

## Provider authentication caveat

The SMTP/IMAP implementation works with mailboxes that permit standard SMTP/IMAP authentication using the configured credential (including an app password where the provider supports it).

Some organizations disable password-based SMTP/IMAP entirely. In particular, a Microsoft 365 tenant may require OAuth/provider-specific integration depending on its security policy. Google Workspace/Gmail may also require provider-side configuration or an app password rather than the account's normal password.

If the practice's mailbox does not allow this authentication model, keep the domain service as-is and replace the adapter with the provider's supported OAuth/API/webhook integration. Do not weaken the mailbox's security policy to make the MVP connect.

## Inbound polling behaviour

- Mailbox is opened read-only.
- Practice Memory does not mark provider messages as read.
- Only the newest configurable number of messages is scanned (`PRACTICE_IMAP_SCAN_LIMIT`, default `100`).
- Repeated scans are safe because stored provider `Message-ID` values are idempotent.
- Messages sent from the configured practice address and found in the inbox are ignored because outbound mail is already recorded at send time.

## Security

Do not commit passwords, app passwords, tokens or `.env` files. The repository ignores local `.env*` files except `.env.example`.

Do not connect a production patient mailbox until the application has the authentication, deployment and privacy controls listed in `MVP_NOTES.md`.
