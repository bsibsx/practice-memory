export type UpdateCallNoteRequest = {
  note: string
}

export type CallFollowUpStatus =
  | 'NOT_REVIEWED'
  | 'FOLLOW_UP_REQUIRED'
  | 'RESOLVED'

export type UpdateCallFollowUpRequest = {
  followUpStatus: CallFollowUpStatus
}

export type CallPatientMatchStatus =
  | 'MATCHED'
  | 'UNMATCHED'
  | 'AMBIGUOUS'

export type CommunicationTriageStatus =
  | 'ACTIVE'
  | 'DISMISSED'
  | 'SPAM'
  | 'IRRELEVANT'

export type CallDirection = 'INBOUND' | 'OUTBOUND'

export type CallStatus =
  | 'RINGING'
  | 'ANSWERED'
  | 'MISSED'
  | 'NO_ANSWER'
  | 'COMPLETED'
  | 'FAILED'

export type CallPatient = {
  id: number
  firstName: string
  lastName: string
}

export type CallResponse = {
  id: number
  providerCallId: string
  direction: CallDirection
  fromNumber: string | null
  toNumber: string | null
  counterpartyNumber: string | null
  startedAt: string
  loggedAt: string
  durationSeconds: number | null
  callStatus: CallStatus
  patientMatchStatus: CallPatientMatchStatus
  patient: CallPatient | null
  note: string | null
  followUpStatus: CallFollowUpStatus
  triageStatus: CommunicationTriageStatus
}

export type AssignCallPatientRequest = {
  patientId: number
  assignSameCaller?: boolean
  saveCallerAsContact?: boolean
}

export type DismissCommunicationRequest = {
  treatFutureFromSenderAsSpam: boolean
}

export type CallProviderEventRequest = {
  providerCallId: string
  direction: CallDirection
  fromNumber?: string | null
  toNumber?: string | null
  startedAt: string
  callStatus: CallStatus
  durationSeconds?: number | null
}

export async function getCalls(): Promise<CallResponse[]> {
  const response = await fetch('/api/calls')

  if (!response.ok) {
    throw new Error(`Failed to load calls: ${response.status}`)
  }

  return response.json()
}

export async function recordCallProviderEvent(
  request: CallProviderEventRequest,
): Promise<CallResponse> {
  const response = await fetch('/api/calls/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new Error(`Failed to record call event: ${response.status}`)
  }

  return response.json()
}

export async function assignCallPatient(
  callId: number,
  request: AssignCallPatientRequest,
): Promise<CallResponse> {
  const response = await fetch(
    `/api/calls/${callId}/patient`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    },
  )

  if (!response.ok) {
    throw new Error(
      `Failed to assign call patient: ${response.status}`,
    )
  }

  return response.json()
}

export async function dismissCall(
  callId: number,
  request: DismissCommunicationRequest,
): Promise<CallResponse> {
  const response = await fetch(
    `/api/calls/${callId}/dismiss`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    },
  )

  if (!response.ok) {
    throw new Error(`Failed to dismiss call: ${response.status}`)
  }

  return response.json()
}

export async function restoreCall(
  callId: number,
): Promise<CallResponse> {
  const response = await fetch(
    `/api/calls/${callId}/restore`,
    {
      method: 'PATCH',
    },
  )

  if (!response.ok) {
    throw new Error(`Failed to restore call: ${response.status}`)
  }

  return response.json()
}

export async function updateCallNote(
  callId: number,
  request: UpdateCallNoteRequest,
): Promise<void> {
  const response = await fetch(
    `/api/calls/${callId}/note`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    },
  )

  if (!response.ok) {
    throw new Error(
      `Failed to update call note: ${response.status}`,
    )
  }
}

export async function updateCallFollowUp(
  callId: number,
  request: UpdateCallFollowUpRequest,
): Promise<void> {
  const response = await fetch(
    `/api/calls/${callId}/follow-up`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    },
  )

  if (!response.ok) {
    throw new Error(
      `Failed to update call follow-up status: ${response.status}`,
    )
  }
}
