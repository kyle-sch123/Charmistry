/**
 * Whether a focused element is one the shopper types into.
 *
 * Why this exists: the sticky add-to-bag bar must step out of the way while the
 * on-screen keyboard is up (writing a review, say), otherwise it floats over
 * the field being typed in. Not every focusable control raises a keyboard
 * though: buttons, checkboxes and radios must NOT hide the bar, or tapping a
 * star rating would make it vanish. This is the pure classification, kept free
 * of the DOM so it can be unit-tested in the Node test environment; the bar
 * feeds it `tagName`, an input's `type` and `isContentEditable`.
 */

/** `<input>` types that never raise a text keyboard. */
const NON_TEXT_INPUT_TYPES: ReadonlySet<string> = new Set([
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
]);

/**
 * @param tagName   The element's tag name, in any case.
 * @param inputType The `type` of an `<input>`; ignored for other tags. A
 *                  missing type is a text input, matching the HTML default.
 * @param editable  The element's `isContentEditable`.
 */
export function isTextEntryField(
  tagName: string,
  inputType: string | null | undefined,
  editable: boolean,
): boolean {
  const tag = tagName.toLowerCase();
  if (tag === "textarea" || tag === "select") return true;
  if (tag === "input") {
    return !NON_TEXT_INPUT_TYPES.has((inputType ?? "text").toLowerCase());
  }
  return editable;
}
