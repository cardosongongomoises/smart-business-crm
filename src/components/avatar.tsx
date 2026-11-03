"use client";

import { useEffect, useState } from "react";
import { avatarColor, cn, initials } from "@/lib/utils";

const avatarCache = new Map<string, string | null>();
const pendingFetches = new Map<string, Promise<string | null>>();

async function fetchAvatarForPhone(phone: string): Promise<string | null> {
  const clean = phone.replace(/\D/g, "");
  if (!clean || clean.length < 8) return null;
  if (avatarCache.has(clean)) return avatarCache.get(clean) ?? null;
  if (pendingFetches.has(clean)) return pendingFetches.get(clean)!;

  const promise = fetch(`/api/avisa/avatar?phone=${clean}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      const url = typeof data?.url === "string" ? data.url : null;
      avatarCache.set(clean, url);
      return url;
    })
    .catch(() => {
      avatarCache.set(clean, null);
      return null;
    })
    .finally(() => {
      pendingFetches.delete(clean);
    });

  pendingFetches.set(clean, promise);
  return promise;
}

/** Avatar de contacto: foto do perfil ou iniciais sobre cor estável. */
export function ContactAvatar({
  name,
  seed,
  size = "md",
  avatarUrl = null,
  phone = null,
}: {
  name: string;
  /** Semilla del color (id o teléfono): estable para el mismo contacto. */
  seed: string;
  size?: "sm" | "md" | "lg";
  avatarUrl?: string | null;
  phone?: string | null;
}) {
  const [imgError, setImgError] = useState(false);
  const [dynamicAvatar, setDynamicAvatar] = useState<string | null>(avatarUrl);

  useEffect(() => {
    if (avatarUrl) {
      setDynamicAvatar(avatarUrl);
      return;
    }
    const targetPhone =
      phone || (seed && /^\+?\d{8,}/.test(seed) ? seed : null);
    if (!targetPhone) return;

    let active = true;
    void fetchAvatarForPhone(targetPhone).then((url) => {
      if (active && url) {
        setDynamicAvatar(url);
      }
    });

    return () => {
      active = false;
    };
  }, [avatarUrl, phone, seed]);

  const sizes = {
    sm: "h-7 w-7 text-[10px]",
    md: "h-9 w-9 text-xs",
    lg: "h-12 w-12 text-sm",
  } as const;

  const currentUrl = dynamicAvatar || avatarUrl;

  if (currentUrl && !imgError) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={currentUrl}
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
