package com.brendan.practicememory.patient;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record PatientResponse(
        Long id,
        String firstName,
        String lastName,
        LocalDate dateOfBirth,
        Instant createdAt,
        Instant lastUpdatedAt,
        List<PhoneNumberResponse> phoneNumbers,
        List<EmailAddressResponse> emailAddresses
) {
    public static PatientResponse from(
            Patient patient,
            List<PhoneNumber> phoneNumbers,
            List<EmailAddress> emailAddresses
    ) {
        return new PatientResponse(
                patient.getId(),
                patient.getFirstName(),
                patient.getLastName(),
                patient.getDateOfBirth(),
                patient.getCreatedAt(),
                patient.getLastUpdatedAt(),
                phoneNumbers.stream().map(PhoneNumberResponse::from).toList(),
                emailAddresses.stream().map(EmailAddressResponse::from).toList()
        );
    }
}
