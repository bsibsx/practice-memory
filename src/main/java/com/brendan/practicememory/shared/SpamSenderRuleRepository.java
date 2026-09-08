package com.brendan.practicememory.shared;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SpamSenderRuleRepository
        extends JpaRepository<SpamSenderRule, Long> {

    Optional<SpamSenderRule> findByChannelAndSenderValue(
            CommunicationChannel channel,
            String senderValue
    );

    boolean existsByChannelAndSenderValueAndActiveTrue(
            CommunicationChannel channel,
            String senderValue
    );
}
