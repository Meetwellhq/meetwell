/** Hero photo: friends at a café table, one holding up a tablet to scan a QR code. */
const PHOTO = "/hero/hero-photo.webp"; // 1500×1000

export function HeroPhoto() {
  return (
    <div className="relative aspect-[3/2] w-full overflow-hidden rounded-[1.25rem] bg-[#e9d9c6]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={PHOTO}
        alt="People at a café table, one holding up a tablet to scan a QR code"
        width={1500}
        height={1000}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </div>
  );
}
