package com.brendan.practicememory.email;

public interface OutboundEmailSender {

    String send(
            String fromAddress,
            String toAddress,
            String subject,
            String bodyText,
            String inReplyToProviderMessageId
    );
}
