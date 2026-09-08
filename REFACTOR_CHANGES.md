# Refactor changes

This refactor freezes the current feature set around a testable practice-communication MVP rather than adding more speculative workflow features.

## Pre-demo QA polish (25 Aug 2026)

- Made `Follow up required` use the red attention treatment in Inbox so it is clearly distinct from `Not reviewed`.
- Restored the Inbox Today controls for `Dismissed`, `Resolved` and `All`; the behavior already existed but the group was hidden by CSS.

## Behaviour changes

- Simplified staff triage to **Dismiss** rather than asking staff to choose between "Spam" and "Irrelevant" for each communication.
- Added an independent optional rule to treat future communications from the same sender as spam; future records are retained but automatically dismissed.
- Dismissed communications have their own Inbox view and can be restored. Restoring also allows the sender again.
- Batch assignment excludes dismissed communications.
- Removing a patient phone/email only deactivates it for future matching; historical matched communications stay attached.
- Fixed patient creation so a phone number is optional, matching the frontend UX.

## Email completion

- Replaced the simple outbound mail adapter with MIME email sending that captures the real provider `Message-ID`.
- Added reply headers (`In-Reply-To` and `References`).
- Added `replyToEmailId` to the send flow and a Reply action in the patient timeline.
- Added automatic inbound IMAP polling under the `email` Spring profile.
- Added reply-chain patient matching before normal sender-address matching.
- Successful staff replies resolve the source inbound email.
- Kept the inbound email HTTP endpoint as an alternate/future provider-webhook adapter.

## Code / configuration cleanup

- Centralized sender-spam behaviour in `SpamSenderRuleService`.
- Kept triage separate from patient match status and call/email attention status.
- Disabled JPA Open Session in View so service/DTO boundaries are explicit.
- Added safe environment-variable templates and ignored local secret files.
- Updated project documentation around the real MVP rather than the original first call-only slice.

- New-patient creation now accepts an optional primary email address as well as an optional primary phone number.


## Call-completeness pass

- added inbound/outbound call direction
- added provider-neutral `/api/calls/events` lifecycle ingestion
- repeated provider events now update one call instead of being ignored
- added outbound `/api/calls/outgoing` convenience endpoint
- added `NO_ANSWER` outcome for outbound attempts
- patient matching now uses caller for inbound and destination for outbound
- batch assignment uses the counterparty number across both directions
- private/withheld inbound calls are retained without creating false contacts
- Needs attention includes missed inbound and no-answer outbound calls
- activity/unmatched UI now labels inbound/outbound calls and shows From/To correctly
- deactivated contacts continue to preserve historical matched calls while stopping future matching

## Demo-readiness fixes (17 Aug 2026)

- Fixed Dismiss communication compatibility for existing development H2 databases. Older schemas may still restrict `triage_status` to the pre-DISMISSED enum values; dismissal now persists the backwards-compatible `IRRELEVANT` value while the application continues to treat every non-`ACTIVE` value as dismissed.
- Kept the optional future-sender spam rule separate from the individual communication's dismissal state.
- Made the Assign patient modal vertically scrollable on shorter viewports and made its action row sticky so Cancel / Assign patient remain reachable.
- Made Edit patient's main Save action also persist a valid phone number and/or email address still sitting in the add-contact inputs.
- Promoted Add phone and Add email to the primary blue button treatment.
- Added explicit edit confirmations, including phone/email additions, primary-contact changes, contact removals, and combined main-Save changes.
- Intentionally did not add Resolved history, Undo Resolve, or patient notes to Inbox before the design-partner walkthrough; those remained workflow questions for user validation.

## Demo fix: staged contact removals

- Removing a phone number or email address in Edit patient is now staged in the frontend.
- The contact is only deactivated when **Save changes** is pressed.
- Pressing **Cancel** discards pending phone/email removals.
- Add phone / Add email keep their existing explicit-add behaviour.
- Removed an incorrect hard-coded `Email updated ✓` confirmation that could overwrite the real save confirmation.

## Patient identity / DOB pass (25 Aug 2026)

- Added optional date of birth to the patient entity/API so existing development patients remain compatible.
- Added DOB to New patient and Edit patient.
- Patient search now accepts name, DOB (`YYYY-MM-DD` or displayed `DD/MM/YYYY`) and exact patient number.
- DOB is shown beside the patient number in the patient list/details so staff have another identifier when names are common or incorrectly entered.
- This is a companion-app identifier for the demo, not a claim that Practice Memory is the practice's clinical system of record.

## v7 demo UX polish

- Date of birth can now be typed directly as `DD/MM/YYYY` when creating or editing a patient; compact `DDMMYYYY` and ISO `YYYY-MM-DD` are also accepted internally and normalised before the API call.
- Removed the browser-native DOB date picker so staff do not need to scroll backwards through years using small calendar controls.
- Main patient search placeholder is now simply `Search`; its accessible label/title still explains that name, DOB and patient number are searchable.


## Demo-ready v8 — Inbox history

- Split Inbox navigation into Work queue (`Needs attention`, `Unmatched`) and History (`Dismissed`, `Resolved`, `All`).
- History defaults to the current local day.
- Added Previous / Today / Next day navigation, custom From/To date ranges and All time.
- Added newest-first UI pagination (10 communications per page).
- `Resolved` contains calls whose follow-up status is `RESOLVED` and inbound emails whose email status is `RESOLVED`.
- `All` contains every stored call/email in the selected period, including unmatched and dismissed records.
- `Dismissed` remains restorable from history.
- Carried forward the New Patient viewport fix: scrollable modal, sticky actions, wider scrollbar and clearer input borders.

## Final MVP consolidation (25 Aug 2026)

- Kept Inbox as a pure work queue: Needs attention and Unmatched only.
- Moved the complete cross-practice communication archive into a separate History view.
- Made incoming and outgoing calls/emails visually distinct with direction badges, colour accents and explicit From/To labels.
- Kept provider lifecycle updates idempotent, while allowing a provider adapter to send only terminal outcomes when available.
- Rejected reversed status semantics: inbound calls use MISSED; outbound calls use NO_ANSWER.
- Kept matching direction-safe: inbound matches `fromNumber`, outbound matches `toNumber`.
- Outbound email attempts are now stored as FAILED when mail delivery is unavailable, rather than disappearing behind a configuration error.
- Expanded patient search to active phone numbers and email addresses.

## History activity-explorer correction

- Promoted History to a full-size top-level navigation item equal to Patients and Inbox.
- Kept Inbox exclusively for work that currently needs attention.
- Expanded History from a call/email archive into an all-activity explorer containing calls, emails and staff notes.
- Added combinable Date, Type, Call outcome and Workflow filters.
- Defaulted History to Today, all activity types and newest-first ordering.
- Kept completed calls visible in History without adding them to Inbox.
- Made History filters retractable so the default view exposes only the main Date and Type controls.
- Added a More filters control for Call outcome and Workflow, while preserving selected advanced filters and displaying their active count when collapsed.
- Left email outcomes outside the MVP filter set pending real practice feedback.
