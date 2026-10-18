/** Hero photo: two people talking in a bright office with a city view. */
const PHOTO = "/hero/hero-photo.webp"; // 1500×844

export function HeroPhoto() {
  return (
    <div className="relative aspect-[1500/844] w-full overflow-hidden rounded-[1rem] bg-[#dbe7ef]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={PHOTO}
        alt="Two people in conversation in a bright office overlooking the city"
        width={1500}
        height={844}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </div>
  );
}
