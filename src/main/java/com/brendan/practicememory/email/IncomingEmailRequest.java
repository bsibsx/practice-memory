package com.brendan.practicememory.email;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public record IncomingEmailRequest(
        @NotBlank
        @Size(max = 255)
        String providerMessageId,

        @Size(max = 255)
        String inReplyToProviderMessageId,

        @NotBlank
        @Email
        @Size(max = 320)
        String fromAddress,

        @NotBlank
        @Email
        @Size(max = 320)
        String toAddress,

        @Size(max = 500)
        String subject,

        @NotBlank
        String bodyText,

        @NotNull
        Instant sentAt
) {
}
