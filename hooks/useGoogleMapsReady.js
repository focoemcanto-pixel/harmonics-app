import { useEffect, useState } from "react";

export function useGoogleMapsReady() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    function handler() {
      setReady(!!window.google?.maps?.places);
    }

    // já carregou?
    if (window.google?.maps?.places) {
      setReady(true);
      return;
    }

    // espera evento do script
    window.addEventListener("google-maps-loaded", handler);
    window.addEventListener("google-maps-error", handler);

    return () => {
      window.removeEventListener("google-maps-loaded", handler);
      window.removeEventListener("google-maps-error", handler);
    };
  }, []);

  return ready;
}
