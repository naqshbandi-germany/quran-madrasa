"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SubscribeButton({ courseId, slug }: { courseId: string; slug: string }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubscribe() {
    if (!session) {
      router.push(`/auth/signin?callbackUrl=/courses/${slug}`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleSubscribe}
      disabled={loading}
      className="rounded-md bg-brand-600 px-5 py-2.5 font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
    >
      {loading ? "Einen Moment..." : "Jetzt abonnieren"}
    </button>
  );
}
