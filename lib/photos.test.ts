import { describe, expect, it } from "vitest";

import {
  getAppPhotoObjectPath,
  getRemovedPhotoUrls,
  isAppPhotoUrl,
  isPhotoObjectOlderThanMinimum,
} from "./photos";

const SUPABASE_URL = "https://project.supabase.co";
const BUCKET = "item-photos";

describe("app photo URLs", () => {
  it("accepts an object in the configured project and bucket", () => {
    const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/folder/photo.jpg`;

    expect(isAppPhotoUrl(url, SUPABASE_URL, BUCKET)).toBe(true);
    expect(getAppPhotoObjectPath(url, SUPABASE_URL, BUCKET)).toBe(
      "folder/photo.jpg",
    );
  });

  it.each([
    "not-a-url",
    "https://other.supabase.co/storage/v1/object/public/item-photos/photo.jpg",
    "https://project.supabase.co/storage/v1/object/public/other/photo.jpg",
    "https://project.supabase.co/storage/v1/object/public/item-photos/",
    "https://project.supabase.co/storage/v1/object/public/item-photos/photo.jpg?download=1",
    "https://project.supabase.co/storage/v1/object/public/item-photos/photo.jpg#preview",
  ])("rejects a URL outside the exact app storage location: %s", (url) => {
    expect(isAppPhotoUrl(url, SUPABASE_URL, BUCKET)).toBe(false);
  });
});

describe("getRemovedPhotoUrls", () => {
  it("treats a pure reorder as retaining every object", () => {
    expect(
      getRemovedPhotoUrls(["one.jpg", "two.jpg"], ["two.jpg", "one.jpg"]),
    ).toEqual([]);
  });

  it("returns only URLs omitted from the saved order", () => {
    expect(
      getRemovedPhotoUrls(
        ["one.jpg", "two.jpg", "three.jpg"],
        ["three.jpg", "one.jpg"],
      ),
    ).toEqual(["two.jpg"]);
  });
});

describe("isPhotoObjectOlderThanMinimum", () => {
  const now = new Date("2026-08-02T12:00:00.000Z");

  it("only accepts objects strictly older than the 24-hour safety floor", () => {
    expect(
      isPhotoObjectOlderThanMinimum("2026-08-01T11:59:59.999Z", now),
    ).toBe(true);
    expect(
      isPhotoObjectOlderThanMinimum("2026-08-01T12:00:00.000Z", now),
    ).toBe(false);
    expect(
      isPhotoObjectOlderThanMinimum("2026-08-02T11:00:00.000Z", now),
    ).toBe(false);
  });

  it("fails closed when storage does not provide a usable creation time", () => {
    expect(isPhotoObjectOlderThanMinimum(null, now)).toBe(false);
    expect(isPhotoObjectOlderThanMinimum("not-a-date", now)).toBe(false);
  });
});
