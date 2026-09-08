package com.brendan.practicememory.activity;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/inbox")
public class InboxController {

    private final PatientActivityService patientActivityService;

    public InboxController(
            PatientActivityService patientActivityService
    ) {
        this.patientActivityService = patientActivityService;
    }

    @GetMapping
    public List<InboxItemResponse> getInbox() {
        return patientActivityService.getInbox();
    }
}