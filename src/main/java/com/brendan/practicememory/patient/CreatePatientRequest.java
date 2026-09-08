package com.brendan.practicememory.patient;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;

public record CreatePatientRequest(
        @NotBlank String firstName,
        @NotBlank String lastName,
        LocalDate dateOfBirth,
        @NotNull List<@NotBlank String> phoneNumbers,
        List<@NotBlank @Email @Size(max = 320) String> emailAddresses
) {
}
