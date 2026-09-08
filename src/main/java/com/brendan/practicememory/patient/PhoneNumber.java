package com.brendan.practicememory.patient;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(
        name = "phone_numbers",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_patient_phone",
                        columnNames = {
                                "patient_id",
                                "number"
                        }
                )
        }
)
public class PhoneNumber {

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

    @Column(
            nullable = false,
            length = 32
    )
    private String number;

    @Column(
            name = "is_primary",
            nullable = false
    )
    private boolean primaryNumber;

    @Column(
            name = "is_active",
            nullable = false
    )
    private boolean active;

    protected PhoneNumber() {
        // Required by JPA.
    }

    public PhoneNumber(
            Patient patient,
            String number,
            boolean primaryNumber
    ) {
        if (patient == null) {
            throw new IllegalArgumentException(
                    "Phone number must belong to a patient"
            );
        }

        if (
                number == null ||
                        number.isBlank()
        ) {
            throw new IllegalArgumentException(
                    "Phone number must not be blank"
            );
        }

        this.patient = patient;
        this.number = number;
        this.primaryNumber =
                primaryNumber;
        this.active = true;
    }

    public void activate() {
        active = true;
    }

    public void deactivate() {
        active = false;
        primaryNumber = false;
    }

    public void makePrimary() {
        if (!active) {
            throw new IllegalStateException(
                    "Inactive phone number cannot be primary"
            );
        }

        primaryNumber = true;
    }

    public void removePrimary() {
        primaryNumber = false;
    }

    public Long getId() {
        return id;
    }

    public Patient getPatient() {
        return patient;
    }

    public String getNumber() {
        return number;
    }

    public boolean isPrimaryNumber() {
        return primaryNumber;
    }

    public boolean isActive() {
        return active;
    }
}