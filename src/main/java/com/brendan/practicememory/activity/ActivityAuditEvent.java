package com.brendan.practicememory.activity;

import com.brendan.practicememory.patient.Patient;
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
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "activity_audit_events")
public class ActivityAuditEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "patient_id",
            nullable = false
    )
    private Patient patient;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "activity_type",
            nullable = false,
            length = 20
    )
    private ActivityType activityType;

    @Column(
            name = "activity_id",
            nullable = false
    )
    private Long activityId;

    @Enumerated(EnumType.STRING)
    @Column(
            nullable = false,
            length = 30
    )
    private ActivityAuditAction action;

    @Column(
            name = "occurred_at",
            nullable = false,
            updatable = false
    )
    private Instant occurredAt;

    @Column(
            name = "previous_text",
            length = 4000
    )
    private String previousText;

    @Column(
            name = "new_text",
            length = 4000
    )
    private String newText;

    protected ActivityAuditEvent() {
        // Required by JPA.
    }

    public ActivityAuditEvent(
            Patient patient,
            ActivityType activityType,
            Long activityId,
            ActivityAuditAction action
    ) {
        this(
                patient,
                activityType,
                activityId,
                action,
                null,
                null
        );
    }

    public ActivityAuditEvent(
            Patient patient,
            ActivityType activityType,
            Long activityId,
            ActivityAuditAction action,
            String previousText,
            String newText
    ) {
        if (patient == null) {
            throw new IllegalArgumentException(
                    "Patient must not be null"
            );
        }

        if (activityType == null) {
            throw new IllegalArgumentException(
                    "Activity type must not be null"
            );
        }

        if (activityId == null) {
            throw new IllegalArgumentException(
                    "Activity ID must not be null"
            );
        }

        if (action == null) {
            throw new IllegalArgumentException(
                    "Audit action must not be null"
            );
        }

        this.patient = patient;
        this.activityType = activityType;
        this.activityId = activityId;
        this.action = action;
        this.previousText = normalizeOptionalText(
                previousText
        );
        this.newText = normalizeOptionalText(
                newText
        );
    }

    @PrePersist
    void beforeInsert() {
        occurredAt = Instant.now();
    }

    private static String normalizeOptionalText(
            String text
    ) {
        if (
                text == null ||
                        text.isBlank()
        ) {
            return null;
        }

        return text.trim();
    }

    public Long getId() {
        return id;
    }

    public Patient getPatient() {
        return patient;
    }

    public ActivityType getActivityType() {
        return activityType;
    }

    public Long getActivityId() {
        return activityId;
    }

    public ActivityAuditAction getAction() {
        return action;
    }

    public Instant getOccurredAt() {
        return occurredAt;
    }

    public String getPreviousText() {
        return previousText;
    }

    public String getNewText() {
        return newText;
    }
}