package com.brendan.practicememory.email;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EmailRecordRepository
        extends JpaRepository<EmailRecord, Long> {

    Optional<EmailRecord> findByProviderMessageId(
            String providerMessageId
    );

    List<EmailRecord> findAllByPatientIdOrderBySentAtDesc(
            Long patientId
    );

    List<EmailRecord> findAllByOrderBySentAtDesc();

    List<EmailRecord> findAllByFromAddressAndPatientMatchStatusIn(
            String fromAddress,
            List<EmailMatchStatus> patientMatchStatuses
    );
}