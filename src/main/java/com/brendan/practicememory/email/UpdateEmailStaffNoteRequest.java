package com.brendan.practicememory.email;

import jakarta.validation.constraints.Size;

public record UpdateEmailStaffNoteRequest(

        @Size(
                max = 4000,
                message = "Staff note must not exceed 4000 characters"
        )
        String staffNote

) {
}