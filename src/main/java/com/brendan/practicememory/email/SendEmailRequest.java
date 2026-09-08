package com.brendan.practicememory.email;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SendEmailRequest(
        @Size(max = 500)
        String subject,

        @NotBlank
        String bodyText,

        Long emailAddressId,

        boolean sendToAllEmails,

        Long replyToEmailId
) {
}
