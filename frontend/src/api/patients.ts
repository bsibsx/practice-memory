export type PhoneNumber = {
  id: number
  number: string
  primaryNumber: boolean
  active: boolean
}

export type PatientEmailAddress = {
  id: number
  address: string
  primaryAddress: boolean
  active: boolean
}

export type Patient = {
  id: number
  firstName: string
  lastName: string
  dateOfBirth: string | null
  createdAt: string
  lastUpdatedAt: string
  phoneNumbers: PhoneNumber[]
  emailAddresses: PatientEmailAddress[]
}

export type CreatePatientRequest = {
  firstName: string
  lastName: string
  dateOfBirth: string | null
  phoneNumbers: string[]
  emailAddresses: string[]
}

export type UpdatePatientRequest = {
  firstName: string
  lastName: string
  dateOfBirth: string | null
}

export type AddPhoneNumberRequest = {
  number: string
}

export async function getPatients(): Promise<Patient[]> {
  const response = await fetch('/api/patients')

  if (!response.ok) {
    throw new Error(
        `Failed to load patients: ${response.status}`,
    )
  }

  return response.json()
}

export async function createPatient(
    request: CreatePatientRequest,
): Promise<Patient> {
  const response = await fetch(
      '/api/patients',
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
        `Failed to create patient: ${response.status}`,
    )
  }

  return response.json()
}

export async function updatePatient(
    patientId: number,
    request: UpdatePatientRequest,
): Promise<Patient> {
  const response = await fetch(
      `/api/patients/${patientId}`,
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
        `Failed to update patient: ${response.status}`,
    )
  }

  return response.json()
}

export async function addPhoneNumber(
    patientId: number,
    request: AddPhoneNumberRequest,
): Promise<Patient> {
  const response = await fetch(
      `/api/patients/${patientId}/phone-numbers`,
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
        `Failed to add phone number: ${response.status}`,
    )
  }

  return response.json()
}

export async function setPrimaryPhoneNumber(
    patientId: number,
    phoneNumberId: number,
): Promise<Patient> {
  const response = await fetch(
      `/api/patients/${patientId}/phone-numbers/${phoneNumberId}/primary`,
      {
        method: 'PATCH',
      },
  )

  if (!response.ok) {
    throw new Error(
        `Failed to set primary phone number: ${response.status}`,
    )
  }

  return response.json()
}

export async function deactivatePhoneNumber(
    patientId: number,
    phoneNumberId: number,
): Promise<Patient> {
  const response = await fetch(
      `/api/patients/${patientId}/phone-numbers/${phoneNumberId}/deactivate`,
      {
        method: 'PATCH',
      },
  )

  if (!response.ok) {
    throw new Error(
        `Failed to deactivate phone number: ${response.status}`,
    )
  }

  return response.json()
}
