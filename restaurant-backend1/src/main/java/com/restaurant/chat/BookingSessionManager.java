package com.restaurant.chat;

import java.util.concurrent.ConcurrentHashMap;

public class BookingSessionManager {

    private static final ConcurrentHashMap<String, BookingContext> sessions = new ConcurrentHashMap<>();

    public static BookingContext get(String sessionId) {
        return sessions.computeIfAbsent(sessionId, k -> new BookingContext());
    }

    public static void clear(String sessionId) {
        sessions.remove(sessionId);
    }
}