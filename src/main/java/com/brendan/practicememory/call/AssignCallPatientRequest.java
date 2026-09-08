package com.brendan.practicememory.call;

import jakarta.validation.constraints.NotNull;

public record AssignCallPatientRequest(

        @NotNull
        Long patientId,

        boolean assignSameCaller,

        boolean saveCallerAsContact

) {
}