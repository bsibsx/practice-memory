package com.brendan.practicememory.call;

import jakarta.validation.constraints.NotNull;

public record UpdateFollowUpRequest(
        @NotNull FollowUpStatus followUpStatus
) {
}
