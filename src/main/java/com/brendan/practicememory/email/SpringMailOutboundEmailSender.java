package com.brendan.practicememory.email;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import org.springframework.context.annotation.Profile;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

@Component
@Profile("email")
public class SpringMailOutboundEmailSender
        implements OutboundEmailSender {

    private final JavaMailSender javaMailSender;

    public SpringMailOutboundEmailSender(
            JavaMailSender javaMailSender
    ) {
        this.javaMailSender = javaMailSender;
    }

    @Override
    public String send(
            String fromAddress,
            String toAddress,
            String subject,
            String bodyText,
            String inReplyToProviderMessageId
    ) {
        try {
            MimeMessage message = javaMailSender.createMimeMessage();
            message.setFrom(new InternetAddress(fromAddress));
            message.setRecipients(
                    MimeMessage.RecipientType.TO,
                    InternetAddress.parse(toAddress, false)
            );
            message.setSubject(
                    subject == null ? "" : subject,
                    StandardCharsets.UTF_8.name()
            );
            message.setText(
                    bodyText,
                    StandardCharsets.UTF_8.name()
            );

            if (
                    inReplyToProviderMessageId != null &&
                            !inReplyToProviderMessageId.isBlank()
            ) {
                message.setHeader(
                        "In-Reply-To",
                        inReplyToProviderMessageId
                );
                message.setHeader(
                        "References",
                        inReplyToProviderMessageId
                );
            }

            // Force Jakarta Mail to create the Message-ID before sending so
            // Practice Memory can persist the same ID used by email replies.
            message.saveChanges();
            String providerMessageId = message.getMessageID();

            javaMailSender.send(message);
            return providerMessageId;
        } catch (MessagingException exception) {
            throw new IllegalStateException(
                    "Could not create outbound email",
                    exception
            );
        }
    }
}
