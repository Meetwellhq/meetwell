import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import { APP_NAME, getSiteUrl } from "@/lib/config";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: { default: `${APP_NAME} — Meet someone. Make it a connection.`, template: `%s · ${APP_NAME}` },
  description: "Share your card with one scan. Make it easy for people to follow up.",
  applicationName: APP_NAME,
  // The share image itself comes from app/opengraph-image.png (a screenshot of the landing hero).
  openGraph: { type: "website", siteName: APP_NAME },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#fafaf8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
