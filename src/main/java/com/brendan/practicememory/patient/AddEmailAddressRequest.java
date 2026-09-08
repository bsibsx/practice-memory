package com.brendan.practicememory.patient;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AddEmailAddressRequest(
        @NotBlank
        @Email
        @Size(max = 320)
        String address
) {
}