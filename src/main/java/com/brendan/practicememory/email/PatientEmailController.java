package com.brendan.practicememory.email;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/patients/{patientId}/emails")
public class PatientEmailController {

    private final EmailService emailService;

    public PatientEmailController(
            EmailService emailService
    ) {
        this.emailService = emailService;
    }

    @PostMapping
    public List<EmailResponse> sendEmail(
            @PathVariable Long patientId,
            @Valid @RequestBody SendEmailRequest request
    ) {
        return emailService.sendPatientEmail(
                patientId,
                request.subject(),
                request.bodyText(),
                request.emailAddressId(),
                request.sendToAllEmails(),
                request.replyToEmailId()
        );
    }
}
