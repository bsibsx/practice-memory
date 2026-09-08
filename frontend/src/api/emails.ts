export type SendPatientEmailsRequest = {
  subject: string
  bodyText: string
  emailAddressId: number | null
  sendToAllEmails: boolean
  replyToEmailId?: number | null
}

export type SendPatientEmailResponse = {
  id: number
  emailStatus: 'SENT' | 'FAILED'
}

export type EmailAttentionStatus =
  | 'UNREAD'
  | 'AWAITING_REPLY'
  | 'RESOLVED'

export type EmailDirection =
  | 'INBOUND'
  | 'OUTBOUND'

export type EmailPatientMatchStatus =
  | 'MATCHED'
  | 'UNMATCHED'
  | 'AMBIGUOUS'

export type CommunicationTriageStatus =
  | 'ACTIVE'
  | 'DISMISSED'
  | 'SPAM'
  | 'IRRELEVANT'

export type EmailPatient = {
  id: number
  firstName: string
  lastName: string
}

export type EmailResponse = {
  id: number
  providerMessageId: string | null
  inReplyToProviderMessageId: string | null
  fromAddress: string
  toAddress: string
  subject: string | null
  bodyText: string
  staffNote: string | null
  direction: EmailDirection
  emailStatus:
    | EmailAttentionStatus
    | 'SENT'
    | 'FAILED'
  patientMatchStatus: EmailPatientMatchStatus
  patient: EmailPatient | null
  sentAt: string
  loggedAt: string
  triageStatus: CommunicationTriageStatus
}

export type UpdateEmailStatusRequest = {
  status: EmailAttentionStatus
}

export type UpdateEmailStaffNoteRequest = {
  staffNote: string
}

export type AssignEmailPatientRequest = {
  patientId: number
  assignSameSender?: boolean
  saveSenderAsContact?: boolean
}

export type DismissCommunicationRequest = {
  treatFutureFromSenderAsSpam: boolean
}

export async function getEmails(): Promise<EmailResponse[]> {
  const response = await fetch('/api/emails')

  if (!response.ok) {
    throw new Error(`Failed to load emails: ${response.status}`)
  }

  return response.json()
}

export async function assignEmailPatient(
  emailId: number,
  request: AssignEmailPatientRequest,
): Promise<EmailResponse> {
  const response = await fetch(
    `/api/emails/${emailId}/patient`,
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
      `Failed to assign email patient: ${response.status}`,
    )
  }

  return response.json()
}

export async function dismissEmail(
  emailId: number,
  request: DismissCommunicationRequest,
): Promise<EmailResponse> {
  const response = await fetch(
    `/api/emails/${emailId}/dismiss`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    },
  )

  if (!response.ok) {
    throw new Error(`Failed to dismiss email: ${response.status}`)
  }

  return response.json()
}

export async function restoreEmail(
  emailId: number,
): Promise<EmailResponse> {
  const response = await fetch(
    `/api/emails/${emailId}/restore`,
    {
      method: 'PATCH',
    },
  )

  if (!response.ok) {
    throw new Error(`Failed to restore email: ${response.status}`)
  }

  return response.json()
}

export async function sendPatientEmails(
  patientId: number,
  request: SendPatientEmailsRequest,
): Promise<SendPatientEmailResponse[]> {
  const response = await fetch(
    `/api/patients/${patientId}/emails`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    },
  )

  if (!response.ok) {
    throw new Error(
      `Failed to send patient email: ${response.status}`,
    )
  }

  return response.json()
}

export async function updateEmailStatus(
  emailId: number,
  request: UpdateEmailStatusRequest,
): Promise<void> {
  const response = await fetch(
    `/api/emails/${emailId}/status`,
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
      `Failed to update email status: ${response.status}`,
    )
  }
}

export async function updateEmailStaffNote(
  emailId: number,
  request: UpdateEmailStaffNoteRequest,
): Promise<void> {
  const response = await fetch(
    `/api/emails/${emailId}/note`,
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
      `Failed to update email staff note: ${response.status}`,
    )
  }
}
