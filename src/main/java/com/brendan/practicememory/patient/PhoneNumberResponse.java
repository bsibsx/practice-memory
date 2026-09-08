package com.brendan.practicememory.patient;

public record PhoneNumberResponse(
        Long id,
        String number,
        boolean primaryNumber,
        boolean active
) {
    public static PhoneNumberResponse from(PhoneNumber phoneNumber) {
        return new PhoneNumberResponse(
                phoneNumber.getId(),
                phoneNumber.getNumber(),
                phoneNumber.isPrimaryNumber(),
                phoneNumber.isActive()
        );
    }
}
