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

import java.util.Locale;

@Entity
@Table(
        name = "email_addresses",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_patient_email",
                        columnNames = {
                                "patient_id",
                                "address"
                        }
                )
        }
)
public class EmailAddress {

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
            length = 320
    )
    private String address;

    @Column(
            name = "is_primary",
            nullable = false
    )
    private boolean primaryAddress;

    @Column(
            name = "is_active",
            nullable = false
    )
    private boolean active;

    protected EmailAddress() {
        // Required by JPA.
    }

    public EmailAddress(
            Patient patient,
            String address,
            boolean primaryAddress
    ) {
        if (patient == null) {
            throw new IllegalArgumentException(
                    "Email address must belong to a patient"
            );
        }

        if (
                address == null ||
                        address.isBlank()
        ) {
            throw new IllegalArgumentException(
                    "Email address must not be blank"
            );
        }

        this.patient = patient;
        this.address = address
                .trim()
                .toLowerCase(Locale.ROOT);
        this.primaryAddress = primaryAddress;
        this.active = true;
    }

    public void activate() {
        active = true;
    }

    public void deactivate() {
        active = false;
        primaryAddress = false;
    }

    public void makePrimary() {
        if (!active) {
            throw new IllegalStateException(
                    "Inactive email address cannot be primary"
            );
        }

        primaryAddress = true;
    }

    public void removePrimary() {
        primaryAddress = false;
    }

    public Long getId() {
        return id;
    }

    public Patient getPatient() {
        return patient;
    }

    public String getAddress() {
        return address;
    }

    public boolean isPrimaryAddress() {
        return primaryAddress;
    }

    public boolean isActive() {
        return active;
    }
}