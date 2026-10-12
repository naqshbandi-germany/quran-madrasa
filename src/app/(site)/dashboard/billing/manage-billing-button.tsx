"use client";

import { useState } from "react";

export function ManageBillingButton() {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
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
      onClick={handleClick}
      disabled={loading}
      className="btn-primary btn-display px-5 py-2.5 disabled:opacity-60"
    >
      {loading ? "Einen Moment..." : "Zum Kundenportal (kündigen / Zahlungsdaten ändern)"}
    </button>
  );
}
