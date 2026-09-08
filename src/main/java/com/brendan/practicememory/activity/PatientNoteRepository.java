package com.brendan.practicememory.activity;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PatientNoteRepository
        extends JpaRepository<PatientNote, Long> {

    List<PatientNote> findAllByPatientIdOrderByCreatedAtDesc(
            Long patientId
    );

    Optional<PatientNote> findByIdAndPatientId(
            Long id,
            Long patientId
    );
}
