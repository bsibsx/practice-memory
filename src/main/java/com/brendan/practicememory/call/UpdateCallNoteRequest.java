package com.brendan.practicememory.call;

import jakarta.validation.constraints.Size;

public record UpdateCallNoteRequest(
        @Size(max = 4000) String note
) {
}
