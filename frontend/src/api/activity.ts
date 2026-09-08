export type ActivityType = 'CALL' | 'EMAIL' | 'NOTE'

export type CallStatus =
    | 'RINGING'
    | 'ANSWERED'
    | 'MISSED'
    | 'NO_ANSWER'
    | 'COMPLETED'
    | 'FAILED'

export type CallDirection =
    | 'INBOUND'
    | 'OUTBOUND'

export type FollowUpStatus =
    | 'NOT_REVIEWED'
    | 'FOLLOW_UP_REQUIRED'
    | 'RESOLVED'

export type EmailDirection =
    | 'INBOUND'
    | 'OUTBOUND'

export type EmailStatus =
    | 'UNREAD'
    | 'AWAITING_REPLY'
    | 'RESOLVED'
    | 'SENT'
    | 'FAILED'

export type PatientActivity = {
    type: ActivityType
    id: number
    occurredAt: string

    text: string | null
    staffNote: string | null

    callStatus: CallStatus | null
    callDirection: CallDirection | null
    durationSeconds: number | null
    fromNumber: string | null
    toNumber: string | null
    counterpartyNumber: string | null
    followUpStatus: FollowUpStatus | null

    emailSubject: string | null
    fromAddress: string | null
    toAddress: string | null
    emailDirection: EmailDirection | null
    emailStatus: EmailStatus | null

    removedAt: string | null
}

export async function getPatientActivity(
    patientId: number,
): Promise<PatientActivity[]> {
    const response = await fetch(
        `/api/patients/${patientId}/activity`,
    )

    if (!response.ok) {
        throw new Error(
            `Failed to load patient activity: ${response.status}`,
        )
    }

    return response.json()
}

export async function getRemovedPatientActivity(
    patientId: number,
): Promise<PatientActivity[]> {
    const response = await fetch(
        `/api/patients/${patientId}/activity/removed`,
    )

    if (!response.ok) {
        throw new Error(
            `Failed to load removed activity: ${response.status}`,
        )
    }

    return response.json()
}

export async function removePatientActivity(
    patientId: number,
    activityType: ActivityType,
    activityId: number,
): Promise<PatientActivity> {
    return changeRemovalState(
        patientId,
        activityType,
        activityId,
        'remove',
    )
}

export async function restorePatientActivity(
    patientId: number,
    activityType: ActivityType,
    activityId: number,
): Promise<PatientActivity> {
    return changeRemovalState(
        patientId,
        activityType,
        activityId,
        'restore',
    )
}

async function changeRemovalState(
    patientId: number,
    activityType: ActivityType,
    activityId: number,
    action: 'remove' | 'restore',
): Promise<PatientActivity> {
    const resource =
        getActivityResource(activityType)

    const response = await fetch(
        `/api/patients/${patientId}/${resource}/${activityId}/${action}`,
        {
            method: 'PATCH',
        },
    )

    if (!response.ok) {
        throw new Error(
            `Failed to ${action} activity: ${response.status}`,
        )
    }

    return response.json()
}

function getActivityResource(
    activityType: ActivityType,
) {
    if (activityType === 'CALL') {
        return 'calls'
    }

    if (activityType === 'EMAIL') {
        return 'emails'
    }

    return 'notes'
}
