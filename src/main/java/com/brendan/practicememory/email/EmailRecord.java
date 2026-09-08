package com.brendan.practicememory.email;

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
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.Locale;

@Entity
@Table(name = "email_records")
public class EmailRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "provider_message_id", unique = true, length = 255)
    private String providerMessageId;

    @Column(name = "in_reply_to_provider_message_id", length = 255)
    private String inReplyToProviderMessageId;

    @Column(name = "from_address", nullable = false, length = 320)
    private String fromAddress;

    @Column(name = "to_address", nullable = false, length = 320)
    private String toAddress;

    @Column(length = 500)
    private String subject;

    @Lob
    @Column(nullable = false)
    private String bodyText;

    @Column(name = "staff_note", length = 4000)
    private String staffNote;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EmailDirection direction;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private EmailStatus emailStatus;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "patient_id")
    private Patient patient;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private EmailMatchStatus patientMatchStatus;

    // Nullable for compatibility with development databases created before
    // triage existed. Null is read as ACTIVE.
    @Enumerated(EnumType.STRING)
    @Column(name = "triage_status", length = 20)
    private CommunicationTriageStatus triageStatus;

    @Column(nullable = false)
    private Instant sentAt;

    @Column(nullable = false, updatable = false)
    private Instant loggedAt;

    @Column(name = "removed_at")
    private Instant removedAt;

    protected EmailRecord() {
        // Required by JPA.
    }

    public EmailRecord(
            String providerMessageId,
            String fromAddress,
            String toAddress,
            String subject,
            String bodyText,
            EmailDirection direction,
            EmailStatus emailStatus,
            Instant sentAt
    ) {
        this(
                providerMessageId,
                null,
                fromAddress,
                toAddress,
                subject,
                bodyText,
                direction,
                emailStatus,
                sentAt
        );
    }

    public EmailRecord(
            String providerMessageId,
            String inReplyToProviderMessageId,
            String fromAddress,
            String toAddress,
            String subject,
            String bodyText,
            EmailDirection direction,
            EmailStatus emailStatus,
            Instant sentAt
    ) {
        if (fromAddress == null || fromAddress.isBlank()) {
            throw new IllegalArgumentException("From address must not be blank");
        }
        if (toAddress == null || toAddress.isBlank()) {
            throw new IllegalArgumentException("To address must not be blank");
        }
        if (bodyText == null || bodyText.isBlank()) {
            throw new IllegalArgumentException("Email body must not be blank");
        }
        if (direction == null) {
            throw new IllegalArgumentException("Email direction must not be null");
        }
        if (emailStatus == null) {
            throw new IllegalArgumentException("Email status must not be null");
        }
        if (sentAt == null) {
            throw new IllegalArgumentException("Email sent time must not be null");
        }

        this.providerMessageId = normalizeMessageId(providerMessageId);
        this.inReplyToProviderMessageId = normalizeMessageId(inReplyToProviderMessageId);
        this.fromAddress = normalizeAddress(fromAddress);
        this.toAddress = normalizeAddress(toAddress);
        this.subject = normalizeOptionalText(subject);
        this.bodyText = bodyText.trim();
        this.direction = direction;
        this.emailStatus = emailStatus;
        this.sentAt = sentAt;
        this.patientMatchStatus = EmailMatchStatus.UNMATCHED;
        this.triageStatus = CommunicationTriageStatus.ACTIVE;
    }

    @PrePersist
    void beforeInsert() {
        if (loggedAt == null) {
            loggedAt = Instant.now();
        }
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

    public void matchPatient(Patient patient) {
        if (patient == null) {
            throw new IllegalArgumentException("Matched patient must not be null");
        }
        this.patient = patient;
        this.patientMatchStatus = EmailMatchStatus.MATCHED;
    }

    public void markUnmatched() {
        patient = null;
        patientMatchStatus = EmailMatchStatus.UNMATCHED;
    }

    public void markAmbiguous() {
        patient = null;
        patientMatchStatus = EmailMatchStatus.AMBIGUOUS;
    }

    public void changeStatus(EmailStatus emailStatus) {
        if (emailStatus == null) {
            throw new IllegalArgumentException("Email status must not be null");
        }
        this.emailStatus = emailStatus;
    }

    public void updateStaffNote(String staffNote) {
        if (staffNote == null || staffNote.isBlank()) {
            this.staffNote = null;
            return;
        }

        String normalized = staffNote.trim();
        if (normalized.length() > 4000) {
            throw new IllegalArgumentException(
                    "Staff note must not exceed 4000 characters"
            );
        }
        this.staffNote = normalized;
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

    private static String normalizeAddress(String address) {
        return address.trim().toLowerCase(Locale.ROOT);
    }

    private static String normalizeMessageId(String value) {
        return normalizeOptionalText(value);
    }

    private static String normalizeOptionalText(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    public Long getId() {
        return id;
    }

    public String getProviderMessageId() {
        return providerMessageId;
    }

    public String getInReplyToProviderMessageId() {
        return inReplyToProviderMessageId;
    }

    public String getFromAddress() {
        return fromAddress;
    }

    public String getToAddress() {
        return toAddress;
    }

    public String getSubject() {
        return subject;
    }

    public String getBodyText() {
        return bodyText;
    }

    public String getStaffNote() {
        return staffNote;
    }

    public EmailDirection getDirection() {
        return direction;
    }

    public EmailStatus getEmailStatus() {
        return emailStatus;
    }

    public Patient getPatient() {
        return patient;
    }

    public EmailMatchStatus getPatientMatchStatus() {
        return patientMatchStatus;
    }

    public CommunicationTriageStatus getTriageStatus() {
        return triageStatus == null
                ? CommunicationTriageStatus.ACTIVE
                : triageStatus;
    }

    public Instant getSentAt() {
        return sentAt;
    }

    public Instant getLoggedAt() {
        return loggedAt;
    }

    public Instant getRemovedAt() {
        return removedAt;
    }
}
