package com.brendan.practicememory.patient;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EmailAddressRepository
        extends JpaRepository<EmailAddress, Long> {

    List<EmailAddress> findAllByAddressAndActiveTrue(
            String address
    );

    List<EmailAddress> findAllByPatientIdAndActiveTrueOrderByPrimaryAddressDescIdAsc(
            Long patientId
    );

    Optional<EmailAddress> findByPatientIdAndAddress(
            Long patientId,
            String address
    );

    Optional<EmailAddress> findByIdAndPatientId(
            Long emailAddressId,
            Long patientId
    );
}