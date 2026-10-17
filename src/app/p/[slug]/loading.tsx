import { Skeleton } from "@/components/ui/misc";

export default function Loading() {
  return (
    <main className="flex-1 px-4 py-6 sm:py-12" aria-busy="true" aria-label="Loading profile">
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <div className="flex flex-col items-center rounded-2xl border border-border bg-surface px-5 py-7">
          <Skeleton className="size-24 rounded-full" />
          <Skeleton className="mt-4 h-7 w-48" />
          <Skeleton className="mt-2 h-4 w-40" />
          <Skeleton className="mt-6 h-12 w-full rounded-full" />
          <div className="mt-3 grid w-full grid-cols-2 gap-2">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        </div>
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    </main>
  );
}
