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
class PatientActivityIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void createsStandaloneNoteAndReturnsItInPatientActivity() throws Exception {
        mockMvc.perform(post("/api/patients")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "firstName": "Sarah",
                                  "lastName": "Murphy",
                                  "phoneNumbers": ["087 123 4567"]
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1));

        mockMvc.perform(post("/api/patients/1/notes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "text": "Patient requested a receipt."
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.type").value("NOTE"))
                .andExpect(jsonPath("$.text")
                        .value("Patient requested a receipt."));

        mockMvc.perform(get("/api/patients/1/activity"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].type").value("NOTE"))
                .andExpect(jsonPath("$[0].text")
                        .value("Patient requested a receipt."));
    }

    @Test
    void returnsCallsAndNotesTogetherInPatientActivity() throws Exception {
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

        mockMvc.perform(post("/api/calls/incoming")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "providerCallId": "CALL-ACTIVITY-001",
                                  "fromNumber": "087 123 4567",
                                  "startedAt": "2026-08-10T10:00:00Z",
                                  "callStatus": "COMPLETED",
                                  "durationSeconds": 240
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.patientMatchStatus")
                        .value("MATCHED"));

        mockMvc.perform(post("/api/patients/1/notes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "text": "Administrative note."
                                }
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/patients/1/activity"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].type").value("NOTE"))
                .andExpect(jsonPath("$[1].type").value("CALL"))
                .andExpect(jsonPath("$[1].callStatus")
                        .value("COMPLETED"))
                .andExpect(jsonPath("$[1].durationSeconds")
                        .value(240));
    }
}
