package com.brendan.practicememory.patient;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DataJpaTest
class PhoneNumberRepositoryTest {

    @Autowired
    private PatientRepository patientRepository;

    @Autowired
    private PhoneNumberRepository phoneNumberRepository;

    @Autowired
    private EntityManager entityManager;

    @Test
    void savesAndRetrievesPhoneNumberWithItsPatientRelationship() {
        Patient sarah = patientRepository.saveAndFlush(
                new Patient("Sarah", "Murphy")
        );

        phoneNumberRepository.saveAndFlush(
                new PhoneNumber(sarah, "+353871234567", true)
        );

        entityManager.clear();

        List<PhoneNumber> results =
                phoneNumberRepository.findAllByNumberAndActiveTrue(
                        "+353871234567"
                );

        assertThat(results).hasSize(1);
        assertThat(results.getFirst().getPatient().getFirstName())
                .isEqualTo("Sarah");
    }

    @Test
    void allowsDifferentPatientsToShareTheSameNumber() {
        Patient parent = patientRepository.saveAndFlush(
                new Patient("Mary", "Murphy")
        );
        Patient child = patientRepository.saveAndFlush(
                new Patient("Sean", "Murphy")
        );

        phoneNumberRepository.save(
                new PhoneNumber(parent, "+353871234567", true)
        );
        phoneNumberRepository.saveAndFlush(
                new PhoneNumber(child, "+353871234567", true)
        );

        assertThat(phoneNumberRepository.findAllByNumberAndActiveTrue(
                "+353871234567"
        )).hasSize(2);
    }

    @Test
    void rejectsTheSameNumberTwiceForTheSamePatient() {
        Patient sarah = patientRepository.saveAndFlush(
                new Patient("Sarah", "Murphy")
        );

        phoneNumberRepository.saveAndFlush(
                new PhoneNumber(sarah, "+353871234567", true)
        );

        assertThatThrownBy(() -> phoneNumberRepository.saveAndFlush(
                new PhoneNumber(sarah, "+353871234567", false)
        )).isInstanceOf(DataIntegrityViolationException.class);
    }
}
