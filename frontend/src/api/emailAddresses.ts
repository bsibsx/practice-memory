export type EmailAddress = {
    id: number
    address: string
    primaryAddress: boolean
    active: boolean
}

export type AddEmailAddressRequest = {
    address: string
}

export async function getPatientEmailAddresses(
    patientId: number,
): Promise<EmailAddress[]> {
    const response = await fetch(
        `/api/patients/${patientId}/email-addresses`,
    )

    if (!response.ok) {
        throw new Error(
            `Failed to load patient email addresses: ${response.status}`,
        )
    }

    return response.json()
}

export async function addEmailAddress(
    patientId: number,
    request: AddEmailAddressRequest,
): Promise<EmailAddress> {
    const response = await fetch(
        `/api/patients/${patientId}/email-addresses`,
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
            `Failed to add email address: ${response.status}`,
        )
    }

    return response.json()
}

export async function setPrimaryEmailAddress(
    patientId: number,
    emailAddressId: number,
): Promise<EmailAddress[]> {
    const response = await fetch(
        `/api/patients/${patientId}/email-addresses/${emailAddressId}/primary`,
        {
            method: 'PATCH',
        },
    )

    if (!response.ok) {
        throw new Error(
            `Failed to set primary email address: ${response.status}`,
        )
    }

    return response.json()
}

export async function deactivateEmailAddress(
    patientId: number,
    emailAddressId: number,
): Promise<EmailAddress[]> {
    const response = await fetch(
        `/api/patients/${patientId}/email-addresses/${emailAddressId}/deactivate`,
        {
            method: 'PATCH',
        },
    )

    if (!response.ok) {
        throw new Error(
            `Failed to deactivate email address: ${response.status}`,
        )
    }

    return response.json()
}

export function getPrimaryEmailAddress(
    addresses: EmailAddress[],
): EmailAddress | null {
    const primary = addresses.find(
        (address) =>
            address.primaryAddress &&
            address.active,
    )

    if (primary) {
        return primary
    }

    return (
        addresses.find(
            (address) => address.active,
        ) ?? null
    )
}