package com.brendan.practicememory.email;

import jakarta.validation.constraints.NotNull;

public record UpdateEmailStatusRequest(

        @NotNull
        EmailStatus status

) {
}