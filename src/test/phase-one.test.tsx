import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), "src", path), "utf8");

describe("Phase 1 account and guidance requirements", () => {
  it("requires matching signup passwords and current password for changes", () => {
    expect(read("routes/login.tsx")).toContain("Passwords don't match");
    expect(read("routes/login.tsx")).toContain("Confirm password");
    expect(read("routes/_authenticated/profile.tsx")).toContain("current_password: current");
  });

  it("keeps the approved invitation copy and exposes support", () => {
    expect(read("routes/_authenticated/profile.tsx")).toContain("sign up at MenuWise with this email address");
    expect(read("routes/_authenticated/help.tsx")).toContain("menuwise.contact@gmail.com");
  });

  it("warns before the approved 30 minute inactivity timeout", () => {
    const timeout = read("components/mw/SessionTimeout.tsx");
    expect(timeout).toContain("30 * 60 * 1000");
    expect(timeout).toContain("Unsynced records stay on this device");
  });
});