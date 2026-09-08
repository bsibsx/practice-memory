package com.brendan.practicememory.patient;

public record EmailAddressResponse(
        Long id,
        String address,
        boolean primaryAddress,
        boolean active
) {

    public static EmailAddressResponse from(
            EmailAddress emailAddress
    ) {
        return new EmailAddressResponse(
                emailAddress.getId(),
                emailAddress.getAddress(),
                emailAddress.isPrimaryAddress(),
                emailAddress.isActive()
        );
    }
}