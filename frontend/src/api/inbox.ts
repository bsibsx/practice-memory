import type { PatientActivity } from './activity'

export type InboxItem = {
    patientId: number
    patientFirstName: string
    patientLastName: string
    activity: PatientActivity
}

export async function getInbox(): Promise<InboxItem[]> {
    const response = await fetch(
        '/api/inbox',
    )

    if (!response.ok) {
        throw new Error(
            `Failed to load inbox: ${response.status}`,
        )
    }

    return response.json()
}