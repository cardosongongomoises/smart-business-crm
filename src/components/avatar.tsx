"use client";

import { useState } from "react";
import { avatarColor, cn, initials } from "@/lib/utils";

/** Avatar de contacto: foto do perfil ou iniciais sobre cor estável. */
export function ContactAvatar({
  name,
  seed,
  size = "md",
  avatarUrl = null,
}: {
  name: string;
  /** Semilla del color (id o teléfono): estable para el mismo contacto. */
  seed: string;
  size?: "sm" | "md" | "lg";
  avatarUrl?: string | null;
}) {
  const [imgError, setImgError] = useState(false);

  const sizes = {
    sm: "h-7 w-7 text-[10px]",
    md: "h-9 w-9 text-xs",
    lg: "h-12 w-12 text-sm",
  } as const;

  if (avatarUrl && !imgError) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        onError={() => setImgError(true)}
        className={cn(
          "shrink-0 rounded-full object-cover border border-border-strong/40 bg-card",
          sizes[size]
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        sizes[size],
        avatarColor(seed)
      )}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}
