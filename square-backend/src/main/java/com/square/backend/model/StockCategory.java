package com.square.backend.model;

public enum StockCategory {
    COMPUTER, LAPTOP, PRINTER, OTHER;

    public boolean isAsset() {
        return this != OTHER;
    }
}
