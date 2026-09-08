package com.brendan.practicememory.patient;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "patients")
public class Patient {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String firstName;

    @Column(nullable = false, length = 100)
    private String lastName;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant lastUpdatedAt;

    protected Patient() {
        // Required by JPA so Hibernate can reconstruct stored patients.
    }

    public Patient(String firstName, String lastName) {
        this(firstName, lastName, null);
    }

    public Patient(
            String firstName,
            String lastName,
            LocalDate dateOfBirth
    ) {
        this.firstName = requireText(firstName, "First name");
        this.lastName = requireText(lastName, "Last name");
        this.dateOfBirth = dateOfBirth;
    }

    @PrePersist
    void beforeInsert() {
        Instant now = Instant.now();
        createdAt = now;
        lastUpdatedAt = now;
    }

    @PreUpdate
    void beforeUpdate() {
        lastUpdatedAt = Instant.now();
    }

    public void updateDetails(
            String firstName,
            String lastName,
            LocalDate dateOfBirth
    ) {
        this.firstName = requireText(firstName, "First name");
        this.lastName = requireText(lastName, "Last name");
        this.dateOfBirth = dateOfBirth;
    }

    public void rename(String firstName, String lastName) {
        updateDetails(firstName, lastName, dateOfBirth);
    }

    public void markUpdated() {
        lastUpdatedAt = Instant.now();
    }

    private static String requireText(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " must not be blank");
        }
        return value.trim();
    }

    public Long getId() {
        return id;
    }

    public String getFirstName() {
        return firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public LocalDate getDateOfBirth() {
        return dateOfBirth;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getLastUpdatedAt() {
        return lastUpdatedAt;
    }
}
