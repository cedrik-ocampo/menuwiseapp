import { describe, expect, it } from "vitest";
import { adminNotices, unreadCount } from "./notifications";
import type { ChangeLog } from "./types";
const log = (p: Partial<ChangeLog>): ChangeLog => ({ id: Math.random() + "", collection: "menuItems", recordId: "m1", action: "created", at: "2026-11-12T01:00:00Z", by: "a", byName: "MenuWise Admin", changes: [], adminEdit: true, ...p });
describe("admin notices", () => {
  it("groups an import of 3 items into one notice", () => {
    const n = adminNotices([log({ recordId: "1" }), log({ recordId: "2" }), log({ recordId: "3" })]);
    expect(n).toHaveLength(1);
    expect(n[0].text).toBe("MenuWise Admin added 3 menu items");
  });
  it("ignores non-admin changes", () => { expect(adminNotices([log({ adminEdit: false })])).toHaveLength(0); });
  it("describes admin views as privacy-safe summaries", () => {
    expect(adminNotices([log({ action: "viewed" })])[0].text).toBe("MenuWise Admin viewed your café's privacy-safe summary");
  });
  it("counts only notices after last seen", () => {
    const n = adminNotices([log({ at: "2026-11-10T00:00:00Z" }), log({ at: "2026-11-12T00:00:00Z", action: "viewed" })]);
    expect(unreadCount(n, "2026-11-11T00:00:00Z")).toBe(1);
    expect(unreadCount(n, null)).toBe(2);
  });
});
