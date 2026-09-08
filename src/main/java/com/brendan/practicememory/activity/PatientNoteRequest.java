package com.brendan.practicememory.activity;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PatientNoteRequest(
        @NotBlank
        @Size(max = 4000)
        String text
) {
}