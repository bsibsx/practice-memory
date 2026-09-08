package com.brendan.practicememory.call;

import com.brendan.practicememory.patient.Patient;
import com.brendan.practicememory.shared.CommunicationTriageStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "call_records")
public class CallRecord {

    private static final String PRIVATE_NUMBER_MARKER = "__PRIVATE__";
    private static final String PRACTICE_NUMBER_MARKER = "__PRACTICE__";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(
            name = "provider_call_id",
            nullable = false,
            unique = true,
            length = 100
    )
    private String providerCallId;

    /*
     * This column existed in the original inbound-only schema and is kept
     * non-null for safe development-database migration. For private inbound
     * callers or an unknown practice line on outbound calls, an internal
     * marker is stored and exposed as null through the getters.
     */
    @Column(
            name = "from_number",
            nullable = false,
            length = 32
    )
    private String fromNumber;

    @Column(
            name = "to_number",
            length = 32
    )
    private String toNumber;

    /*
     * Nullable for migration: old rows were all inbound calls. A null value
     * therefore reads as INBOUND through getDirection().
     */
    @Enumerated(EnumType.STRING)
    @Column(
            name = "direction",
            length = 20
    )
    private CallDirection direction;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "patient_id")
    private Patient patient;

    @Column(nullable = false)
    private Instant startedAt;

    @Column(
            nullable = false,
            updatable = false
    )
    private Instant loggedAt;

    private Integer durationSeconds;

    @Enumerated(EnumType.STRING)
    @Column(
            nullable = false,
            length = 30
    )
    private CallStatus callStatus;

    @Enumerated(EnumType.STRING)
    @Column(
            nullable = false,
            length = 30
    )
    private PatientMatchStatus patientMatchStatus;

    @Column(length = 4000)
    private String note;

    @Enumerated(EnumType.STRING)
    @Column(
            nullable = false,
            length = 30
    )
    private FollowUpStatus followUpStatus;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "triage_status",
            length = 20
    )
    private CommunicationTriageStatus triageStatus;

    @Column(name = "removed_at")
    private Instant removedAt;

    protected CallRecord() {
        // Required by JPA.
    }

    /**
     * Backwards-compatible constructor for the original inbound-only model.
     */
    public CallRecord(
            String providerCallId,
            String fromNumber,
            Instant startedAt,
            CallStatus callStatus,
            Integer durationSeconds
    ) {
        this(
                providerCallId,
                CallDirection.INBOUND,
                fromNumber,
                null,
                startedAt,
                callStatus,
                durationSeconds
        );
    }

    public CallRecord(
            String providerCallId,
            CallDirection direction,
            String fromNumber,
            String toNumber,
            Instant startedAt,
            CallStatus callStatus,
            Integer durationSeconds
    ) {
        if (providerCallId == null || providerCallId.isBlank()) {
            throw new IllegalArgumentException(
                    "Provider call ID must not be blank"
            );
        }

        if (direction == null) {
            throw new IllegalArgumentException(
                    "Call direction must not be null"
            );
        }

        if (startedAt == null) {
            throw new IllegalArgumentException(
                    "Call start time must not be null"
            );
        }

        if (callStatus == null) {
            throw new IllegalArgumentException(
                    "Call status must not be null"
            );
        }

        if (durationSeconds != null && durationSeconds < 0) {
            throw new IllegalArgumentException(
                    "Call duration must not be negative"
            );
        }

        if (direction == CallDirection.OUTBOUND &&
                (toNumber == null || toNumber.isBlank())) {
            throw new IllegalArgumentException(
                    "Outbound calls require a destination number"
            );
        }

        this.providerCallId = providerCallId.trim();
        this.direction = direction;
        this.fromNumber = storedFromNumber(direction, fromNumber);
        this.toNumber = normalizeStoredNumber(toNumber);
        this.startedAt = startedAt;
        this.callStatus = callStatus;
        this.durationSeconds = durationSeconds;
        this.followUpStatus = FollowUpStatus.NOT_REVIEWED;
        this.patientMatchStatus = PatientMatchStatus.UNMATCHED;
        this.triageStatus = CommunicationTriageStatus.ACTIVE;
    }

    @PrePersist
    void beforeInsert() {
        loggedAt = Instant.now();

        if (triageStatus == null) {
            triageStatus = CommunicationTriageStatus.ACTIVE;
        }
    }

    @PostLoad
    void afterLoad() {
        if (triageStatus == null) {
            triageStatus = CommunicationTriageStatus.ACTIVE;
        }
    }

    /**
     * Applies a later webhook/event for the same provider call. This is what
     * lets RINGING -> ANSWERED -> COMPLETED update one record rather than
     * producing duplicates. Terminal calls are protected from late
     * non-terminal events arriving out of order.
     */
    public void updateProviderEvent(
            CallDirection eventDirection,
            String eventFromNumber,
            String eventToNumber,
            Instant eventStartedAt,
            CallStatus eventStatus,
            Integer eventDurationSeconds
    ) {
        if (eventDirection == null || eventStatus == null || eventStartedAt == null) {
            throw new IllegalArgumentException(
                    "Call provider event is missing required fields"
            );
        }

        if (direction == null) {
            direction = eventDirection;
        } else if (getDirection() != eventDirection) {
            throw new IllegalArgumentException(
                    "Call direction cannot change for the same provider call ID"
            );
        }

        if (eventFromNumber != null && !eventFromNumber.isBlank()) {
            fromNumber = eventFromNumber.trim();
        }

        if (eventToNumber != null && !eventToNumber.isBlank()) {
            toNumber = eventToNumber.trim();
        }

        if (eventStartedAt.isBefore(startedAt)) {
            startedAt = eventStartedAt;
        }

        if (!callStatus.isTerminal() || callStatus == eventStatus) {
            callStatus = eventStatus;
        }

        if (eventDurationSeconds != null &&
                (durationSeconds == null || eventDurationSeconds >= durationSeconds)) {
            durationSeconds = eventDurationSeconds;
        }
    }

    public void matchPatient(Patient patient) {
        if (patient == null) {
            throw new IllegalArgumentException(
                    "Matched patient must not be null"
            );
        }

        this.patient = patient;
        this.patientMatchStatus = PatientMatchStatus.MATCHED;
    }

    public void markUnmatched() {
        patient = null;
        patientMatchStatus = PatientMatchStatus.UNMATCHED;
    }

    public void markAmbiguous() {
        patient = null;
        patientMatchStatus = PatientMatchStatus.AMBIGUOUS;
    }

    public void updateNote(String note) {
        if (note == null || note.isBlank()) {
            this.note = null;
            return;
        }

        this.note = note.trim();
    }

    public void changeFollowUpStatus(FollowUpStatus followUpStatus) {
        if (followUpStatus == null) {
            throw new IllegalArgumentException(
                    "Follow-up status must not be null"
            );
        }

        this.followUpStatus = followUpStatus;
    }

    public void dismissFromTriage() {
        /*
         * Older development H2 schemas created before DISMISSED existed
         * may still have an enum CHECK constraint that only permits
         * ACTIVE / SPAM / IRRELEVANT. Persist IRRELEVANT as the
         * backwards-compatible storage value; the application treats
         * every non-ACTIVE triage value as "dismissed".
         */
        triageStatus = CommunicationTriageStatus.IRRELEVANT;
    }

    public void restoreToActiveTriage() {
        triageStatus = CommunicationTriageStatus.ACTIVE;
    }

    public boolean isDismissedFromTriage() {
        return getTriageStatus().isDismissed();
    }

    public void removeFromActivity() {
        if (removedAt == null) {
            removedAt = Instant.now();
        }
    }

    public void restoreToActivity() {
        removedAt = null;
    }

    public boolean isRemoved() {
        return removedAt != null;
    }

    public Long getId() {
        return id;
    }

    public String getProviderCallId() {
        return providerCallId;
    }

    public CallDirection getDirection() {
        return direction == null ? CallDirection.INBOUND : direction;
    }

    public String getFromNumber() {
        return visibleNumber(fromNumber);
    }

    public String getToNumber() {
        return visibleNumber(toNumber);
    }

    public String getCounterpartyNumber() {
        return getDirection() == CallDirection.OUTBOUND
                ? getToNumber()
                : getFromNumber();
    }

    public Patient getPatient() {
        return patient;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public Instant getLoggedAt() {
        return loggedAt;
    }

    public Integer getDurationSeconds() {
        return durationSeconds;
    }

    public CallStatus getCallStatus() {
        return callStatus;
    }

    public PatientMatchStatus getPatientMatchStatus() {
        return patientMatchStatus;
    }

    public String getNote() {
        return note;
    }

    public FollowUpStatus getFollowUpStatus() {
        return followUpStatus;
    }

    public CommunicationTriageStatus getTriageStatus() {
        return triageStatus == null
                ? CommunicationTriageStatus.ACTIVE
                : triageStatus;
    }

    public Instant getRemovedAt() {
        return removedAt;
    }

    private static String storedFromNumber(
            CallDirection direction,
            String number
    ) {
        if (number != null && !number.isBlank()) {
            return number.trim();
        }

        return direction == CallDirection.INBOUND
                ? PRIVATE_NUMBER_MARKER
                : PRACTICE_NUMBER_MARKER;
    }

    private static String normalizeStoredNumber(String number) {
        if (number == null || number.isBlank()) {
            return null;
        }
        return number.trim();
    }

    private static String visibleNumber(String number) {
        if (number == null ||
                PRIVATE_NUMBER_MARKER.equals(number) ||
                PRACTICE_NUMBER_MARKER.equals(number)) {
            return null;
        }
        return number;
    }
}
