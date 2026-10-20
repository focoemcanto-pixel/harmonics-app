"use client";
import { useEffect, useState } from "react";
import ServiceSpecsSummary from "./ServiceSpecsSummary";
export default function EventServices({ eventId, onLoad }) {
  const [row, setRow] = useState(null);
  useEffect(() => {
    if (!eventId) return;
    let alive = true;
    onLoad?.(null);
    const load = () =>
      fetch(`/api/events/${eventId}/services`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (alive && j?.ok) {
            setRow({ ...j, eventId });
            onLoad?.(j.service_specs);
          }
        })
        .catch(() => {});
    load();
    window.addEventListener("focus", load);
    return () => {
      alive = false;
      window.removeEventListener("focus", load);
    };
  }, [eventId, onLoad]);
  return row?.eventId === eventId ? <ServiceSpecsSummary row={row} /> : null;
}
