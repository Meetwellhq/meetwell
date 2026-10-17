"use client";

import { Camera, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { AVATAR_BUCKET } from "@/lib/profiles/avatar";
import { createClient } from "@/lib/supabase/client";

const MAX_INPUT_BYTES = 10 * 1024 * 1024;

/** Center-crop to a square and re-encode as a 512px JPEG to keep uploads small. */
async function resizeToSquareJpeg(file: File, size = 512): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Encode failed"))), "image/jpeg", 0.86),
  );
}

export function AvatarUpload({
  userId,
  name,
  value,
  onChange,
  error,
}: {
  userId: string;
  name: string;
  value: string | null;
  onChange: (url: string | null) => void;
  error?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const toast = useToast();

  async function handle(file: File) {
    if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) {
      toast("Please choose a JPG, PNG or WebP image.", "error");
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      toast("That image is over 10 MB. Please choose a smaller one.", "error");
      return;
    }
    setUploading(true);
    try {
      const blob = await resizeToSquareJpeg(file);
      const supabase = createClient();
      const path = `${userId}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
      onChange(data.publicUrl);
      toast("Photo uploaded. Save to keep it.", "info");
    } catch {
      toast("We couldn't upload that photo. Please try another.", "error");
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div>
      <div className="flex items-center gap-4">
        <Avatar name={name || "You"} src={value} className="size-20 text-xl" />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" loading={uploading} icon={<Camera className="size-4" />} onClick={() => input.current?.click()}>
            {value ? "Change photo" : "Upload photo"}
          </Button>
          {value && (
            <Button variant="ghost" size="sm" icon={<Trash2 className="size-4" />} onClick={() => onChange(null)}>
              Remove
            </Button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-label="Profile photo"
          onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])}
        />
      </div>
      <p className={error ? "mt-2 text-sm text-danger" : "mt-2 text-sm text-ink-3"}>
        {error ?? "Optional. A clear photo helps people remember you. We'll crop it to a circle."}
      </p>
    </div>
  );
}
