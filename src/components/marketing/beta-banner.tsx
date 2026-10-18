import Link from "next/link";
import { APP_NAME, JOIN_CTA } from "@/lib/config";

/** Thin announcement bar shown above the header during the private beta. */
export function BetaBanner() {
  return (
    <div role="status" className="bg-accent px-4 py-2.5 text-center text-sm text-white">
      {APP_NAME} is in private Beta.{" "}
      <Link href={JOIN_CTA.href} className="font-medium underline underline-offset-4 hover:no-underline">
        {JOIN_CTA.label}
      </Link>
    </div>
  );
}
