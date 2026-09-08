package com.brendan.practicememory.patient;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PhoneNumberRepository extends JpaRepository<PhoneNumber, Long> {

    List<PhoneNumber> findAllByNumberAndActiveTrue(
            String number
    );

    List<PhoneNumber> findAllByPatientIdAndActiveTrueOrderByPrimaryNumberDescIdAsc(
            Long patientId
    );

    Optional<PhoneNumber> findByPatientIdAndNumber(
            Long patientId,
            String number
    );

    Optional<PhoneNumber> findByIdAndPatientId(
            Long phoneNumberId,
            Long patientId
    );
}