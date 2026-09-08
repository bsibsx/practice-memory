package com.brendan.practicememory.email;

import jakarta.mail.Address;
import jakarta.mail.BodyPart;
import jakarta.mail.Folder;
import jakarta.mail.Message;
import jakarta.mail.MessagingException;
import jakarta.mail.Multipart;
import jakarta.mail.Part;
import jakarta.mail.Session;
import jakarta.mail.Store;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Date;
import java.util.HexFormat;
import java.util.Properties;

/**
 * Lightweight IMAP adapter for the MVP.
 *
 * It opens the mailbox read-only, scans only the most recent messages and
 * relies on provider Message-ID idempotency in EmailService. This means it
 * does not mark messages as read in the practice mailbox.
 */
@Component
@Profile("email")
public class EmailMailboxPoller {

    private static final Logger log =
            LoggerFactory.getLogger(EmailMailboxPoller.class);

    private final EmailService emailService;

    @Value("${practice.email.inbound.enabled:false}")
    private boolean enabled;

    @Value("${practice.email.imap.host:}")
    private String host;

    @Value("${practice.email.imap.port:993}")
    private int port;

    @Value("${practice.email.imap.username:}")
    private String username;

    @Value("${practice.email.imap.password:}")
    private String password;

    @Value("${practice.email.imap.folder:INBOX}")
    private String folderName;

    @Value("${practice.email.imap.scan-limit:100}")
    private int scanLimit;

    @Value("${practice.email.from:}")
    private String practiceFromAddress;

    public EmailMailboxPoller(
            EmailService emailService
    ) {
        this.emailService = emailService;
    }

    @Scheduled(
            fixedDelayString = "${practice.email.imap.poll-ms:60000}",
            initialDelayString = "${practice.email.imap.initial-delay-ms:5000}"
    )
    public void pollMailbox() {
        if (!enabled) {
            return;
        }

        if (
                host.isBlank() ||
                        username.isBlank() ||
                        password.isBlank()
        ) {
            log.warn(
                    "Inbound email polling is enabled but IMAP configuration is incomplete."
            );
            return;
        }

        Properties properties = new Properties();
        properties.setProperty("mail.store.protocol", "imaps");
        properties.setProperty("mail.imaps.connectiontimeout", "5000");
        properties.setProperty("mail.imaps.timeout", "10000");
        properties.setProperty("mail.imaps.writetimeout", "10000");

        Session session = Session.getInstance(properties);

        try (
                Store store = session.getStore("imaps")
        ) {
            store.connect(host, port, username, password);

            Folder folder = store.getFolder(folderName);
            try {
                folder.open(Folder.READ_ONLY);
                importRecentMessages(folder);
            } finally {
                if (folder.isOpen()) {
                    folder.close(false);
                }
            }
        } catch (MessagingException | IOException exception) {
            log.warn(
                    "Inbound email poll failed: {}",
                    exception.getMessage()
            );
        }
    }

    private void importRecentMessages(
            Folder folder
    ) throws MessagingException, IOException {
        int messageCount = folder.getMessageCount();
        if (messageCount == 0) {
            return;
        }

        int safeLimit = Math.max(1, scanLimit);
        int start = Math.max(1, messageCount - safeLimit + 1);
        Message[] messages = folder.getMessages(start, messageCount);

        for (Message message : messages) {
            importMessage(message);
        }
    }

    private void importMessage(
            Message message
    ) throws MessagingException, IOException {
        String fromAddress = firstAddress(message.getFrom());
        if (fromAddress == null || fromAddress.isBlank()) {
            return;
        }

        // Ignore copies of practice-originated messages that a provider might
        // place in the inbox. Outbound mail is already recorded at send time.
        if (
                practiceFromAddress != null &&
                        !practiceFromAddress.isBlank() &&
                        fromAddress.equalsIgnoreCase(practiceFromAddress.trim())
        ) {
            return;
        }

        String toAddress = firstAddress(
                message.getRecipients(Message.RecipientType.TO)
        );
        if (toAddress == null || toAddress.isBlank()) {
            toAddress = practiceFromAddress;
        }
        if (toAddress == null || toAddress.isBlank()) {
            return;
        }

        String bodyText = extractBodyText(message).trim();
        if (bodyText.isBlank()) {
            bodyText = "(No readable message body)";
        }

        Instant sentAt = toInstant(
                message.getSentDate(),
                message.getReceivedDate()
        );

        String providerMessageId = getHeader(message, "Message-ID");
        String inReplyTo = getHeader(message, "In-Reply-To");

        if (providerMessageId == null || providerMessageId.isBlank()) {
            providerMessageId = fallbackMessageId(
                    fromAddress,
                    toAddress,
                    message.getSubject(),
                    bodyText,
                    sentAt
            );
        }

        emailService.receiveIncomingEmail(
                providerMessageId,
                inReplyTo,
                fromAddress,
                toAddress,
                message.getSubject(),
                bodyText,
                sentAt
        );
    }

    private String firstAddress(
            Address[] addresses
    ) {
        if (addresses == null || addresses.length == 0) {
            return null;
        }

        Address address = addresses[0];
        if (address instanceof InternetAddress internetAddress) {
            return internetAddress.getAddress();
        }
        return address.toString();
    }

    private String getHeader(
            Message message,
            String name
    ) throws MessagingException {
        if (message instanceof MimeMessage mimeMessage) {
            return mimeMessage.getHeader(name, null);
        }

        String[] values = message.getHeader(name);
        return values == null || values.length == 0
                ? null
                : values[0];
    }

    private Instant toInstant(
            Date sentDate,
            Date receivedDate
    ) {
        Date date = sentDate != null
                ? sentDate
                : receivedDate;
        return date == null
                ? Instant.now()
                : date.toInstant();
    }

    private String extractBodyText(
            Part part
    ) throws MessagingException, IOException {
        if (part.isMimeType("text/plain")) {
            Object content = part.getContent();
            return content == null ? "" : content.toString();
        }

        if (part.isMimeType("text/html")) {
            Object content = part.getContent();
            return content == null
                    ? ""
                    : htmlToText(content.toString());
        }

        if (part.isMimeType("multipart/*")) {
            Multipart multipart = (Multipart) part.getContent();
            String htmlFallback = "";

            for (int index = 0; index < multipart.getCount(); index++) {
                BodyPart bodyPart = multipart.getBodyPart(index);

                if (
                        Part.ATTACHMENT.equalsIgnoreCase(
                                bodyPart.getDisposition()
                        )
                ) {
                    continue;
                }

                if (bodyPart.isMimeType("text/plain")) {
                    String text = extractBodyText(bodyPart);
                    if (!text.isBlank()) {
                        return text;
                    }
                }

                String nested = extractBodyText(bodyPart);
                if (!nested.isBlank() && htmlFallback.isBlank()) {
                    htmlFallback = nested;
                }
            }

            return htmlFallback;
        }

        return "";
    }

    private String htmlToText(
            String html
    ) {
        return html
                .replaceAll("(?is)<(script|style).*?>.*?</\\1>", " ")
                .replaceAll("(?i)<br\\s*/?>", "\n")
                .replaceAll("(?i)</p>", "\n")
                .replaceAll("(?s)<[^>]+>", " ")
                .replace("&nbsp;", " ")
                .replace("&amp;", "&")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&quot;", "\"")
                .replace("&#39;", "'")
                .replaceAll("[ \\t]+", " ")
                .replaceAll("\\n{3,}", "\n\n")
                .trim();
    }

    private String fallbackMessageId(
            String fromAddress,
            String toAddress,
            String subject,
            String bodyText,
            Instant sentAt
    ) {
        String raw = String.join(
                "|",
                fromAddress,
                toAddress,
                subject == null ? "" : subject,
                bodyText,
                sentAt.toString()
        );

        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(
                    raw.getBytes(StandardCharsets.UTF_8)
            );
            return "imap:" + HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(
                    "SHA-256 is unavailable",
                    exception
            );
        }
    }
}
