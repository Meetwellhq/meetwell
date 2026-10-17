import "server-only";
import QRCode from "qrcode";

const COLORS = { dark: "#141413", light: "#ffffff" };

/** QR codes encode the permanent profile URL only — never contact details. */
export async function qrSvg(text: string, { margin = 2 }: { margin?: number } = {}) {
  return QRCode.toString(text, { type: "svg", errorCorrectionLevel: "M", margin, color: COLORS });
}

export async function qrPng(text: string, size = 1024) {
  return QRCode.toBuffer(text, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 4,
    width: Math.min(Math.max(size, 256), 2048),
    color: COLORS,
  });
}
