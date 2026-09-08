package com.brendan.practicememory.activity;

import com.brendan.practicememory.patient.Patient;

public record InboxItemResponse(

        Long patientId,

        String patientFirstName,

        String patientLastName,

        PatientActivityResponse activity

) {

    public static InboxItemResponse from(
            Patient patient,
            PatientActivityResponse activity
    ) {
        if (patient == null) {
            throw new IllegalArgumentException(
                    "Inbox item must belong to a patient"
            );
        }

        if (activity == null) {
            throw new IllegalArgumentException(
                    "Inbox item must contain activity"
            );
        }

        return new InboxItemResponse(
                patient.getId(),
                patient.getFirstName(),
                patient.getLastName(),
                activity
        );
    }
}