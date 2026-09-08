package com.brendan.practicememory.call;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.time.Instant;

public record OutgoingCallRequest(
        @NotBlank String providerCallId,
        String fromNumber,
        @NotBlank String toNumber,
        @NotNull Instant startedAt,
        @NotNull CallStatus callStatus,
        @PositiveOrZero Integer durationSeconds
) {
}
