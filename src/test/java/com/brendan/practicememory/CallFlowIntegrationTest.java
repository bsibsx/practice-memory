package com.brendan.practicememory;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:practice-memory-test;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.show-sql=false"
})
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class CallFlowIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void createsPatientThenMatchesAndStoresIncomingCall() throws Exception {
        createSarah();

        mockMvc.perform(post("/api/calls/incoming")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "providerCallId": "CALL-INTEGRATION-001",
                                  "fromNumber": "+353 87 123 4567",
                                  "startedAt": "2026-08-05T14:45:00Z",
                                  "callStatus": "ANSWERED",
                                  "durationSeconds": 95
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.direction").value("INBOUND"))
                .andExpect(jsonPath("$.counterpartyNumber")
                        .value("+353871234567"))
                .andExpect(jsonPath("$.patientMatchStatus")
                        .value("MATCHED"))
                .andExpect(jsonPath("$.patient.firstName")
                        .value("Sarah"));
    }

    @Test
    void matchesAndStoresOutboundCallUsingDestinationNumber() throws Exception {
        createSarah();

        mockMvc.perform(post("/api/calls/outgoing")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "providerCallId": "CALL-OUT-001",
                                  "fromNumber": "+353 1 555 0100",
                                  "toNumber": "087 123 4567",
                                  "startedAt": "2026-08-05T16:00:00Z",
                                  "callStatus": "COMPLETED",
                                  "durationSeconds": 130
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.direction").value("OUTBOUND"))
                .andExpect(jsonPath("$.counterpartyNumber")
                        .value("+353871234567"))
                .andExpect(jsonPath("$.patientMatchStatus")
                        .value("MATCHED"))
                .andExpect(jsonPath("$.patient.firstName")
                        .value("Sarah"));
    }

    @Test
    void repeatedProviderEventsUpdateOneCallLifecycle() throws Exception {
        createSarah();

        mockMvc.perform(post("/api/calls/events")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "providerCallId": "CALL-LIFE-001",
                                  "direction": "OUTBOUND",
                                  "fromNumber": "+353 1 555 0100",
                                  "toNumber": "087 123 4567",
                                  "startedAt": "2026-08-05T17:00:00Z",
                                  "callStatus": "RINGING"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.callStatus").value("RINGING"));

        mockMvc.perform(post("/api/calls/events")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "providerCallId": "CALL-LIFE-001",
                                  "direction": "OUTBOUND",
                                  "fromNumber": "+353 1 555 0100",
                                  "toNumber": "087 123 4567",
                                  "startedAt": "2026-08-05T17:00:00Z",
                                  "callStatus": "COMPLETED",
                                  "durationSeconds": 86
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.callStatus").value("COMPLETED"))
                .andExpect(jsonPath("$.durationSeconds").value(86));

        mockMvc.perform(get("/api/calls"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void storesPrivateInboundCallerWithoutDroppingTheCall() throws Exception {
        mockMvc.perform(post("/api/calls/incoming")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "providerCallId": "CALL-PRIVATE-001",
                                  "fromNumber": "withheld",
                                  "startedAt": "2026-08-05T18:00:00Z",
                                  "callStatus": "MISSED",
                                  "durationSeconds": 0
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.direction").value("INBOUND"))
                .andExpect(jsonPath("$.patientMatchStatus").value("UNMATCHED"))
                .andExpect(jsonPath("$.counterpartyNumber").isEmpty());
    }

    private void createSarah() throws Exception {
        mockMvc.perform(post("/api/patients")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "firstName": "Sarah",
                                  "lastName": "Murphy",
                                  "phoneNumbers": ["087 123 4567"]
                                }
                                """))
                .andExpect(status().isCreated());
    }
}
