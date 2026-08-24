package com.square.backend.model;

public enum StockCategory {
    COMPUTER, LAPTOP, PRINTER, OTHER;

    public boolean isAsset() {
        return this != OTHER;
    }

    // Best-effort classification for a serialized device that was never given
    // an explicit stock category (every registration form predates it).
    public static StockCategory fromDeviceKind(String deviceKind, String deviceType) {
        String k = deviceKind == null ? "" : deviceKind.trim().toLowerCase();
        if (k.equals("desktop")) return COMPUTER;
        if (k.equals("laptop")) return LAPTOP;
        if (k.equals("printer")) return PRINTER;
        String t = deviceType == null ? "" : deviceType.toLowerCase();
        if (t.contains("desktop") || t.contains("workstation") || t.contains("server")) return COMPUTER;
        if (t.contains("laptop")) return LAPTOP;
        if (t.contains("printer")) return PRINTER;
        return OTHER;
    }
}
