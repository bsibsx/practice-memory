package com.brendan.practicememory.shared;

public record DismissCommunicationRequest(
        boolean treatFutureFromSenderAsSpam
) {
}
