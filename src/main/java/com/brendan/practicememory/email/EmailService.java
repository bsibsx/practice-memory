package com.brendan.practicememory.email;

import com.brendan.practicememory.patient.AddEmailAddressRequest;
import com.brendan.practicememory.patient.EmailAddress;
import com.brendan.practicememory.patient.EmailAddressRepository;
import com.brendan.practicememory.patient.Patient;
import com.brendan.practicememory.patient.PatientRepository;
import com.brendan.practicememory.patient.PatientService;
import com.brendan.practicememory.shared.CommunicationChannel;
import com.brendan.practicememory.shared.ResourceNotFoundException;
import com.brendan.practicememory.shared.SpamSenderRuleService;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class EmailService {

    private final EmailRecordRepository emailRecordRepository;
    private final EmailAddressRepository emailAddressRepository;
    private final PatientRepository patientRepository;
    private final ObjectProvider<OutboundEmailSender> outboundEmailSenderProvider;
    private final PatientService patientService;
    private final SpamSenderRuleService spamSenderRuleService;

    @Value("${practice.email.from:}")
    private String practiceFromAddress;

    public EmailService(
            EmailRecordRepository emailRecordRepository,
            EmailAddressRepository emailAddressRepository,
            PatientRepository patientRepository,
            ObjectProvider<OutboundEmailSender> outboundEmailSenderProvider,
            PatientService patientService,
            SpamSenderRuleService spamSenderRuleService
    ) {
        this.emailRecordRepository = emailRecordRepository;
        this.emailAddressRepository = emailAddressRepository;
        this.patientRepository = patientRepository;
        this.outboundEmailSenderProvider = outboundEmailSenderProvider;
        this.patientService = patientService;
        this.spamSenderRuleService = spamSenderRuleService;
    }

    @Transactional
    public EmailResponse receiveIncomingEmail(
            String providerMessageId,
            String rawFromAddress,
            String rawToAddress,
            String subject,
            String bodyText,
            Instant sentAt
    ) {
        return receiveIncomingEmail(
                providerMessageId,
                null,
                rawFromAddress,
                rawToAddress,
                subject,
                bodyText,
                sentAt
        );
    }

    @Transactional
    public EmailResponse receiveIncomingEmail(
            String providerMessageId,
            String inReplyToProviderMessageId,
            String rawFromAddress,
            String rawToAddress,
            String subject,
            String bodyText,
            Instant sentAt
    ) {
        return emailRecordRepository
                .findByProviderMessageId(providerMessageId)
                .map(EmailResponse::from)
                .orElseGet(() -> createIncomingEmail(
                        providerMessageId,
                        inReplyToProviderMessageId,
                        rawFromAddress,
                        rawToAddress,
                        subject,
                        bodyText,
                        sentAt
                ));
    }

    private EmailResponse createIncomingEmail(
            String providerMessageId,
            String inReplyToProviderMessageId,
            String rawFromAddress,
            String rawToAddress,
            String subject,
            String bodyText,
            Instant sentAt
    ) {
        String normalizedFromAddress = normalizeAddress(rawFromAddress);
        String normalizedToAddress = normalizeAddress(rawToAddress);

        EmailRecord emailRecord = new EmailRecord(
                providerMessageId,
                inReplyToProviderMessageId,
                normalizedFromAddress,
                normalizedToAddress,
                subject,
                bodyText,
                EmailDirection.INBOUND,
                EmailStatus.UNREAD,
                sentAt
        );

        if (spamSenderRuleService.isSpam(
                CommunicationChannel.EMAIL,
                normalizedFromAddress
        )) {
            emailRecord.markUnmatched();
            emailRecord.dismissFromTriage();
            return EmailResponse.from(emailRecordRepository.save(emailRecord));
        }

        Patient replyPatient = findPatientFromReplyChain(inReplyToProviderMessageId);
        if (replyPatient != null) {
            emailRecord.matchPatient(replyPatient);
        } else {
            applySenderMatching(emailRecord, normalizedFromAddress);
        }

        EmailRecord saved = emailRecordRepository.save(emailRecord);
        if (saved.getPatient() != null) {
            saved.getPatient().markUpdated();
        }

        return EmailResponse.from(saved);
    }

    private Patient findPatientFromReplyChain(
            String inReplyToProviderMessageId
    ) {
        if (
                inReplyToProviderMessageId == null ||
                        inReplyToProviderMessageId.isBlank()
        ) {
            return null;
        }

        return emailRecordRepository
                .findByProviderMessageId(inReplyToProviderMessageId.trim())
                .map(EmailRecord::getPatient)
                .orElse(null);
    }

    private void applySenderMatching(
            EmailRecord emailRecord,
            String normalizedFromAddress
    ) {
        List<EmailAddress> matchingAddresses = emailAddressRepository
                .findAllByAddressAndActiveTrue(normalizedFromAddress);

        Set<Patient> matchingPatients = new LinkedHashSet<>();
        matchingAddresses.forEach(address -> matchingPatients.add(address.getPatient()));

        if (matchingPatients.isEmpty()) {
            emailRecord.markUnmatched();
        } else if (matchingPatients.size() == 1) {
            emailRecord.matchPatient(matchingPatients.iterator().next());
        } else {
            emailRecord.markAmbiguous();
        }
    }

    @Transactional
    public List<EmailResponse> sendPatientEmail(
            Long patientId,
            String subject,
            String bodyText,
            Long emailAddressId,
            boolean sendToAllEmails
    ) {
        return sendPatientEmail(
                patientId,
                subject,
                bodyText,
                emailAddressId,
                sendToAllEmails,
                null
        );
    }

    @Transactional
    public List<EmailResponse> sendPatientEmail(
            Long patientId,
            String subject,
            String bodyText,
            Long emailAddressId,
            boolean sendToAllEmails,
            Long replyToEmailId
    ) {
        if (emailAddressId != null && sendToAllEmails) {
            throw new IllegalArgumentException(
                    "Choose either one email address or all emails, not both"
            );
        }

        if (replyToEmailId != null && sendToAllEmails) {
            throw new IllegalArgumentException(
                    "A reply must be sent to one email address"
            );
        }

        Patient patient = patientRepository
                .findById(patientId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Patient not found: " + patientId
                ));

        EmailRecord replyToEmail = resolveReplyToEmail(
                patientId,
                replyToEmailId
        );

        List<EmailAddress> recipients = resolveRecipients(
                patientId,
                emailAddressId,
                sendToAllEmails
        );

        if (practiceFromAddress == null || practiceFromAddress.isBlank()) {
            throw new IllegalArgumentException(
                    "Practice email address is not configured"
            );
        }

        OutboundEmailSender outboundEmailSender = outboundEmailSenderProvider
                .getIfAvailable();

        String normalizedFromAddress = normalizeAddress(practiceFromAddress);
        String replyHeader = replyToEmail == null
                ? null
                : replyToEmail.getProviderMessageId();

        List<EmailResponse> responses = new ArrayList<>();

        for (EmailAddress recipient : recipients) {
            String providerMessageId = null;
            EmailStatus deliveryStatus = EmailStatus.SENT;

            try {
                if (outboundEmailSender == null) {
                    deliveryStatus = EmailStatus.FAILED;
                } else {
                    providerMessageId = outboundEmailSender.send(
                            normalizedFromAddress,
                            recipient.getAddress(),
                            subject,
                            bodyText,
                            replyHeader
                    );
                }
            } catch (RuntimeException exception) {
                deliveryStatus = EmailStatus.FAILED;
            }

            EmailRecord emailRecord = new EmailRecord(
                    providerMessageId,
                    replyHeader,
                    normalizedFromAddress,
                    recipient.getAddress(),
                    subject,
                    bodyText,
                    EmailDirection.OUTBOUND,
                    deliveryStatus,
                    Instant.now()
            );
            emailRecord.matchPatient(patient);

            EmailRecord saved = emailRecordRepository.save(emailRecord);
            responses.add(EmailResponse.from(saved));
        }

        if (
                replyToEmail != null &&
                        responses.stream().anyMatch(
                                response -> response.emailStatus() == EmailStatus.SENT
                        )
        ) {
            replyToEmail.changeStatus(EmailStatus.RESOLVED);
        }

        patient.markUpdated();
        return responses;
    }

    private EmailRecord resolveReplyToEmail(
            Long patientId,
            Long replyToEmailId
    ) {
        if (replyToEmailId == null) {
            return null;
        }

        EmailRecord emailRecord = emailRecordRepository
                .findById(replyToEmailId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Email not found: " + replyToEmailId
                ));

        if (
                emailRecord.getPatient() == null ||
                        !emailRecord.getPatient().getId().equals(patientId)
        ) {
            throw new ResourceNotFoundException(
                    "Email not found for patient: " + replyToEmailId
            );
        }

        if (emailRecord.getDirection() != EmailDirection.INBOUND) {
            throw new IllegalArgumentException(
                    "Replies can only target an incoming email"
            );
        }

        return emailRecord;
    }

    private List<EmailAddress> resolveRecipients(
            Long patientId,
            Long emailAddressId,
            boolean sendToAllEmails
    ) {
        List<EmailAddress> activeAddresses = emailAddressRepository
                .findAllByPatientIdAndActiveTrueOrderByPrimaryAddressDescIdAsc(
                        patientId
                );

        if (activeAddresses.isEmpty()) {
            throw new IllegalArgumentException(
                    "Patient has no active email address"
            );
        }

        if (sendToAllEmails) {
            return activeAddresses;
        }

        if (emailAddressId != null) {
            EmailAddress selectedAddress = emailAddressRepository
                    .findByIdAndPatientId(emailAddressId, patientId)
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Email address not found for patient: " + emailAddressId
                    ));

            if (!selectedAddress.isActive()) {
                throw new IllegalArgumentException(
                        "Cannot send to an inactive email address"
                );
            }

            return List.of(selectedAddress);
        }

        return List.of(activeAddresses.getFirst());
    }

    @Transactional
    public EmailResponse updateStatus(
            Long emailId,
            EmailStatus status
    ) {
        EmailRecord emailRecord = findEmail(emailId);

        if (emailRecord.getDirection() != EmailDirection.INBOUND) {
            throw new IllegalArgumentException(
                    "Only incoming emails can have their attention status changed manually"
            );
        }

        if (
                status != EmailStatus.UNREAD &&
                        status != EmailStatus.AWAITING_REPLY &&
                        status != EmailStatus.RESOLVED
        ) {
            throw new IllegalArgumentException(
                    "Incoming email status must be UNREAD, AWAITING_REPLY, or RESOLVED"
            );
        }

        emailRecord.changeStatus(status);
        markPatientUpdated(emailRecord);
        return EmailResponse.from(emailRecord);
    }

    @Transactional
    public EmailResponse assignPatient(
            Long emailId,
            Long patientId,
            boolean assignSameSender,
            boolean saveSenderAsContact
    ) {
        EmailRecord emailRecord = findEmail(emailId);

        Patient patient = patientRepository
                .findById(patientId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Patient not found: " + patientId
                ));

        emailRecord.matchPatient(patient);

        if (
                assignSameSender &&
                        emailRecord.getDirection() == EmailDirection.INBOUND
        ) {
            emailRecordRepository
                    .findAllByFromAddressAndPatientMatchStatusIn(
                            emailRecord.getFromAddress(),
                            List.of(
                                    EmailMatchStatus.UNMATCHED,
                                    EmailMatchStatus.AMBIGUOUS
                            )
                    )
                    .stream()
                    .filter(otherEmail -> !otherEmail.getId().equals(emailRecord.getId()))
                    .filter(otherEmail -> !otherEmail.isDismissedFromTriage())
                    .forEach(otherEmail -> otherEmail.matchPatient(patient));
        }

        if (
                saveSenderAsContact &&
                        emailRecord.getDirection() == EmailDirection.INBOUND
        ) {
            patientService.addEmailAddress(
                    patientId,
                    new AddEmailAddressRequest(emailRecord.getFromAddress())
            );
        }

        patient.markUpdated();
        return EmailResponse.from(emailRecord);
    }

    @Transactional
    public EmailResponse updateStaffNote(
            Long emailId,
            String staffNote
    ) {
        EmailRecord emailRecord = findEmail(emailId);
        emailRecord.updateStaffNote(staffNote);
        markPatientUpdated(emailRecord);
        return EmailResponse.from(emailRecord);
    }

    @Transactional
    public EmailResponse dismissCommunication(
            Long emailId,
            boolean treatFutureFromSenderAsSpam
    ) {
        EmailRecord emailRecord = findEmail(emailId);
        emailRecord.dismissFromTriage();

        if (
                treatFutureFromSenderAsSpam &&
                        emailRecord.getDirection() == EmailDirection.INBOUND
        ) {
            spamSenderRuleService.treatAsSpam(
                    CommunicationChannel.EMAIL,
                    emailRecord.getFromAddress()
            );
        }

        return EmailResponse.from(emailRecord);
    }

    @Transactional
    public EmailResponse restoreCommunication(
            Long emailId
    ) {
        EmailRecord emailRecord = findEmail(emailId);
        emailRecord.restoreToActiveTriage();

        if (emailRecord.getDirection() == EmailDirection.INBOUND) {
            spamSenderRuleService.allowSender(
                    CommunicationChannel.EMAIL,
                    emailRecord.getFromAddress()
            );
        }

        return EmailResponse.from(emailRecord);
    }

    @Transactional(readOnly = true)
    public List<EmailResponse> getEmails() {
        return emailRecordRepository
                .findAllByOrderBySentAtDesc()
                .stream()
                .map(EmailResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<EmailResponse> getPatientEmails(
            Long patientId
    ) {
        return emailRecordRepository
                .findAllByPatientIdOrderBySentAtDesc(patientId)
                .stream()
                .map(EmailResponse::from)
                .toList();
    }

    private void markPatientUpdated(
            EmailRecord emailRecord
    ) {
        if (emailRecord.getPatient() != null) {
            emailRecord.getPatient().markUpdated();
        }
    }

    private EmailRecord findEmail(Long emailId) {
        return emailRecordRepository
                .findById(emailId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Email not found: " + emailId
                ));
    }

    private String normalizeAddress(String address) {
        return address.trim().toLowerCase(Locale.ROOT);
    }
}
