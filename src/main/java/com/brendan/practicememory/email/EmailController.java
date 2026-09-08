package com.brendan.practicememory.email;

import com.brendan.practicememory.shared.DismissCommunicationRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/emails")
public class EmailController {

    private final EmailService emailService;

    public EmailController(
            EmailService emailService
    ) {
        this.emailService = emailService;
    }

    @PostMapping("/incoming")
    public EmailResponse receiveIncomingEmail(
            @Valid @RequestBody IncomingEmailRequest request
    ) {
        return emailService.receiveIncomingEmail(
                request.providerMessageId(),
                request.inReplyToProviderMessageId(),
                request.fromAddress(),
                request.toAddress(),
                request.subject(),
                request.bodyText(),
                request.sentAt()
        );
    }

    @GetMapping
    public List<EmailResponse> getEmails() {
        return emailService.getEmails();
    }

    @PatchMapping("/{emailId}/status")
    public EmailResponse updateStatus(
            @PathVariable Long emailId,
            @Valid @RequestBody UpdateEmailStatusRequest request
    ) {
        return emailService.updateStatus(emailId, request.status());
    }

    @PatchMapping("/{emailId}/note")
    public EmailResponse updateStaffNote(
            @PathVariable Long emailId,
            @Valid @RequestBody UpdateEmailStaffNoteRequest request
    ) {
        return emailService.updateStaffNote(emailId, request.staffNote());
    }

    @PatchMapping("/{emailId}/patient")
    public EmailResponse assignPatient(
            @PathVariable Long emailId,
            @Valid @RequestBody AssignEmailPatientRequest request
    ) {
        return emailService.assignPatient(
                emailId,
                request.patientId(),
                request.assignSameSender(),
                request.saveSenderAsContact()
        );
    }

    @PatchMapping("/{emailId}/dismiss")
    public EmailResponse dismissCommunication(
            @PathVariable Long emailId,
            @RequestBody(required = false) DismissCommunicationRequest request
    ) {
        return emailService.dismissCommunication(
                emailId,
                request != null && request.treatFutureFromSenderAsSpam()
        );
    }

    @PatchMapping("/{emailId}/restore")
    public EmailResponse restoreCommunication(
            @PathVariable Long emailId
    ) {
        return emailService.restoreCommunication(emailId);
    }
}
