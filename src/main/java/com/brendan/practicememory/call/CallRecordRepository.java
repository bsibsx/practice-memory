package com.brendan.practicememory.call;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CallRecordRepository
        extends JpaRepository<CallRecord, Long> {

    Optional<CallRecord> findByProviderCallId(
            String providerCallId
    );

    List<CallRecord> findAllByOrderByStartedAtDesc();

    List<CallRecord> findAllByPatientIdOrderByStartedAtDesc(
            Long patientId
    );

    List<CallRecord> findAllByPatientMatchStatusIn(
            List<PatientMatchStatus> patientMatchStatuses
    );
}
