"use client";
/** A fresh id per user action; the server uses it to make paid requests idempotent. */
export function rid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}
