import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/config";

/**
 * Makes Meetwell installable ("Add to Home Screen"). The installed app opens
 * /home, which goes to the dashboard when signed in and the landing page
 * otherwise. Icons are made from the logo (public/icons/).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: APP_NAME,
    short_name: APP_NAME,
    description: "Your networking card with its own QR code.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fafaf8",
    theme_color: "#1f4d3f",
    categories: ["business", "productivity", "social"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "My card", url: "/dashboard/profile" },
      { name: "Contacts", url: "/dashboard/contacts" },
    ],
  };
}
