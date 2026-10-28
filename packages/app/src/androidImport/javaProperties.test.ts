import { describe, expect, it } from "vitest";
import { parseJavaProperties } from "./javaProperties.js";

describe("parseJavaProperties", () => {
  it("parses simple key=value lines", () => {
    const parsed = parseJavaProperties("app=auxo\nformat=1\n");
    expect(parsed).toEqual({ app: "auxo", format: "1" });
  });

  it("skips comment lines and blank lines", () => {
    const parsed = parseJavaProperties("#A comment\n\n!also a comment\napp=auxo\n");
    expect(parsed).toEqual({ app: "auxo" });
  });

  it("trims whitespace around keys and values", () => {
    const parsed = parseJavaProperties("  shop  =  Roy Stores  \n");
    expect(parsed).toEqual({ shop: "Roy Stores" });
  });

  it("unescapes backslash sequences Properties.store() produces", () => {
    const parsed = parseJavaProperties("note=Line1\\nLine2\\tTabbed\\\\Backslash\n");
    expect(parsed.note).toBe("Line1\nLine2\tTabbed\\Backslash");
  });

  it("unescapes \\: and \\= inside values", () => {
    const parsed = parseJavaProperties("time=10\\:30\n");
    expect(parsed.time).toBe("10:30");
  });

  it("handles a colon as the key/value separator", () => {
    const parsed = parseJavaProperties("app:auxo\n");
    expect(parsed).toEqual({ app: "auxo" });
  });

  it("returns an empty object for empty input", () => {
    expect(parseJavaProperties("")).toEqual({});
  });
});
