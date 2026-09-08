package com.brendan.practicememory.activity;

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
@RequestMapping("/api/patients/{patientId}")
public class PatientActivityController {

    private final PatientActivityService patientActivityService;

    public PatientActivityController(
            PatientActivityService patientActivityService
    ) {
        this.patientActivityService = patientActivityService;
    }

    @GetMapping("/activity")
    public List<PatientActivityResponse> getActivity(
            @PathVariable Long patientId
    ) {
        return patientActivityService.getActivity(
                patientId
        );
    }

    @GetMapping("/activity/removed")
    public List<PatientActivityResponse> getRemovedActivity(
            @PathVariable Long patientId
    ) {
        return patientActivityService.getRemovedActivity(
                patientId
        );
    }

    @PostMapping("/notes")
    public ResponseEntity<PatientActivityResponse> createNote(
            @PathVariable Long patientId,
            @Valid @RequestBody PatientNoteRequest request
    ) {
        PatientActivityResponse response =
                patientActivityService.createNote(
                        patientId,
                        request.text()
                );

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }

    @PatchMapping("/notes/{noteId}")
    public PatientActivityResponse updateNote(
            @PathVariable Long patientId,
            @PathVariable Long noteId,
            @Valid @RequestBody PatientNoteRequest request
    ) {
        return patientActivityService.updateNote(
                patientId,
                noteId,
                request.text()
        );
    }

    @PatchMapping("/notes/{noteId}/remove")
    public PatientActivityResponse removeNote(
            @PathVariable Long patientId,
            @PathVariable Long noteId
    ) {
        return patientActivityService.removeNote(
                patientId,
                noteId
        );
    }

    @PatchMapping("/notes/{noteId}/restore")
    public PatientActivityResponse restoreNote(
            @PathVariable Long patientId,
            @PathVariable Long noteId
    ) {
        return patientActivityService.restoreNote(
                patientId,
                noteId
        );
    }

    @PatchMapping("/calls/{callId}/remove")
    public PatientActivityResponse removeCall(
            @PathVariable Long patientId,
            @PathVariable Long callId
    ) {
        return patientActivityService.removeCall(
                patientId,
                callId
        );
    }

    @PatchMapping("/calls/{callId}/restore")
    public PatientActivityResponse restoreCall(
            @PathVariable Long patientId,
            @PathVariable Long callId
    ) {
        return patientActivityService.restoreCall(
                patientId,
                callId
        );
    }

    @PatchMapping("/emails/{emailId}/remove")
    public PatientActivityResponse removeEmail(
            @PathVariable Long patientId,
            @PathVariable Long emailId
    ) {
        return patientActivityService.removeEmail(
                patientId,
                emailId
        );
    }

    @PatchMapping("/emails/{emailId}/restore")
    public PatientActivityResponse restoreEmail(
            @PathVariable Long patientId,
            @PathVariable Long emailId
    ) {
        return patientActivityService.restoreEmail(
                patientId,
                emailId
        );
    }
}