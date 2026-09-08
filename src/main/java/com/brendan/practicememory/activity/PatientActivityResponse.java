package com.brendan.practicememory.activity;

import com.brendan.practicememory.call.CallDirection;
import com.brendan.practicememory.call.CallRecord;
import com.brendan.practicememory.call.CallStatus;
import com.brendan.practicememory.call.FollowUpStatus;
import com.brendan.practicememory.email.EmailDirection;
import com.brendan.practicememory.email.EmailRecord;
import com.brendan.practicememory.email.EmailStatus;

import java.time.Instant;

public record PatientActivityResponse(
        ActivityType type,
        Long id,
        Instant occurredAt,

        String text,
        String staffNote,

        CallStatus callStatus,
        CallDirection callDirection,
        Integer durationSeconds,
        String fromNumber,
        String toNumber,
        String counterpartyNumber,
        FollowUpStatus followUpStatus,

        String emailSubject,
        String fromAddress,
        String toAddress,
        EmailDirection emailDirection,
        EmailStatus emailStatus,

        Instant removedAt
) {

    public static PatientActivityResponse fromCall(CallRecord callRecord) {
        return new PatientActivityResponse(
                ActivityType.CALL,
                callRecord.getId(),
                callRecord.getStartedAt(),

                null,
                callRecord.getNote(),

                callRecord.getCallStatus(),
                callRecord.getDirection(),
                callRecord.getDurationSeconds(),
                callRecord.getFromNumber(),
                callRecord.getToNumber(),
                callRecord.getCounterpartyNumber(),
                callRecord.getFollowUpStatus(),

                null,
                null,
                null,
                null,
                null,

                callRecord.getRemovedAt()
        );
    }

    public static PatientActivityResponse fromNote(PatientNote note) {
        return new PatientActivityResponse(
                ActivityType.NOTE,
                note.getId(),
                note.getCreatedAt(),

                note.getText(),
                null,

                null,
                null,
                null,
                null,
                null,
                null,
                null,

                null,
                null,
                null,
                null,
                null,

                note.getRemovedAt()
        );
    }

    public static PatientActivityResponse fromEmail(EmailRecord emailRecord) {
        return new PatientActivityResponse(
                ActivityType.EMAIL,
                emailRecord.getId(),
                emailRecord.getSentAt(),

                emailRecord.getBodyText(),
                emailRecord.getStaffNote(),

                null,
                null,
                null,
                null,
                null,
                null,
                null,

                emailRecord.getSubject(),
                emailRecord.getFromAddress(),
                emailRecord.getToAddress(),
                emailRecord.getDirection(),
                emailRecord.getEmailStatus(),

                emailRecord.getRemovedAt()
        );
    }
}
