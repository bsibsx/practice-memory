package com.brendan.practicememory.shared;

/**
 * Controls whether a communication is part of the staff work queue.
 *
 * Existing development H2 databases may have schema CHECK constraints
 * created when only ACTIVE, SPAM and IRRELEVANT existed. The UI therefore
 * treats every non-ACTIVE value as dismissed, and current dismissal writes
 * IRRELEVANT for backwards compatibility. DISMISSED remains readable for
 * databases created by the intermediate MVP build.
 */
public enum CommunicationTriageStatus {
    ACTIVE,
    DISMISSED,
    SPAM,
    IRRELEVANT;

    public boolean isActive() {
        return this == ACTIVE;
    }

    public boolean isDismissed() {
        return !isActive();
    }
}
