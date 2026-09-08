# Call integration contract

Practice Memory now models a call as a lifecycle, not just a one-time inbound event. The real phone-provider adapter should translate the provider's call-detail/webhook payloads into the provider-neutral endpoint below.

## Preferred provider-neutral endpoint

`POST /api/calls/events`

Example inbound event:

```json
{
  "providerCallId": "provider-call-123",
  "direction": "INBOUND",
  "fromNumber": "+353871234567",
  "toNumber": "+35315550100",
  "startedAt": "2026-08-13T14:20:00Z",
  "callStatus": "MISSED",
  "durationSeconds": 0
}
```

Example outbound completion:

```json
{
  "providerCallId": "provider-call-456",
  "direction": "OUTBOUND",
  "fromNumber": "+35315550100",
  "toNumber": "+353871234567",
  "startedAt": "2026-08-13T14:30:00Z",
  "callStatus": "COMPLETED",
  "durationSeconds": 92
}
```

Repeated events with the same `providerCallId` update the existing record. For example, a provider can send `RINGING`, then `ANSWERED`, then `COMPLETED` without creating three calls. Late non-terminal events do not overwrite an already terminal call outcome.

The application does not require every lifecycle event. If the provider can send only final outcomes, one `MISSED` or `COMPLETED` event is sufficient for an inbound call, and one `NO_ANSWER` or `COMPLETED` event is sufficient for an outbound call. This is the preferred adapter mapping when those final webhooks are available.

Direction always describes the practice's perspective:

- `INBOUND`: patient/caller number is `fromNumber`; practice number is `toNumber`.
- `OUTBOUND`: practice number is `fromNumber`; patient/destination number is `toNumber`.

To prevent reversed records, inbound `NO_ANSWER` and outbound `MISSED` are rejected. Use inbound `MISSED` and outbound `NO_ANSWER`.

## Supported outcomes

- `RINGING`
- `ANSWERED`
- `MISSED`
- `NO_ANSWER`
- `COMPLETED`
- `FAILED`

The provider adapter should map the provider's native terminology onto the closest value. Extra provider-specific statuses should stay inside the adapter rather than leaking into the core application unless the practice proves it needs them.

## Matching rule

The patient-facing/counterparty number depends on direction:

- inbound: `fromNumber`
- outbound: `toNumber`

That number is normalized and matched only against **active** patient phone numbers. Deactivating a patient's contact stops future automatic matching but does not detach historical calls that were already matched.

## Private / withheld callers

Inbound calls with no usable caller number are still stored. `fromNumber` may be omitted or mapped from common provider values such as `private`, `withheld`, `anonymous`, `restricted`, or `unknown`. These calls remain unmatched and can still be manually associated with a patient if staff know who called.

Because no reusable number exists, the UI does not offer “save as contact” or a sender-level future-spam rule for a private/withheld call.

## Attention behaviour

The default Needs attention queue includes:

- inbound `MISSED` calls that are still `NOT_REVIEWED`
- outbound `NO_ANSWER` calls that are still `NOT_REVIEWED`
- any call explicitly marked `FOLLOW_UP_REQUIRED`

Completed outbound calls are logged in the patient timeline but do not create unnecessary Inbox work.

## Convenience endpoints

For development/manual provider mapping, these also exist:

- `POST /api/calls/incoming`
- `POST /api/calls/outgoing`

The preferred production integration is still a provider-specific adapter feeding `/api/calls/events`.

## Not implemented until the provider is known

The core deliberately does not guess at provider-specific features such as click-to-call, extension/agent identity, call recordings, voicemail URLs, transfers, or provider authentication. Once the practice's phone system is identified, only features supported by that provider and useful to the practice should be mapped in.
