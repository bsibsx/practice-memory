export type CreatePatientNoteRequest = {
    text: string
}

export async function createPatientNote(
    patientId: number,
    request: CreatePatientNoteRequest,
): Promise<void> {
    const response = await fetch(
        `/api/patients/${patientId}/notes`,
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
            `Failed to create note: ${response.status}`,
        )
    }
}

export async function updatePatientNote(
    patientId: number,
    noteId: number,
    request: CreatePatientNoteRequest,
): Promise<void> {
    const response = await fetch(
        `/api/patients/${patientId}/notes/${noteId}`,
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
            `Failed to update note: ${response.status}`,
        )
    }
}