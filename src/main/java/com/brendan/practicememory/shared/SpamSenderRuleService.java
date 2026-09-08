package com.brendan.practicememory.shared;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SpamSenderRuleService {

    private final SpamSenderRuleRepository spamSenderRuleRepository;

    public SpamSenderRuleService(
            SpamSenderRuleRepository spamSenderRuleRepository
    ) {
        this.spamSenderRuleRepository = spamSenderRuleRepository;
    }

    @Transactional(readOnly = true)
    public boolean isSpam(
            CommunicationChannel channel,
            String senderValue
    ) {
        return spamSenderRuleRepository
                .existsByChannelAndSenderValueAndActiveTrue(
                        channel,
                        senderValue
                );
    }

    @Transactional
    public void treatAsSpam(
            CommunicationChannel channel,
            String senderValue
    ) {
        SpamSenderRule rule = spamSenderRuleRepository
                .findByChannelAndSenderValue(channel, senderValue)
                .orElseGet(() -> new SpamSenderRule(channel, senderValue));

        rule.activate();
        spamSenderRuleRepository.save(rule);
    }

    @Transactional
    public void allowSender(
            CommunicationChannel channel,
            String senderValue
    ) {
        spamSenderRuleRepository
                .findByChannelAndSenderValue(channel, senderValue)
                .ifPresent(SpamSenderRule::deactivate);
    }
}
