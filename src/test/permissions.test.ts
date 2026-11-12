import { describe, it, expect } from "vitest";
import { mayAdd, mayEdit } from "@/lib/permissions";
const rows = [
  { id: "a", createdBy: "u1", createdAt: "2026-10-01T08:00:00Z" },
  { id: "b", createdBy: "u1", createdAt: "2026-10-02T08:00:00Z" },
  { id: "c", createdBy: "u2", createdAt: "2026-10-03T08:00:00Z" },
];
describe("owner/employee permissions", () => {
  it("owner can add and edit anything", () => {
    expect(mayAdd("owner", "ingredients")).toBe(true);
    expect(mayEdit("owner", "u9", "menuItems", "x", [])).toBe(true);
  });
  it("employee can add only daily entries", () => {
    expect(mayAdd("staff", "wasteLogs")).toBe(true);
    expect(mayAdd("staff", "sales")).toBe(true);
    expect(mayAdd("staff", "batches")).toBe(true);
    expect(mayAdd("staff", "ingredients")).toBe(false);
    expect(mayAdd("staff", "menuItems")).toBe(true);
    expect(mayEdit("staff", "u1", "menuItems", "a", rows)).toBe(false);
  });
  it("employee edits only their own latest entry", () => {
    expect(mayEdit("staff", "u1", "sales", "b", rows)).toBe(true);
    expect(mayEdit("staff", "u1", "sales", "a", rows)).toBe(false);
    expect(mayEdit("staff", "u1", "sales", "c", rows)).toBe(false);
  });
});
