import { describe, expect, it } from "vitest";
import { nairaFull, nairaShort } from "@/lib/format";

describe("nairaShort", () => {
  it("shortens thousands for buttons", () => {
    expect(nairaShort(500_000)).toBe("₦5k");
    expect(nairaShort(1_250_000)).toBe("₦12.5k");
    expect(nairaShort(2_000_000)).toBe("₦20k");
    expect(nairaShort(50_000)).toBe("₦500");
  });
});

describe("nairaFull", () => {
  it("shows the whole amount with commas", () => {
    expect(nairaFull(500_000)).toBe("₦5,000");
    expect(nairaFull(1_250_000)).toBe("₦12,500");
    expect(nairaFull(2_000_000)).toBe("₦20,000");
    expect(nairaFull(50_000)).toBe("₦500");
  });
});
