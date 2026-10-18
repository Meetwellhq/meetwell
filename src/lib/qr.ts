import "server-only";
import QRCode from "qrcode";
import sharp from "sharp";

const COLORS = { dark: "#141413", light: "#ffffff" };
const ACCENT = "#1f4d3f";

/** Share of the QR width covered by the logo tile. Level H tolerates ~30% damage; this covers ~6% of the area. */
const LOGO_SHARE = 0.24;

/** The Meetwell mark (same shapes as LogoMark), drawn in a 24×24 box. */
const LOGO_MARK = `<rect x="1" y="1" width="22" height="22" rx="7" fill="${ACCENT}"/>
<rect x="6" y="6" width="5" height="5" rx="1.5" fill="#fff"/>
<rect x="13" y="13" width="5" height="5" rx="1.5" fill="#fff"/>
<rect x="13" y="6" width="5" height="5" rx="2.5" fill="#fff" fill-opacity="0.55"/>
<rect x="6" y="13" width="5" height="5" rx="2.5" fill="#fff" fill-opacity="0.55"/>`;

/** Put the Meetwell logo, on a white rounded tile, in the middle of a QR code SVG. */
function addLogo(svg: string): string {
  const size = Number(svg.match(/viewBox="0 0 ([\d.]+) [\d.]+"/)?.[1]);
  if (!size) return svg;
  const tile = size * LOGO_SHARE;
  const at = (size - tile) / 2;
  const inset = tile * 0.12;
  const logo = `<g shape-rendering="geometricPrecision">
<rect x="${at}" y="${at}" width="${tile}" height="${tile}" rx="${tile * 0.24}" fill="${COLORS.light}"/>
<svg x="${at + inset}" y="${at + inset}" width="${tile - inset * 2}" height="${tile - inset * 2}" viewBox="0 0 24 24">${LOGO_MARK}</svg>
</g>`;
  return svg.replace(/<\/svg>\s*$/, `${logo}</svg>`);
}

/**
 * QR codes encode the permanent profile URL only — never contact details.
 * Error correction is set to H so the code still scans with the logo on top.
 */
export async function qrSvg(text: string, { margin = 2 }: { margin?: number } = {}) {
  const svg = await QRCode.toString(text, { type: "svg", errorCorrectionLevel: "H", margin, color: COLORS });
  return addLogo(svg);
}

export async function qrPng(text: string, size = 1024) {
  const width = Math.min(Math.max(size, 256), 2048);
  const svg = (await qrSvg(text, { margin: 4 })).replace("<svg ", `<svg width="${width}" height="${width}" `);
  return sharp(Buffer.from(svg)).png().toBuffer();
}
