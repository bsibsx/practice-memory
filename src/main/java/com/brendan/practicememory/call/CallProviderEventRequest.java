package com.brendan.practicememory.call;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.time.Instant;

/**
 * Provider-neutral call event. A real phone-provider adapter should map its
 * webhook payload into this shape. Repeated events with the same
 * providerCallId update the existing call instead of creating duplicates.
 */
public record CallProviderEventRequest(
        @NotBlank String providerCallId,
        @NotNull CallDirection direction,
        String fromNumber,
        String toNumber,
        @NotNull Instant startedAt,
        @NotNull CallStatus callStatus,
        @PositiveOrZero Integer durationSeconds
) {
}
