import { describe, expect, it } from "vitest";
import { isTextEntryField } from "./text-entry";

describe("isTextEntryField", () => {
  it("treats textareas and selects as text entry", () => {
    expect(isTextEntryField("TEXTAREA", null, false)).toBe(true);
    expect(isTextEntryField("select", null, false)).toBe(true);
  });

  it("treats text-like inputs as text entry, including a missing type", () => {
    for (const type of ["text", "email", "tel", "search", "number", "password"]) {
      expect(isTextEntryField("INPUT", type, false)).toBe(true);
    }
    expect(isTextEntryField("input", undefined, false)).toBe(true);
    expect(isTextEntryField("input", null, false)).toBe(true);
  });

  it("ignores the case of the input type", () => {
    expect(isTextEntryField("input", "CHECKBOX", false)).toBe(false);
    expect(isTextEntryField("input", "Email", false)).toBe(true);
  });

  it("does not treat inputs that raise no keyboard as text entry", () => {
    for (const type of [
      "button",
      "submit",
      "reset",
      "image",
      "checkbox",
      "radio",
      "file",
      "range",
      "color",
      "hidden",
    ]) {
      expect(isTextEntryField("input", type, false)).toBe(false);
    }
  });

  it("treats contenteditable elements as text entry", () => {
    expect(isTextEntryField("div", null, true)).toBe(true);
  });

  it("does not treat other elements as text entry", () => {
    expect(isTextEntryField("button", null, false)).toBe(false);
    expect(isTextEntryField("a", null, false)).toBe(false);
    expect(isTextEntryField("div", null, false)).toBe(false);
  });

  it("ignores an input type on non-input tags", () => {
    expect(isTextEntryField("button", "text", false)).toBe(false);
  });
});
