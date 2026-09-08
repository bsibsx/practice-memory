package com.brendan.practicememory.email;

import jakarta.validation.constraints.NotNull;

public record AssignEmailPatientRequest(

        @NotNull
        Long patientId,

        boolean assignSameSender,

        boolean saveSenderAsContact

) {
}