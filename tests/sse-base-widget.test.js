import { describe, it, expect } from "vitest";
import "../dev/src/sse-base-widget.js";

describe("placeholder logic", () => {
  it("shows placeholder until a stream arrives", () => {
    const el = document.createElement("sse-base-widget");
    document.body.append(el);
    expect(el.shadowRoot.querySelector(".data").textContent).toMatch(
      /Waiting for data/
    );
  });
});
