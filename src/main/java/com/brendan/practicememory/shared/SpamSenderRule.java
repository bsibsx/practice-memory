package com.brendan.practicememory.shared;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;

@Entity
@Table(
        name = "spam_sender_rules",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_spam_sender_channel_value",
                columnNames = {"channel", "sender_value"}
        )
)
public class SpamSenderRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CommunicationChannel channel;

    @Column(name = "sender_value", nullable = false, length = 320)
    private String senderValue;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected SpamSenderRule() {
        // Required by JPA.
    }

    public SpamSenderRule(
            CommunicationChannel channel,
            String senderValue
    ) {
        if (channel == null) {
            throw new IllegalArgumentException("Communication channel must not be null");
        }

        if (senderValue == null || senderValue.isBlank()) {
            throw new IllegalArgumentException("Spam sender value must not be blank");
        }

        this.channel = channel;
        this.senderValue = senderValue.trim();
        this.active = true;
    }

    @PrePersist
    void beforeInsert() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public void activate() {
        active = true;
    }

    public void deactivate() {
        active = false;
    }

    public Long getId() {
        return id;
    }

    public CommunicationChannel getChannel() {
        return channel;
    }

    public String getSenderValue() {
        return senderValue;
    }

    public boolean isActive() {
        return active;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
