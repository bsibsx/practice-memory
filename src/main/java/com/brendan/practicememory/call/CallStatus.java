package com.brendan.practicememory.call;

public enum CallStatus {
    RINGING,
    ANSWERED,
    MISSED,
    NO_ANSWER,
    COMPLETED,
    FAILED;

    public boolean isTerminal() {
        return this == MISSED ||
                this == NO_ANSWER ||
                this == COMPLETED ||
                this == FAILED;
    }
}
