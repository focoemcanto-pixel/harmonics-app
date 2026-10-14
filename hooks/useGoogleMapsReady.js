import { useEffect, useState } from "react";

const GOOGLE_MAPS_SCRIPT_ID = "google-maps-places";

function ensureGoogleMapsScript() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  if (!apiKey || window.google?.maps?.places || document.getElementById(GOOGLE_MAPS_SCRIPT_ID)) return;

  const script = document.createElement("script");
  script.id = GOOGLE_MAPS_SCRIPT_ID;
  script.async = true;
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&loading=async`;
  script.onload = () => {
    window.__GOOGLE_MAPS_LOADED__ = true;
    window.dispatchEvent(new Event("google-maps-loaded"));
  };
  script.onerror = () => {
    window.__GOOGLE_MAPS_ERROR__ = true;
    window.dispatchEvent(new Event("google-maps-error"));
  };
  document.head.appendChild(script);
}

export function useGoogleMapsReady() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let intervalId = null;

    function checkReady() {
      const isReady = !!window.google?.maps?.places;

      if (isReady) {
        setReady(true);
        if (intervalId) {
          clearInterval(intervalId);
        }
      }
    }

    function handleLoaded() {
      checkReady();
    }

    function handleError() {
      setReady(false);
      if (intervalId) {
        clearInterval(intervalId);
      }
    }

    // Carregamento sob demanda: o script só entra nas páginas que usam Maps (antes era global).
    ensureGoogleMapsScript();

    // checagem imediata
    checkReady();

    // se ainda não estiver pronto, começa a verificar por alguns segundos
    if (!window.google?.maps?.places) {
      intervalId = setInterval(checkReady, 300);
    }

    // continua ouvindo eventos também
    window.addEventListener("google-maps-loaded", handleLoaded);
    window.addEventListener("google-maps-error", handleError);

    return () => {
      window.removeEventListener("google-maps-loaded", handleLoaded);
      window.removeEventListener("google-maps-error", handleError);

      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  return ready;
}
