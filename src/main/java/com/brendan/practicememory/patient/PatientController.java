package com.brendan.practicememory.patient;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/patients")
public class PatientController {

    private final PatientService patientService;

    public PatientController(
            PatientService patientService
    ) {
        this.patientService = patientService;
    }

    @PostMapping
    public ResponseEntity<PatientResponse> createPatient(
            @Valid @RequestBody CreatePatientRequest request
    ) {
        PatientResponse response =
                patientService.createPatient(request);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }

    @GetMapping
    public List<PatientResponse> getPatients() {
        return patientService.getPatients();
    }

    @GetMapping("/{patientId}")
    public PatientResponse getPatient(
            @PathVariable Long patientId
    ) {
        return patientService.getPatient(
                patientId
        );
    }

    @PatchMapping("/{patientId}")
    public PatientResponse updatePatient(
            @PathVariable Long patientId,
            @Valid @RequestBody UpdatePatientRequest request
    ) {
        return patientService.updatePatient(
                patientId,
                request
        );
    }

    @PostMapping("/{patientId}/phone-numbers")
    public ResponseEntity<PatientResponse> addPhoneNumber(
            @PathVariable Long patientId,
            @Valid @RequestBody AddPhoneNumberRequest request
    ) {
        PatientResponse response =
                patientService.addPhoneNumber(
                        patientId,
                        request
                );

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }

    @PatchMapping(
            "/{patientId}/phone-numbers/{phoneNumberId}/primary"
    )
    public PatientResponse setPrimaryPhoneNumber(
            @PathVariable Long patientId,
            @PathVariable Long phoneNumberId
    ) {
        return patientService.setPrimaryPhoneNumber(
                patientId,
                phoneNumberId
        );
    }

    @PatchMapping(
            "/{patientId}/phone-numbers/{phoneNumberId}/deactivate"
    )
    public PatientResponse deactivatePhoneNumber(
            @PathVariable Long patientId,
            @PathVariable Long phoneNumberId
    ) {
        return patientService.deactivatePhoneNumber(
                patientId,
                phoneNumberId
        );
    }

    @PostMapping("/{patientId}/email-addresses")
    public ResponseEntity<EmailAddressResponse> addEmailAddress(
            @PathVariable Long patientId,
            @Valid @RequestBody AddEmailAddressRequest request
    ) {
        EmailAddressResponse response =
                patientService.addEmailAddress(
                        patientId,
                        request
                );

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }

    @GetMapping("/{patientId}/email-addresses")
    public List<EmailAddressResponse> getEmailAddresses(
            @PathVariable Long patientId
    ) {
        return patientService.getEmailAddresses(
                patientId
        );
    }

    @PatchMapping(
            "/{patientId}/email-addresses/{emailAddressId}/primary"
    )
    public List<EmailAddressResponse> setPrimaryEmailAddress(
            @PathVariable Long patientId,
            @PathVariable Long emailAddressId
    ) {
        return patientService.setPrimaryEmailAddress(
                patientId,
                emailAddressId
        );
    }

    @PatchMapping(
            "/{patientId}/email-addresses/{emailAddressId}/deactivate"
    )
    public List<EmailAddressResponse> deactivateEmailAddress(
            @PathVariable Long patientId,
            @PathVariable Long emailAddressId
    ) {
        return patientService.deactivateEmailAddress(
                patientId,
                emailAddressId
        );
    }
}