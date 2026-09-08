package com.brendan.practicememory.shared;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PhoneNumberNormalizerTest {

    private final PhoneNumberNormalizer normalizer = new PhoneNumberNormalizer();

    @Test
    void normalizesIrishLocalMobileNumberToE164() {
        String result = normalizer.normalize("087 123 4567");

        assertThat(result).isEqualTo("+353871234567");
    }

    @Test
    void leavesEquivalentInternationalNumberInTheSameCanonicalFormat() {
        String result = normalizer.normalize("+353 87 123 4567");

        assertThat(result).isEqualTo("+353871234567");
    }

    @Test
    void rejectsInvalidPhoneNumber() {
        assertThatThrownBy(() -> normalizer.normalize("123"))
                .isInstanceOf(InvalidPhoneNumberException.class);
    }
}
