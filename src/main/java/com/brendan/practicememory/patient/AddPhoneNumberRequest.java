package com.brendan.practicememory.patient;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AddPhoneNumberRequest(

        @NotBlank
        @Size(max = 32)
        String number

) {
}