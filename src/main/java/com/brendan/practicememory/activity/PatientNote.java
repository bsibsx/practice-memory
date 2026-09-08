package com.brendan.practicememory.activity;

import com.brendan.practicememory.patient.Patient;
import jakarta.persistence.*;

import java.time.Instant;

import static jakarta.persistence.GenerationType.IDENTITY;

@Entity
@Table(name = "patient_notes")
public class PatientNote {

    @Id
    @GeneratedValue(strategy = IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "patient_id",
            nullable = false
    )
    private Patient patient;

    @Column(
            nullable = false,
            length = 4000
    )
    private String text;

    @Column(
            name = "created_at",
            nullable = false,
            updatable = false
    )
    private Instant createdAt;

    @Column(
            name = "updated_at",
            nullable = false
    )
    private Instant updatedAt;

    @Column(
            name = "removed_at"
    )
    private Instant removedAt;

    protected PatientNote() {
    }

    public PatientNote(
            Patient patient,
            String text
    ) {
        if (patient == null) {
            throw new IllegalArgumentException(
                    "Patient is required"
            );
        }

        this.patient = patient;
        this.text = requireText(text);
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();

        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public void updateText(String text) {
        this.text = requireText(text);
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

    private String requireText(String value) {
        if (
                value == null ||
                        value.isBlank()
        ) {
            throw new IllegalArgumentException(
                    "Note text is required"
            );
        }

        String trimmed = value.trim();

        if (trimmed.length() > 4000) {
            throw new IllegalArgumentException(
                    "Note text cannot exceed 4000 characters"
            );
        }

        return trimmed;
    }

    public Long getId() {
        return id;
    }

    public Patient getPatient() {
        return patient;
    }

    public String getText() {
        return text;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public Instant getRemovedAt() {
        return removedAt;
    }
}