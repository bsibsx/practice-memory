package com.brendan.practicememory.call;

import com.brendan.practicememory.patient.Patient;
import com.brendan.practicememory.patient.PatientRepository;
import com.brendan.practicememory.patient.PatientService;
import com.brendan.practicememory.patient.PhoneNumber;
import com.brendan.practicememory.patient.PhoneNumberRepository;
import com.brendan.practicememory.shared.PhoneNumberNormalizer;
import com.brendan.practicememory.shared.SpamSenderRuleService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CallServiceTest {

    @Mock
    private CallRecordRepository callRecordRepository;
    @Mock
    private PhoneNumberRepository phoneNumberRepository;
    @Mock
    private PhoneNumberNormalizer phoneNumberNormalizer;
    @Mock
    private PatientRepository patientRepository;
    @Mock
    private PatientService patientService;
    @Mock
    private SpamSenderRuleService spamSenderRuleService;

    private CallService callService;

    @BeforeEach
    void setUp() {
        callService = new CallService(
                callRecordRepository,
                phoneNumberRepository,
                phoneNumberNormalizer,
                patientRepository,
                patientService,
                spamSenderRuleService
        );
    }

    @Test
    void inboundMatchesUsingCallerNumber() {
        Patient patient = new Patient("Sarah", "Murphy");
        PhoneNumber number = new PhoneNumber(patient, "+353871234567", true);

        when(callRecordRepository.findByProviderCallId("CALL-001"))
                .thenReturn(Optional.empty());
        when(phoneNumberNormalizer.normalize("087 123 4567"))
                .thenReturn("+353871234567");
        when(phoneNumberRepository.findAllByNumberAndActiveTrue("+353871234567"))
                .thenReturn(List.of(number));
        when(callRecordRepository.save(any(CallRecord.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        CallResponse response = callService.receiveIncomingCall(
                "CALL-001",
                "087 123 4567",
                null,
                Instant.parse("2026-08-05T14:45:00Z"),
                CallStatus.ANSWERED,
                95
        );

        assertThat(response.direction()).isEqualTo(CallDirection.INBOUND);
        assertThat(response.counterpartyNumber()).isEqualTo("+353871234567");
        assertThat(response.patientMatchStatus()).isEqualTo(PatientMatchStatus.MATCHED);
    }

    @Test
    void outboundMatchesUsingDestinationNumber() {
        Patient patient = new Patient("Sarah", "Murphy");
        PhoneNumber number = new PhoneNumber(patient, "+353871234567", true);

        when(callRecordRepository.findByProviderCallId("CALL-OUT-001"))
                .thenReturn(Optional.empty());
        when(phoneNumberNormalizer.normalize("01 555 0100"))
                .thenReturn("+35315550100");
        when(phoneNumberNormalizer.normalize("087 123 4567"))
                .thenReturn("+353871234567");
        when(phoneNumberRepository.findAllByNumberAndActiveTrue("+353871234567"))
                .thenReturn(List.of(number));
        when(callRecordRepository.save(any(CallRecord.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        CallResponse response = callService.recordOutgoingCall(
                "CALL-OUT-001",
                "01 555 0100",
                "087 123 4567",
                Instant.parse("2026-08-05T15:00:00Z"),
                CallStatus.COMPLETED,
                120
        );

        assertThat(response.direction()).isEqualTo(CallDirection.OUTBOUND);
        assertThat(response.counterpartyNumber()).isEqualTo("+353871234567");
        assertThat(response.patientMatchStatus()).isEqualTo(PatientMatchStatus.MATCHED);
    }

    @Test
    void providerRetryUpdatesLifecycleInsteadOfCreatingDuplicate() {
        CallRecord existing = new CallRecord(
                "CALL-LIFE-001",
                CallDirection.OUTBOUND,
                "+35315550100",
                "+353871234567",
                Instant.parse("2026-08-05T15:10:00Z"),
                CallStatus.RINGING,
                null
        );

        when(callRecordRepository.findByProviderCallId("CALL-LIFE-001"))
                .thenReturn(Optional.of(existing));
        when(phoneNumberNormalizer.normalize("01 555 0100"))
                .thenReturn("+35315550100");
        when(phoneNumberNormalizer.normalize("087 123 4567"))
                .thenReturn("+353871234567");
        when(phoneNumberRepository.findAllByNumberAndActiveTrue("+353871234567"))
                .thenReturn(List.of());

        CallResponse response = callService.recordOutgoingCall(
                "CALL-LIFE-001",
                "01 555 0100",
                "087 123 4567",
                Instant.parse("2026-08-05T15:10:00Z"),
                CallStatus.COMPLETED,
                77
        );

        assertThat(response.callStatus()).isEqualTo(CallStatus.COMPLETED);
        assertThat(response.durationSeconds()).isEqualTo(77);
    }

    @Test
    void privateInboundCallIsStillStoredAsUnmatched() {
        when(callRecordRepository.findByProviderCallId("CALL-PRIVATE"))
                .thenReturn(Optional.empty());
        when(callRecordRepository.save(any(CallRecord.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        CallResponse response = callService.receiveIncomingCall(
                "CALL-PRIVATE",
                "withheld",
                null,
                Instant.parse("2026-08-05T15:20:00Z"),
                CallStatus.MISSED,
                0
        );

        assertThat(response.counterpartyNumber()).isNull();
        assertThat(response.patientMatchStatus()).isEqualTo(PatientMatchStatus.UNMATCHED);
        verify(callRecordRepository).save(any(CallRecord.class));
    }
}
