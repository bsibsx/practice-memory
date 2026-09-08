package com.brendan.practicememory.shared;

import com.google.i18n.phonenumbers.NumberParseException;
import com.google.i18n.phonenumbers.PhoneNumberUtil;
import org.springframework.stereotype.Component;

@Component
public class PhoneNumberNormalizer {

    private static final String DEFAULT_REGION = "IE";

    private final PhoneNumberUtil phoneNumberUtil;

    public PhoneNumberNormalizer() {
        this.phoneNumberUtil = PhoneNumberUtil.getInstance();
    }

    public String normalize(String rawNumber) {
        if (rawNumber == null || rawNumber.isBlank()) {
            throw new InvalidPhoneNumberException("Phone number must not be blank");
        }

        try {
            var parsedNumber = phoneNumberUtil.parse(rawNumber, DEFAULT_REGION);

            if (!phoneNumberUtil.isValidNumber(parsedNumber)) {
                throw new InvalidPhoneNumberException(
                        "Phone number is not valid: " + rawNumber
                );
            }

            return phoneNumberUtil.format(
                    parsedNumber,
                    PhoneNumberUtil.PhoneNumberFormat.E164
            );
        } catch (NumberParseException exception) {
            throw new InvalidPhoneNumberException(
                    "Phone number could not be parsed: " + rawNumber
            );
        }
    }
}
