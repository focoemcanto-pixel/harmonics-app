'use client';

import Script from 'next/script';

declare global {
  interface Window {
    __GOOGLE_MAPS_LOADED__?: boolean;
    __GOOGLE_MAPS_ERROR__?: boolean;
  }
}

type Props = {
  apiKey: string;
};

declare global {
  interface Window {
    __GOOGLE_MAPS_LOADED__?: boolean;
    __GOOGLE_MAPS_ERROR__?: boolean;
  }
}

export default function GoogleMapsScriptClient({ apiKey }: Props) {
  if (!apiKey) return null;

  return (
    <Script
      id="google-maps-places"
      src={`https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`}
      strategy="afterInteractive"
      onLoad={() => {
        if (typeof window !== 'undefined') {
          window.__GOOGLE_MAPS_LOADED__ = true;
          window.dispatchEvent(new Event('google-maps-loaded'));
        }
      }}
      onError={() => {
        if (typeof window !== 'undefined') {
          window.__GOOGLE_MAPS_ERROR__ = true;
          window.dispatchEvent(new Event('google-maps-error'));
        }
      }}
    />
  );
}
