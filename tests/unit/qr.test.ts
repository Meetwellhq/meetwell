import { describe, expect, it } from "vitest";
import { qrPng, qrSvg } from "@/lib/qr";

describe("QR codes", () => {
  it("puts the Meetwell logo in the middle of the SVG", async () => {
    const svg = await qrSvg("https://meetwell.me/p/ada-obi?src=qr");
    expect(svg).toContain('fill="#1f4d3f"'); // logo mark
    expect(svg.trim().endsWith("</svg>")).toBe(true);
  });

  it("renders the PNG download at the requested size", async () => {
    const png = await qrPng("https://meetwell.me/p/ada-obi?src=qr", 1024);
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect(png.readUInt32BE(16)).toBe(1024); // width from the IHDR chunk
  });
});
