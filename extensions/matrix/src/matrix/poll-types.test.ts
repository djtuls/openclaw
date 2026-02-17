import { describe, expect, it } from "vitest";
import {
  buildPollStartContent,
  formatPollAsText,
  getTextContent,
  isPollStartType,
  M_POLL_START,
  ORG_POLL_START,
  parsePollStartContent,
} from "./poll-types.js";

describe("parsePollStartContent", () => {
  it("parses legacy m.poll payloads", () => {
    const summary = parsePollStartContent({
      "m.poll": {
        question: { "m.text": "Lunch?" },
        kind: "m.poll.disclosed",
        max_selections: 1,
        answers: [
          { id: "answer1", "m.text": "Yes" },
          { id: "answer2", "m.text": "No" },
        ],
      },
    });

    expect(summary?.question).toBe("Lunch?");
    expect(summary?.answers).toEqual(["Yes", "No"]);
  });

  it("parses m.poll.start payloads", () => {
    const summary = parsePollStartContent({
      [M_POLL_START]: {
        question: { "m.text": "Color?" },
        answers: [
          { id: "a1", "m.text": "Red" },
          { id: "a2", "m.text": "Blue" },
        ],
      },
    });
    expect(summary?.question).toBe("Color?");
    expect(summary?.answers).toEqual(["Red", "Blue"]);
    expect(summary?.kind).toBe("m.poll.disclosed");
    expect(summary?.maxSelections).toBe(1);
  });

  it("parses org.matrix.msc3381.poll.start payloads", () => {
    const summary = parsePollStartContent({
      [ORG_POLL_START]: {
        question: { "org.matrix.msc1767.text": "Size?" },
        kind: "m.poll.undisclosed",
        max_selections: 3,
        answers: [
          { id: "a1", "org.matrix.msc1767.text": "S" },
          { id: "a2", "org.matrix.msc1767.text": "M" },
          { id: "a3", "org.matrix.msc1767.text": "L" },
        ],
      },
    });
    expect(summary?.question).toBe("Size?");
    expect(summary?.answers).toEqual(["S", "M", "L"]);
    expect(summary?.kind).toBe("m.poll.undisclosed");
    expect(summary?.maxSelections).toBe(3);
  });

  it("returns null when no poll data is present", () => {
    expect(parsePollStartContent({})).toBeNull();
  });

  it("returns null when question text is empty", () => {
    expect(
      parsePollStartContent({
        [M_POLL_START]: {
          question: { "m.text": "" },
          answers: [{ id: "a1", "m.text": "Yes" }],
        },
      }),
    ).toBeNull();
  });

  it("filters out empty answer texts", () => {
    const summary = parsePollStartContent({
      [M_POLL_START]: {
        question: { "m.text": "OK?" },
        answers: [
          { id: "a1", "m.text": "Yes" },
          { id: "a2", "m.text": "  " },
          { id: "a3", "m.text": "No" },
        ],
      },
    });
    expect(summary?.answers).toEqual(["Yes", "No"]);
  });

  it("prefers body fallback for text content", () => {
    const summary = parsePollStartContent({
      [M_POLL_START]: {
        question: { body: "Via body?" },
        answers: [{ id: "a1", body: "Sure" }],
      },
    });
    expect(summary?.question).toBe("Via body?");
    expect(summary?.answers).toEqual(["Sure"]);
  });
});

describe("isPollStartType", () => {
  it("returns true for m.poll.start", () => {
    expect(isPollStartType("m.poll.start")).toBe(true);
  });

  it("returns true for org.matrix.msc3381.poll.start", () => {
    expect(isPollStartType("org.matrix.msc3381.poll.start")).toBe(true);
  });

  it("returns false for m.poll.response", () => {
    expect(isPollStartType("m.poll.response")).toBe(false);
  });

  it("returns false for m.poll.end", () => {
    expect(isPollStartType("m.poll.end")).toBe(false);
  });

  it("returns false for arbitrary strings", () => {
    expect(isPollStartType("m.room.message")).toBe(false);
  });
});

describe("getTextContent", () => {
  it("returns empty string for undefined input", () => {
    expect(getTextContent(undefined)).toBe("");
  });

  it("returns empty string for empty object", () => {
    expect(getTextContent({})).toBe("");
  });

  it("prefers m.text over other fields", () => {
    expect(
      getTextContent({
        "m.text": "primary",
        "org.matrix.msc1767.text": "secondary",
        body: "fallback",
      }),
    ).toBe("primary");
  });

  it("falls back to org.matrix.msc1767.text", () => {
    expect(
      getTextContent({
        "org.matrix.msc1767.text": "secondary",
        body: "fallback",
      }),
    ).toBe("secondary");
  });

  it("falls back to body", () => {
    expect(getTextContent({ body: "fallback" })).toBe("fallback");
  });
});

describe("formatPollAsText", () => {
  it("formats a poll with question and numbered answers", () => {
    const text = formatPollAsText({
      eventId: "evt1",
      roomId: "!room:server",
      sender: "@user:server",
      senderName: "User",
      question: "Lunch?",
      answers: ["Pizza", "Sushi", "Tacos"],
      kind: "m.poll.disclosed",
      maxSelections: 1,
    });
    expect(text).toBe("[Poll]\nLunch?\n\n1. Pizza\n2. Sushi\n3. Tacos");
  });

  it("formats a poll with no answers", () => {
    const text = formatPollAsText({
      eventId: "",
      roomId: "",
      sender: "",
      senderName: "",
      question: "Empty poll?",
      answers: [],
      kind: "m.poll.disclosed",
      maxSelections: 1,
    });
    expect(text).toBe("[Poll]\nEmpty poll?\n");
  });
});

describe("buildPollStartContent", () => {
  it("builds a single-select poll content", () => {
    const content = buildPollStartContent({
      question: "Color?",
      options: ["Red", "Blue"],
    });
    const poll = content[M_POLL_START];
    expect(poll).toBeDefined();
    expect(getTextContent(poll!.question)).toBe("Color?");
    expect(poll!.answers).toHaveLength(2);
    expect(poll!.kind).toBe("m.poll.disclosed");
    expect(poll!.max_selections).toBe(1);
    expect(getTextContent(poll!.answers[0])).toBe("Red");
    expect(poll!.answers[0].id).toBe("answer1");
    expect(getTextContent(poll!.answers[1])).toBe("Blue");
    expect(poll!.answers[1].id).toBe("answer2");
  });

  it("builds a multi-select poll content", () => {
    const content = buildPollStartContent({
      question: "Toppings?",
      options: ["Cheese", "Pepperoni", "Olives"],
      maxSelections: 3,
    });
    const poll = content[M_POLL_START];
    expect(poll!.kind).toBe("m.poll.undisclosed");
    expect(poll!.max_selections).toBe(3);
  });

  it("filters out empty options", () => {
    const content = buildPollStartContent({
      question: "Pick",
      options: ["A", "", "  ", "B"],
    });
    const poll = content[M_POLL_START];
    expect(poll!.answers).toHaveLength(2);
    expect(getTextContent(poll!.answers[0])).toBe("A");
    expect(getTextContent(poll!.answers[1])).toBe("B");
  });

  it("trims question and options", () => {
    const content = buildPollStartContent({
      question: "  Trim me  ",
      options: ["  Yes  ", "  No  "],
    });
    const poll = content[M_POLL_START];
    expect(getTextContent(poll!.question)).toBe("Trim me");
    expect(getTextContent(poll!.answers[0])).toBe("Yes");
  });

  it("includes fallback text fields", () => {
    const content = buildPollStartContent({
      question: "Vote",
      options: ["A", "B"],
    });
    expect(content["m.text"]).toContain("Vote");
    expect(content["m.text"]).toContain("1. A");
    expect(content["org.matrix.msc1767.text"]).toBe(content["m.text"]);
  });
});
