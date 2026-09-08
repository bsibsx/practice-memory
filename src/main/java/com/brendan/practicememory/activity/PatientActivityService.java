package com.brendan.practicememory.activity;

import com.brendan.practicememory.call.CallDirection;
import com.brendan.practicememory.call.CallRecord;
import com.brendan.practicememory.call.CallStatus;
import com.brendan.practicememory.call.FollowUpStatus;
import com.brendan.practicememory.call.CallRecordRepository;
import com.brendan.practicememory.email.EmailDirection;
import com.brendan.practicememory.email.EmailRecord;
import com.brendan.practicememory.email.EmailStatus;
import com.brendan.practicememory.email.EmailRecordRepository;
import com.brendan.practicememory.patient.Patient;
import com.brendan.practicememory.patient.PatientRepository;
import com.brendan.practicememory.shared.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

@Service
public class PatientActivityService {

    private final PatientRepository patientRepository;
    private final PatientNoteRepository patientNoteRepository;
    private final CallRecordRepository callRecordRepository;
    private final EmailRecordRepository emailRecordRepository;
    private final ActivityAuditEventRepository activityAuditEventRepository;

    public PatientActivityService(
            PatientRepository patientRepository,
            PatientNoteRepository patientNoteRepository,
            CallRecordRepository callRecordRepository,
            EmailRecordRepository emailRecordRepository,
            ActivityAuditEventRepository activityAuditEventRepository
    ) {
        this.patientRepository = patientRepository;
        this.patientNoteRepository = patientNoteRepository;
        this.callRecordRepository = callRecordRepository;
        this.emailRecordRepository = emailRecordRepository;
        this.activityAuditEventRepository = activityAuditEventRepository;
    }

    @Transactional
    public PatientActivityResponse createNote(
            Long patientId,
            String text
    ) {
        Patient patient = findPatient(patientId);

        PatientNote note = new PatientNote(
                patient,
                text
        );

        PatientNote saved =
                patientNoteRepository.save(note);

        patient.markUpdated();

        return PatientActivityResponse.fromNote(saved);
    }

    @Transactional
    public PatientActivityResponse updateNote(
            Long patientId,
            Long noteId,
            String text
    ) {
        PatientNote note =
                findNoteForPatient(
                        patientId,
                        noteId
                );

        String previousText =
                note.getText();

        note.updateText(text);

        if (
                !Objects.equals(
                        previousText,
                        note.getText()
                )
        ) {
            ActivityAuditEvent auditEvent =
                    new ActivityAuditEvent(
                            note.getPatient(),
                            ActivityType.NOTE,
                            note.getId(),
                            ActivityAuditAction.EDITED,
                            previousText,
                            note.getText()
                    );

            activityAuditEventRepository.save(
                    auditEvent
            );

            note.getPatient().markUpdated();
        }

        return PatientActivityResponse.fromNote(note);
    }

    @Transactional
    public PatientActivityResponse removeNote(
            Long patientId,
            Long noteId
    ) {
        PatientNote note =
                findNoteForPatient(
                        patientId,
                        noteId
                );

        if (!note.isRemoved()) {
            note.removeFromActivity();

            recordAuditEvent(
                    note.getPatient(),
                    ActivityType.NOTE,
                    note.getId(),
                    ActivityAuditAction.REMOVED
            );

            note.getPatient().markUpdated();
        }

        return PatientActivityResponse.fromNote(note);
    }

    @Transactional
    public PatientActivityResponse restoreNote(
            Long patientId,
            Long noteId
    ) {
        PatientNote note =
                findNoteForPatient(
                        patientId,
                        noteId
                );

        if (note.isRemoved()) {
            note.restoreToActivity();

            recordAuditEvent(
                    note.getPatient(),
                    ActivityType.NOTE,
                    note.getId(),
                    ActivityAuditAction.RESTORED
            );

            note.getPatient().markUpdated();
        }

        return PatientActivityResponse.fromNote(note);
    }

    @Transactional
    public PatientActivityResponse removeCall(
            Long patientId,
            Long callId
    ) {
        CallRecord call =
                findCallForPatient(
                        patientId,
                        callId
                );

        if (!call.isRemoved()) {
            call.removeFromActivity();

            recordAuditEvent(
                    call.getPatient(),
                    ActivityType.CALL,
                    call.getId(),
                    ActivityAuditAction.REMOVED
            );

            call.getPatient().markUpdated();
        }

        return PatientActivityResponse.fromCall(call);
    }

    @Transactional
    public PatientActivityResponse restoreCall(
            Long patientId,
            Long callId
    ) {
        CallRecord call =
                findCallForPatient(
                        patientId,
                        callId
                );

        if (call.isRemoved()) {
            call.restoreToActivity();

            recordAuditEvent(
                    call.getPatient(),
                    ActivityType.CALL,
                    call.getId(),
                    ActivityAuditAction.RESTORED
            );

            call.getPatient().markUpdated();
        }

        return PatientActivityResponse.fromCall(call);
    }

    @Transactional
    public PatientActivityResponse removeEmail(
            Long patientId,
            Long emailId
    ) {
        EmailRecord email =
                findEmailForPatient(
                        patientId,
                        emailId
                );

        if (!email.isRemoved()) {
            email.removeFromActivity();

            recordAuditEvent(
                    email.getPatient(),
                    ActivityType.EMAIL,
                    email.getId(),
                    ActivityAuditAction.REMOVED
            );

            email.getPatient().markUpdated();
        }

        return PatientActivityResponse.fromEmail(email);
    }

    @Transactional
    public PatientActivityResponse restoreEmail(
            Long patientId,
            Long emailId
    ) {
        EmailRecord email =
                findEmailForPatient(
                        patientId,
                        emailId
                );

        if (email.isRemoved()) {
            email.restoreToActivity();

            recordAuditEvent(
                    email.getPatient(),
                    ActivityType.EMAIL,
                    email.getId(),
                    ActivityAuditAction.RESTORED
            );

            email.getPatient().markUpdated();
        }

        return PatientActivityResponse.fromEmail(email);
    }

    @Transactional(readOnly = true)
    public List<PatientActivityResponse> getActivity(
            Long patientId
    ) {
        findPatient(patientId);

        List<PatientActivityResponse> activities =
                new ArrayList<>();

        callRecordRepository
                .findAllByPatientIdOrderByStartedAtDesc(patientId)
                .stream()
                .filter(call -> !call.isRemoved())
                .map(PatientActivityResponse::fromCall)
                .forEach(activities::add);

        patientNoteRepository
                .findAllByPatientIdOrderByCreatedAtDesc(patientId)
                .stream()
                .filter(note -> !note.isRemoved())
                .map(PatientActivityResponse::fromNote)
                .forEach(activities::add);

        emailRecordRepository
                .findAllByPatientIdOrderBySentAtDesc(patientId)
                .stream()
                .filter(email -> !email.isRemoved())
                .map(PatientActivityResponse::fromEmail)
                .forEach(activities::add);

        sortByOccurredAtDescending(
                activities
        );

        return activities;
    }

    @Transactional(readOnly = true)
    public List<InboxItemResponse> getInbox() {
        List<InboxItemResponse> inboxItems =
                new ArrayList<>();

        callRecordRepository
                .findAll()
                .stream()
                .filter(call -> !call.isRemoved())
                .filter(call -> call.getTriageStatus().isActive())
                .filter(call -> call.getPatient() != null)
                .forEach(call -> {
                    PatientActivityResponse activity =
                            PatientActivityResponse.fromCall(call);

                    boolean missedInbound =
                            activity.callDirection() == CallDirection.INBOUND &&
                                    activity.callStatus() == CallStatus.MISSED &&
                                    activity.followUpStatus() == FollowUpStatus.NOT_REVIEWED;

                    boolean unansweredOutbound =
                            activity.callDirection() == CallDirection.OUTBOUND &&
                                    activity.callStatus() == CallStatus.NO_ANSWER &&
                                    activity.followUpStatus() == FollowUpStatus.NOT_REVIEWED;

                    boolean needsAttention =
                            missedInbound ||
                                    unansweredOutbound ||
                                    activity.followUpStatus() == FollowUpStatus.FOLLOW_UP_REQUIRED;

                    if (needsAttention) {
                        inboxItems.add(
                                InboxItemResponse.from(
                                        call.getPatient(),
                                        activity
                                )
                        );
                    }
                });

        emailRecordRepository
                .findAll()
                .stream()
                .filter(email -> !email.isRemoved())
                .filter(email -> email.getTriageStatus().isActive())
                .filter(email -> email.getPatient() != null)
                .forEach(email -> {
                    PatientActivityResponse activity =
                            PatientActivityResponse.fromEmail(email);

                    boolean inboundNeedsAttention =
                            activity.emailDirection() == EmailDirection.INBOUND &&
                                    (
                                            activity.emailStatus() == EmailStatus.UNREAD ||
                                                    activity.emailStatus() == EmailStatus.AWAITING_REPLY
                                    );

                    boolean failedOutbound =
                            activity.emailDirection() == EmailDirection.OUTBOUND &&
                                    activity.emailStatus() == EmailStatus.FAILED;

                    if (inboundNeedsAttention || failedOutbound) {
                        inboxItems.add(
                                InboxItemResponse.from(
                                        email.getPatient(),
                                        activity
                                )
                        );
                    }
                });

        inboxItems.sort(
                Comparator.comparing(
                        (InboxItemResponse inboxItem) ->
                                inboxItem.activity().occurredAt()
                ).reversed()
        );
        return inboxItems;
    }

    @Transactional(readOnly = true)
    public List<PatientActivityResponse> getRemovedActivity(
            Long patientId
    ) {
        findPatient(patientId);

        List<PatientActivityResponse> activities =
                new ArrayList<>();

        callRecordRepository
                .findAllByPatientIdOrderByStartedAtDesc(patientId)
                .stream()
                .filter(CallRecord::isRemoved)
                .map(PatientActivityResponse::fromCall)
                .forEach(activities::add);

        patientNoteRepository
                .findAllByPatientIdOrderByCreatedAtDesc(patientId)
                .stream()
                .filter(PatientNote::isRemoved)
                .map(PatientActivityResponse::fromNote)
                .forEach(activities::add);

        emailRecordRepository
                .findAllByPatientIdOrderBySentAtDesc(patientId)
                .stream()
                .filter(EmailRecord::isRemoved)
                .map(PatientActivityResponse::fromEmail)
                .forEach(activities::add);

        sortByOccurredAtDescending(
                activities
        );

        return activities;
    }

    private void recordAuditEvent(
            Patient patient,
            ActivityType activityType,
            Long activityId,
            ActivityAuditAction action
    ) {
        ActivityAuditEvent auditEvent =
                new ActivityAuditEvent(
                        patient,
                        activityType,
                        activityId,
                        action
                );

        activityAuditEventRepository.save(
                auditEvent
        );
    }

    private PatientNote findNoteForPatient(
            Long patientId,
            Long noteId
    ) {
        return patientNoteRepository
                .findByIdAndPatientId(
                        noteId,
                        patientId
                )
                .orElseThrow(() ->
                        new ResourceNotFoundException(
                                "Note not found: " +
                                        noteId
                        )
                );
    }

    private CallRecord findCallForPatient(
            Long patientId,
            Long callId
    ) {
        CallRecord call =
                callRecordRepository
                        .findById(callId)
                        .orElseThrow(() ->
                                new ResourceNotFoundException(
                                        "Call not found: " +
                                                callId
                                )
                        );

        if (
                call.getPatient() == null ||
                        !call.getPatient()
                                .getId()
                                .equals(patientId)
        ) {
            throw new ResourceNotFoundException(
                    "Call not found: " +
                            callId
            );
        }

        return call;
    }

    private EmailRecord findEmailForPatient(
            Long patientId,
            Long emailId
    ) {
        EmailRecord email =
                emailRecordRepository
                        .findById(emailId)
                        .orElseThrow(() ->
                                new ResourceNotFoundException(
                                        "Email not found: " +
                                                emailId
                                )
                        );

        if (
                email.getPatient() == null ||
                        !email.getPatient()
                                .getId()
                                .equals(patientId)
        ) {
            throw new ResourceNotFoundException(
                    "Email not found: " +
                            emailId
            );
        }

        return email;
    }

    private void sortByOccurredAtDescending(
            List<PatientActivityResponse> activities
    ) {
        activities.sort(
                Comparator.comparing(
                        PatientActivityResponse::occurredAt
                ).reversed()
        );
    }

    private Patient findPatient(
            Long patientId
    ) {
        return patientRepository
                .findById(patientId)
                .orElseThrow(() ->
                        new ResourceNotFoundException(
                                "Patient not found: " +
                                        patientId
                        )
                );
    }
}
