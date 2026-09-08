package com.brendan.practicememory.call;

import com.brendan.practicememory.patient.Patient;
import com.brendan.practicememory.shared.CommunicationTriageStatus;

import java.time.Instant;

public record CallResponse(
        Long id,
        String providerCallId,
        CallDirection direction,
        String fromNumber,
        String toNumber,
        String counterpartyNumber,
        Instant startedAt,
        Instant loggedAt,
        Integer durationSeconds,
        CallStatus callStatus,
        PatientMatchStatus patientMatchStatus,
        PatientSummary patient,
        String note,
        FollowUpStatus followUpStatus,
        CommunicationTriageStatus triageStatus
) {

    public static CallResponse from(CallRecord callRecord) {
        Patient patient = callRecord.getPatient();

        return new CallResponse(
                callRecord.getId(),
                callRecord.getProviderCallId(),
                callRecord.getDirection(),
                callRecord.getFromNumber(),
                callRecord.getToNumber(),
                callRecord.getCounterpartyNumber(),
                callRecord.getStartedAt(),
                callRecord.getLoggedAt(),
                callRecord.getDurationSeconds(),
                callRecord.getCallStatus(),
                callRecord.getPatientMatchStatus(),
                patient == null
                        ? null
                        : new PatientSummary(
                                patient.getId(),
                                patient.getFirstName(),
                                patient.getLastName()
                        ),
                callRecord.getNote(),
                callRecord.getFollowUpStatus(),
                callRecord.getTriageStatus()
        );
    }

    public record PatientSummary(
            Long id,
            String firstName,
            String lastName
    ) {
    }
}
