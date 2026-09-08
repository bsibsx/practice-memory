package com.brendan.practicememory.activity;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ActivityAuditEventRepository
        extends JpaRepository<ActivityAuditEvent, Long> {

    List<ActivityAuditEvent>
    findAllByPatientIdOrderByOccurredAtDesc(
            Long patientId
    );

    List<ActivityAuditEvent>
    findAllByPatientIdAndActivityTypeOrderByOccurredAtDesc(
            Long patientId,
            ActivityType activityType
    );

    List<ActivityAuditEvent>
    findAllByPatientIdAndActivityTypeAndActivityIdOrderByOccurredAtDesc(
            Long patientId,
            ActivityType activityType,
            Long activityId
    );
}