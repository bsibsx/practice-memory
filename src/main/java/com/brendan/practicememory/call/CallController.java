package com.brendan.practicememory.call;

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
@RequestMapping("/api/calls")
public class CallController {

    private final CallService callService;

    public CallController(CallService callService) {
        this.callService = callService;
    }

    @PostMapping("/incoming")
    public CallResponse receiveIncomingCall(
            @Valid @RequestBody IncomingCallRequest request
    ) {
        return callService.receiveIncomingCall(
                request.providerCallId(),
                request.fromNumber(),
                request.toNumber(),
                request.startedAt(),
                request.callStatus(),
                request.durationSeconds()
        );
    }

    @PostMapping("/outgoing")
    public CallResponse recordOutgoingCall(
            @Valid @RequestBody OutgoingCallRequest request
    ) {
        return callService.recordOutgoingCall(
                request.providerCallId(),
                request.fromNumber(),
                request.toNumber(),
                request.startedAt(),
                request.callStatus(),
                request.durationSeconds()
        );
    }

    /**
     * Provider-neutral webhook target. A provider-specific adapter can map
     * both inbound and outbound lifecycle events into this one endpoint.
     */
    @PostMapping("/events")
    public CallResponse recordProviderEvent(
            @Valid @RequestBody CallProviderEventRequest request
    ) {
        return callService.recordCallEvent(
                request.providerCallId(),
                request.direction(),
                request.fromNumber(),
                request.toNumber(),
                request.startedAt(),
                request.callStatus(),
                request.durationSeconds()
        );
    }

    @GetMapping
    public List<CallResponse> getCalls() {
        return callService.getCalls();
    }

    @GetMapping("/patient/{patientId}")
    public List<CallResponse> getPatientCalls(
            @PathVariable Long patientId
    ) {
        return callService.getPatientCalls(patientId);
    }

    @PatchMapping("/{callId}/note")
    public CallResponse updateNote(
            @PathVariable Long callId,
            @Valid @RequestBody UpdateCallNoteRequest request
    ) {
        return callService.updateNote(callId, request.note());
    }

    @PatchMapping("/{callId}/follow-up")
    public CallResponse updateFollowUpStatus(
            @PathVariable Long callId,
            @Valid @RequestBody UpdateFollowUpRequest request
    ) {
        return callService.updateFollowUpStatus(
                callId,
                request.followUpStatus()
        );
    }

    @PatchMapping("/{callId}/patient")
    public CallResponse assignPatient(
            @PathVariable Long callId,
            @Valid @RequestBody AssignCallPatientRequest request
    ) {
        return callService.assignPatient(
                callId,
                request.patientId(),
                request.assignSameCaller(),
                request.saveCallerAsContact()
        );
    }

    @PatchMapping("/{callId}/dismiss")
    public CallResponse dismissCommunication(
            @PathVariable Long callId,
            @RequestBody(required = false) DismissCommunicationRequest request
    ) {
        return callService.dismissCommunication(
                callId,
                request != null && request.treatFutureFromSenderAsSpam()
        );
    }

    @PatchMapping("/{callId}/restore")
    public CallResponse restoreCommunication(
            @PathVariable Long callId
    ) {
        return callService.restoreCommunication(callId);
    }
}
