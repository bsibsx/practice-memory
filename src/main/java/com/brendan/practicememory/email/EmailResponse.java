package com.brendan.practicememory.email;

import com.brendan.practicememory.patient.Patient;
import com.brendan.practicememory.shared.CommunicationTriageStatus;

import java.time.Instant;

public record EmailResponse(
        Long id,
        String providerMessageId,
        String inReplyToProviderMessageId,
        String fromAddress,
        String toAddress,
        String subject,
        String bodyText,
        String staffNote,
        EmailDirection direction,
        EmailStatus emailStatus,
        EmailMatchStatus patientMatchStatus,
        PatientSummary patient,
        Instant sentAt,
        Instant loggedAt,
        CommunicationTriageStatus triageStatus
) {

    public static EmailResponse from(
            EmailRecord emailRecord
    ) {
        Patient patient = emailRecord.getPatient();

        return new EmailResponse(
                emailRecord.getId(),
                emailRecord.getProviderMessageId(),
                emailRecord.getInReplyToProviderMessageId(),
                emailRecord.getFromAddress(),
                emailRecord.getToAddress(),
                emailRecord.getSubject(),
                emailRecord.getBodyText(),
                emailRecord.getStaffNote(),
                emailRecord.getDirection(),
                emailRecord.getEmailStatus(),
                emailRecord.getPatientMatchStatus(),
                patient == null
                        ? null
                        : new PatientSummary(
                                patient.getId(),
                                patient.getFirstName(),
                                patient.getLastName()
                        ),
                emailRecord.getSentAt(),
                emailRecord.getLoggedAt(),
                emailRecord.getTriageStatus()
        );
    }

    public record PatientSummary(
            Long id,
            String firstName,
            String lastName
    ) {
    }
}
