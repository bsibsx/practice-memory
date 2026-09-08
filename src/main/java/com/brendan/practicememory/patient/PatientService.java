package com.brendan.practicememory.patient;

import com.brendan.practicememory.shared.PhoneNumberNormalizer;
import com.brendan.practicememory.shared.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class PatientService {

    private final PatientRepository patientRepository;
    private final PhoneNumberRepository phoneNumberRepository;
    private final EmailAddressRepository emailAddressRepository;
    private final PhoneNumberNormalizer phoneNumberNormalizer;

    public PatientService(
            PatientRepository patientRepository,
            PhoneNumberRepository phoneNumberRepository,
            EmailAddressRepository emailAddressRepository,
            PhoneNumberNormalizer phoneNumberNormalizer
    ) {
        this.patientRepository = patientRepository;
        this.phoneNumberRepository = phoneNumberRepository;
        this.emailAddressRepository = emailAddressRepository;
        this.phoneNumberNormalizer = phoneNumberNormalizer;
    }

    @Transactional
    public PatientResponse createPatient(
            CreatePatientRequest request
    ) {
        Patient patient = patientRepository.save(
                new Patient(
                        request.firstName(),
                        request.lastName(),
                        request.dateOfBirth()
                )
        );

        Set<String> normalizedNumbers =
                new LinkedHashSet<>();

        for (
                String rawNumber :
                request.phoneNumbers()
        ) {
            normalizedNumbers.add(
                    phoneNumberNormalizer.normalize(
                            rawNumber
                    )
            );
        }

        boolean primary = true;

        for (
                String normalizedNumber :
                normalizedNumbers
        ) {
            phoneNumberRepository.save(
                    new PhoneNumber(
                            patient,
                            normalizedNumber,
                            primary
                    )
            );

            primary = false;
        }

        Set<String> normalizedEmailAddresses =
                (request.emailAddresses() == null
                        ? List.<String>of()
                        : request.emailAddresses())
                        .stream()
                        .map(address ->
                                address.trim()
                                        .toLowerCase(Locale.ROOT)
                        )
                        .collect(
                                java.util.stream.Collectors.toCollection(
                                        LinkedHashSet::new
                                )
                        );

        boolean primaryEmail = true;

        for (
                String normalizedAddress :
                normalizedEmailAddresses
        ) {
            emailAddressRepository.save(
                    new EmailAddress(
                            patient,
                            normalizedAddress,
                            primaryEmail
                    )
            );

            primaryEmail = false;
        }

        return buildPatientResponse(
                patient
        );
    }

    @Transactional
    public PatientResponse updatePatient(
            Long patientId,
            UpdatePatientRequest request
    ) {
        Patient patient =
                findPatient(patientId);

        patient.updateDetails(
                request.firstName(),
                request.lastName(),
                request.dateOfBirth()
        );

        patient.markUpdated();

        return buildPatientResponse(
                patient
        );
    }

    @Transactional
    public PatientResponse addPhoneNumber(
            Long patientId,
            AddPhoneNumberRequest request
    ) {
        Patient patient =
                findPatient(patientId);

        String normalizedNumber =
                phoneNumberNormalizer.normalize(
                        request.number()
                );

        List<PhoneNumber> activeNumbers =
                phoneNumberRepository
                        .findAllByPatientIdAndActiveTrueOrderByPrimaryNumberDescIdAsc(
                                patientId
                        );

        PhoneNumber existingNumber =
                phoneNumberRepository
                        .findByPatientIdAndNumber(
                                patientId,
                                normalizedNumber
                        )
                        .orElse(null);

        if (existingNumber != null) {

            if (!existingNumber.isActive()) {
                existingNumber.activate();

                if (activeNumbers.isEmpty()) {
                    existingNumber.makePrimary();
                }

                patient.markUpdated();
            }

            return buildPatientResponse(
                    patient
            );
        }

        boolean primary =
                activeNumbers.isEmpty();

        phoneNumberRepository.save(
                new PhoneNumber(
                        patient,
                        normalizedNumber,
                        primary
                )
        );

        patient.markUpdated();

        return buildPatientResponse(
                patient
        );
    }

    @Transactional
    public PatientResponse setPrimaryPhoneNumber(
            Long patientId,
            Long phoneNumberId
    ) {
        Patient patient =
                findPatient(patientId);

        PhoneNumber selectedNumber =
                findPatientPhoneNumber(
                        patientId,
                        phoneNumberId
                );

        if (!selectedNumber.isActive()) {
            throw new IllegalArgumentException(
                    "Inactive phone number cannot be primary"
            );
        }

        List<PhoneNumber> activeNumbers =
                phoneNumberRepository
                        .findAllByPatientIdAndActiveTrueOrderByPrimaryNumberDescIdAsc(
                                patientId
                        );

        for (
                PhoneNumber phoneNumber :
                activeNumbers
        ) {
            if (
                    !phoneNumber.getId()
                            .equals(phoneNumberId)
            ) {
                phoneNumber.removePrimary();
            }
        }

        selectedNumber.makePrimary();

        patient.markUpdated();

        return buildPatientResponse(
                patient
        );
    }

    @Transactional
    public PatientResponse deactivatePhoneNumber(
            Long patientId,
            Long phoneNumberId
    ) {
        Patient patient =
                findPatient(patientId);

        PhoneNumber selectedNumber =
                findPatientPhoneNumber(
                        patientId,
                        phoneNumberId
                );

        if (!selectedNumber.isActive()) {
            return buildPatientResponse(
                    patient
            );
        }

        List<PhoneNumber> activeNumbers =
                phoneNumberRepository
                        .findAllByPatientIdAndActiveTrueOrderByPrimaryNumberDescIdAsc(
                                patientId
                        );

        boolean wasPrimary =
                selectedNumber.isPrimaryNumber();

        selectedNumber.deactivate();

        if (wasPrimary) {
            activeNumbers
                    .stream()
                    .filter(
                            phoneNumber ->
                                    !phoneNumber
                                            .getId()
                                            .equals(
                                                    phoneNumberId
                                            )
                    )
                    .filter(
                            PhoneNumber::isActive
                    )
                    .findFirst()
                    .ifPresent(
                            PhoneNumber::makePrimary
                    );
        }

        patient.markUpdated();

        return buildPatientResponse(
                patient
        );
    }

    @Transactional(readOnly = true)
    public PatientResponse getPatient(
            Long patientId
    ) {
        Patient patient =
                findPatient(patientId);

        return buildPatientResponse(
                patient
        );
    }

    @Transactional(readOnly = true)
    public List<PatientResponse> getPatients() {
        return patientRepository
                .findAll()
                .stream()
                .map(
                        this::buildPatientResponse
                )
                .toList();
    }

    @Transactional
    public EmailAddressResponse addEmailAddress(
            Long patientId,
            AddEmailAddressRequest request
    ) {
        Patient patient =
                findPatient(patientId);

        String normalizedAddress =
                request.address()
                        .trim()
                        .toLowerCase(
                                Locale.ROOT
                        );

        List<EmailAddress> activeAddresses =
                emailAddressRepository
                        .findAllByPatientIdAndActiveTrueOrderByPrimaryAddressDescIdAsc(
                                patientId
                        );

        EmailAddress existingAddress =
                emailAddressRepository
                        .findByPatientIdAndAddress(
                                patientId,
                                normalizedAddress
                        )
                        .orElse(null);

        if (existingAddress != null) {

            if (!existingAddress.isActive()) {
                existingAddress.activate();

                if (activeAddresses.isEmpty()) {
                    existingAddress.makePrimary();
                }

                patient.markUpdated();
            }

            return EmailAddressResponse.from(
                    existingAddress
            );
        }

        boolean primaryAddress =
                activeAddresses.isEmpty();

        EmailAddress emailAddress =
                new EmailAddress(
                        patient,
                        normalizedAddress,
                        primaryAddress
                );

        EmailAddress saved =
                emailAddressRepository.save(
                        emailAddress
                );

        patient.markUpdated();

        return EmailAddressResponse.from(
                saved
        );
    }

    @Transactional
    public List<EmailAddressResponse> setPrimaryEmailAddress(
            Long patientId,
            Long emailAddressId
    ) {
        Patient patient =
                findPatient(patientId);

        EmailAddress selectedAddress =
                findPatientEmailAddress(
                        patientId,
                        emailAddressId
                );

        if (!selectedAddress.isActive()) {
            throw new IllegalArgumentException(
                    "Inactive email address cannot be primary"
            );
        }

        List<EmailAddress> activeAddresses =
                emailAddressRepository
                        .findAllByPatientIdAndActiveTrueOrderByPrimaryAddressDescIdAsc(
                                patientId
                        );

        for (
                EmailAddress emailAddress :
                activeAddresses
        ) {
            if (
                    !emailAddress.getId()
                            .equals(emailAddressId)
            ) {
                emailAddress.removePrimary();
            }
        }

        selectedAddress.makePrimary();

        patient.markUpdated();

        return buildEmailAddressResponses(
                patientId
        );
    }

    @Transactional
    public List<EmailAddressResponse> deactivateEmailAddress(
            Long patientId,
            Long emailAddressId
    ) {
        Patient patient =
                findPatient(patientId);

        EmailAddress selectedAddress =
                findPatientEmailAddress(
                        patientId,
                        emailAddressId
                );

        if (!selectedAddress.isActive()) {
            return buildEmailAddressResponses(
                    patientId
            );
        }

        List<EmailAddress> activeAddresses =
                emailAddressRepository
                        .findAllByPatientIdAndActiveTrueOrderByPrimaryAddressDescIdAsc(
                                patientId
                        );

        boolean wasPrimary =
                selectedAddress.isPrimaryAddress();

        selectedAddress.deactivate();

        if (wasPrimary) {
            activeAddresses
                    .stream()
                    .filter(
                            emailAddress ->
                                    !emailAddress
                                            .getId()
                                            .equals(
                                                    emailAddressId
                                            )
                    )
                    .filter(
                            EmailAddress::isActive
                    )
                    .findFirst()
                    .ifPresent(
                            EmailAddress::makePrimary
                    );
        }

        patient.markUpdated();

        return buildEmailAddressResponses(
                patientId
        );
    }

    @Transactional(readOnly = true)
    public List<EmailAddressResponse> getEmailAddresses(
            Long patientId
    ) {
        findPatient(patientId);

        return buildEmailAddressResponses(
                patientId
        );
    }

    private PatientResponse buildPatientResponse(
            Patient patient
    ) {
        List<PhoneNumber> numbers =
                phoneNumberRepository
                        .findAllByPatientIdAndActiveTrueOrderByPrimaryNumberDescIdAsc(
                                patient.getId()
                        );

        List<EmailAddress> emailAddresses =
                emailAddressRepository
                        .findAllByPatientIdAndActiveTrueOrderByPrimaryAddressDescIdAsc(
                                patient.getId()
                        );

        return PatientResponse.from(
                patient,
                numbers,
                emailAddresses
        );
    }

    private List<EmailAddressResponse> buildEmailAddressResponses(
            Long patientId
    ) {
        return emailAddressRepository
                .findAllByPatientIdAndActiveTrueOrderByPrimaryAddressDescIdAsc(
                        patientId
                )
                .stream()
                .map(
                        EmailAddressResponse::from
                )
                .toList();
    }

    private Patient findPatient(
            Long patientId
    ) {
        return patientRepository
                .findById(patientId)
                .orElseThrow(
                        () ->
                                new ResourceNotFoundException(
                                        "Patient not found: " +
                                                patientId
                                )
                );
    }

    private PhoneNumber findPatientPhoneNumber(
            Long patientId,
            Long phoneNumberId
    ) {
        return phoneNumberRepository
                .findByIdAndPatientId(
                        phoneNumberId,
                        patientId
                )
                .orElseThrow(
                        () ->
                                new ResourceNotFoundException(
                                        "Phone number not found: " +
                                                phoneNumberId
                                )
                );
    }

    private EmailAddress findPatientEmailAddress(
            Long patientId,
            Long emailAddressId
    ) {
        return emailAddressRepository
                .findByIdAndPatientId(
                        emailAddressId,
                        patientId
                )
                .orElseThrow(
                        () ->
                                new ResourceNotFoundException(
                                        "Email address not found: " +
                                                emailAddressId
                                )
                );
    }
}
