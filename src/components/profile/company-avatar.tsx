import { Building2 } from "lucide-react";
import Image from "next/image";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import { findCompany } from "@/lib/profiles/careers";

/**
 * Profile photo with a small company badge in the corner: the company's logo
 * when we know it, otherwise a plain building icon. No badge without a company.
 */
export function CompanyAvatar({
  name,
  src,
  organization,
  className,
  badgeClassName = "size-9",
}: {
  name: string;
  src: string | null;
  organization: string | null;
  className?: string;
  badgeClassName?: string;
}) {
  const company = organization?.trim() ? findCompany(organization) : null;
  return (
    <div className="relative mx-auto w-fit">
      <Avatar name={name} src={src} className={className} />
      {organization?.trim() && (
        <span
          title={company?.name ?? organization}
          className={cn(
            // The after: layer is a 1px white inner stroke drawn on top of the logo.
            "absolute -bottom-0.5 -right-0.5 grid place-items-center overflow-hidden rounded-full border-2 border-surface bg-surface shadow-sm after:pointer-events-none after:absolute after:inset-0 after:rounded-full after:ring-1 after:ring-inset after:ring-white after:content-['']",
            badgeClassName,
          )}
        >
          {company?.logo ? (
            <Image src={company.logo} alt={`${company.name} logo`} width={96} height={96} className="size-full object-contain" />
          ) : (
            <Building2 className="size-1/2 text-ink-3" aria-label="Company" />
          )}
        </span>
      )}
    </div>
  );
}
