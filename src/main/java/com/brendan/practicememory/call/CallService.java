package com.brendan.practicememory.call;

import com.brendan.practicememory.patient.AddPhoneNumberRequest;
import com.brendan.practicememory.patient.Patient;
import com.brendan.practicememory.patient.PatientRepository;
import com.brendan.practicememory.patient.PatientService;
import com.brendan.practicememory.patient.PhoneNumber;
import com.brendan.practicememory.patient.PhoneNumberRepository;
import com.brendan.practicememory.shared.CommunicationChannel;
import com.brendan.practicememory.shared.PhoneNumberNormalizer;
import com.brendan.practicememory.shared.ResourceNotFoundException;
import com.brendan.practicememory.shared.SpamSenderRuleService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;

@Service
public class CallService {

    private final CallRecordRepository callRecordRepository;
    private final PhoneNumberRepository phoneNumberRepository;
    private final PhoneNumberNormalizer phoneNumberNormalizer;
    private final PatientRepository patientRepository;
    private final PatientService patientService;
    private final SpamSenderRuleService spamSenderRuleService;

    public CallService(
            CallRecordRepository callRecordRepository,
            PhoneNumberRepository phoneNumberRepository,
            PhoneNumberNormalizer phoneNumberNormalizer,
            PatientRepository patientRepository,
            PatientService patientService,
            SpamSenderRuleService spamSenderRuleService
    ) {
        this.callRecordRepository = callRecordRepository;
        this.phoneNumberRepository = phoneNumberRepository;
        this.phoneNumberNormalizer = phoneNumberNormalizer;
        this.patientRepository = patientRepository;
        this.patientService = patientService;
        this.spamSenderRuleService = spamSenderRuleService;
    }

    @Transactional
    public CallResponse receiveIncomingCall(
            String providerCallId,
            String rawFromNumber,
            String rawToNumber,
            Instant startedAt,
            CallStatus callStatus,
            Integer durationSeconds
    ) {
        return recordCallEvent(
                providerCallId,
                CallDirection.INBOUND,
                rawFromNumber,
                rawToNumber,
                startedAt,
                callStatus,
                durationSeconds
        );
    }

    /** Backwards-compatible overload used by the original tests/API shape. */
    @Transactional
    public CallResponse receiveIncomingCall(
            String providerCallId,
            String rawFromNumber,
            Instant startedAt,
            CallStatus callStatus,
            Integer durationSeconds
    ) {
        return receiveIncomingCall(
                providerCallId,
                rawFromNumber,
                null,
                startedAt,
                callStatus,
                durationSeconds
        );
    }

    @Transactional
    public CallResponse recordOutgoingCall(
            String providerCallId,
            String rawFromNumber,
            String rawToNumber,
            Instant startedAt,
            CallStatus callStatus,
            Integer durationSeconds
    ) {
        return recordCallEvent(
                providerCallId,
                CallDirection.OUTBOUND,
                rawFromNumber,
                rawToNumber,
                startedAt,
                callStatus,
                durationSeconds
        );
    }

    @Transactional
    public CallResponse recordCallEvent(
            String providerCallId,
            CallDirection direction,
            String rawFromNumber,
            String rawToNumber,
            Instant startedAt,
            CallStatus callStatus,
            Integer durationSeconds
    ) {
        if (direction == null) {
            throw new IllegalArgumentException("Call direction must not be null");
        }

        String normalizedFrom = normalizeProviderNumber(rawFromNumber);
        String normalizedTo = normalizeProviderNumber(rawToNumber);

        if (direction == CallDirection.OUTBOUND && normalizedTo == null) {
            throw new IllegalArgumentException(
                    "Outbound calls require a valid destination number"
            );
        }

        if (direction == CallDirection.OUTBOUND && callStatus == CallStatus.MISSED) {
            throw new IllegalArgumentException(
                    "Outbound calls use NO_ANSWER, not MISSED"
            );
        }

        if (direction == CallDirection.INBOUND && callStatus == CallStatus.NO_ANSWER) {
            throw new IllegalArgumentException(
                    "Inbound calls use MISSED, not NO_ANSWER"
            );
        }

        return callRecordRepository
                .findByProviderCallId(providerCallId)
                .map(existing -> updateExistingCall(
                        existing,
                        direction,
                        normalizedFrom,
                        normalizedTo,
                        startedAt,
                        callStatus,
                        durationSeconds
                ))
                .orElseGet(() -> createCall(
                        providerCallId,
                        direction,
                        normalizedFrom,
                        normalizedTo,
                        startedAt,
                        callStatus,
                        durationSeconds
                ));
    }

    private CallResponse createCall(
            String providerCallId,
            CallDirection direction,
            String normalizedFrom,
            String normalizedTo,
            Instant startedAt,
            CallStatus callStatus,
            Integer durationSeconds
    ) {
        CallRecord callRecord = new CallRecord(
                providerCallId,
                direction,
                normalizedFrom,
                normalizedTo,
                startedAt,
                callStatus,
                durationSeconds
        );

        applyAutomaticTriageAndMatching(callRecord);

        CallRecord saved = callRecordRepository.save(callRecord);
        markPatientUpdated(saved);
        return CallResponse.from(saved);
    }

    private CallResponse updateExistingCall(
            CallRecord callRecord,
            CallDirection direction,
            String normalizedFrom,
            String normalizedTo,
            Instant startedAt,
            CallStatus callStatus,
            Integer durationSeconds
    ) {
        callRecord.updateProviderEvent(
                direction,
                normalizedFrom,
                normalizedTo,
                startedAt,
                callStatus,
                durationSeconds
        );

        if (callRecord.getPatientMatchStatus() != PatientMatchStatus.MATCHED &&
                !callRecord.isDismissedFromTriage()) {
            applyAutomaticTriageAndMatching(callRecord);
        }

        markPatientUpdated(callRecord);
        return CallResponse.from(callRecord);
    }

    private void applyAutomaticTriageAndMatching(CallRecord callRecord) {
        String counterpartyNumber = callRecord.getCounterpartyNumber();

        if (counterpartyNumber == null) {
            callRecord.markUnmatched();
            return;
        }

        if (spamSenderRuleService.isSpam(
                CommunicationChannel.CALL,
                counterpartyNumber
        )) {
            callRecord.markUnmatched();
            callRecord.dismissFromTriage();
            return;
        }

        List<PhoneNumber> matchingNumbers = phoneNumberRepository
                .findAllByNumberAndActiveTrue(counterpartyNumber);

        Set<Patient> matchingPatients = new LinkedHashSet<>();
        matchingNumbers.forEach(number -> matchingPatients.add(number.getPatient()));

        if (matchingPatients.isEmpty()) {
            callRecord.markUnmatched();
        } else if (matchingPatients.size() == 1) {
            callRecord.matchPatient(matchingPatients.iterator().next());
        } else {
            callRecord.markAmbiguous();
        }
    }

    @Transactional(readOnly = true)
    public List<CallResponse> getCalls() {
        return callRecordRepository
                .findAllByOrderByStartedAtDesc()
                .stream()
                .map(CallResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CallResponse> getPatientCalls(Long patientId) {
        return callRecordRepository
                .findAllByPatientIdOrderByStartedAtDesc(patientId)
                .stream()
                .map(CallResponse::from)
                .toList();
    }

    @Transactional
    public CallResponse updateNote(Long callId, String note) {
        CallRecord callRecord = findCall(callId);
        callRecord.updateNote(note);
        markPatientUpdated(callRecord);
        return CallResponse.from(callRecord);
    }

    @Transactional
    public CallResponse updateFollowUpStatus(
            Long callId,
            FollowUpStatus followUpStatus
    ) {
        CallRecord callRecord = findCall(callId);
        callRecord.changeFollowUpStatus(followUpStatus);
        markPatientUpdated(callRecord);
        return CallResponse.from(callRecord);
    }

    @Transactional
    public CallResponse assignPatient(
            Long callId,
            Long patientId,
            boolean assignSameCaller,
            boolean saveCallerAsContact
    ) {
        CallRecord callRecord = findCall(callId);

        Patient patient = patientRepository
                .findById(patientId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Patient not found: " + patientId
                ));

        callRecord.matchPatient(patient);
        String counterpartyNumber = callRecord.getCounterpartyNumber();

        if (assignSameCaller && counterpartyNumber != null) {
            callRecordRepository
                    .findAllByPatientMatchStatusIn(
                            List.of(
                                    PatientMatchStatus.UNMATCHED,
                                    PatientMatchStatus.AMBIGUOUS
                            )
                    )
                    .stream()
                    .filter(otherCall -> !Objects.equals(
                            otherCall.getId(),
                            callRecord.getId()
                    ))
                    .filter(otherCall -> !otherCall.isDismissedFromTriage())
                    .filter(otherCall -> Objects.equals(
                            otherCall.getCounterpartyNumber(),
                            counterpartyNumber
                    ))
                    .forEach(otherCall -> otherCall.matchPatient(patient));
        }

        if (saveCallerAsContact) {
            if (counterpartyNumber == null) {
                throw new IllegalArgumentException(
                        "A private or withheld number cannot be saved as a patient contact"
                );
            }

            patientService.addPhoneNumber(
                    patientId,
                    new AddPhoneNumberRequest(counterpartyNumber)
            );
        }

        patient.markUpdated();
        return CallResponse.from(callRecord);
    }

    @Transactional
    public CallResponse dismissCommunication(
            Long callId,
            boolean treatFutureFromSenderAsSpam
    ) {
        CallRecord callRecord = findCall(callId);
        callRecord.dismissFromTriage();

        String counterpartyNumber = callRecord.getCounterpartyNumber();
        if (treatFutureFromSenderAsSpam) {
            if (counterpartyNumber == null) {
                throw new IllegalArgumentException(
                        "A private or withheld number cannot create a future spam rule"
                );
            }

            spamSenderRuleService.treatAsSpam(
                    CommunicationChannel.CALL,
                    counterpartyNumber
            );
        }

        return CallResponse.from(callRecord);
    }

    @Transactional
    public CallResponse restoreCommunication(Long callId) {
        CallRecord callRecord = findCall(callId);
        callRecord.restoreToActiveTriage();

        String counterpartyNumber = callRecord.getCounterpartyNumber();
        if (counterpartyNumber != null) {
            spamSenderRuleService.allowSender(
                    CommunicationChannel.CALL,
                    counterpartyNumber
            );
        }

        return CallResponse.from(callRecord);
    }

    private void markPatientUpdated(CallRecord callRecord) {
        if (callRecord.getPatient() != null) {
            callRecord.getPatient().markUpdated();
        }
    }

    private CallRecord findCall(Long callId) {
        return callRecordRepository
                .findById(callId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Call not found: " + callId
                ));
    }

    private String normalizeProviderNumber(String rawNumber) {
        if (rawNumber == null || rawNumber.isBlank()) {
            return null;
        }

        String normalizedLabel = rawNumber.trim().toLowerCase(Locale.ROOT);
        if (normalizedLabel.equals("private") ||
                normalizedLabel.equals("withheld") ||
                normalizedLabel.equals("anonymous") ||
                normalizedLabel.equals("restricted") ||
                normalizedLabel.equals("unknown")) {
            return null;
        }

        return phoneNumberNormalizer.normalize(rawNumber);
    }
}
