import { useEffect, useState } from "react";

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
