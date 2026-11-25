import { EmergencyStatus, GeoLocation } from "../types";

export type MapCoordinates = {
  latitude: number;
  longitude: number;
};

type GeocodedAddress = {
  name?: string | null;
  formattedAddress?: string | null;
  streetNumber?: string | null;
  street?: string | null;
  district?: string | null;
  city?: string | null;
  subregion?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
};

/** Older SOS records stored raw coordinates in the address field. */
export const isReadableAddress = (value?: string | null): boolean => {
  const address = value?.trim();
  if (!address) return false;

  const normalized = address.toLowerCase();
  return !normalized.startsWith("lat:") && !normalized.startsWith("latitude:");
};

/** Emergency requests created without GPS use [0, 0], so treat that as no pin. */
export const hasUsableCoordinates = (location?: GeoLocation | null): boolean => {
  if (!location || !Array.isArray(location.coordinates)) return false;

  const [longitude, latitude] = location.coordinates;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;

  return latitude !== 0 || longitude !== 0;
};

export const toMapCoordinates = (location?: GeoLocation | null): MapCoordinates | null => {
  if (!hasUsableCoordinates(location)) return null;

  const [longitude, latitude] = location!.coordinates as [number, number];
  return { latitude, longitude };
};

/** Citizens can track the responder location only after a volunteer accepts. */
export const canViewEmergencyMap = (status?: EmergencyStatus | null): boolean =>
  status === "accepted" || status === "in_progress" || status === "resolved";

/** Builds a readable address from Expo Location's reverse-geocode result. */
export const formatGeocodedAddress = (address?: GeocodedAddress | null): string => {
  if (!address) return "";

  if (address.formattedAddress?.trim()) {
    return address.formattedAddress.trim();
  }

  const street = [address.streetNumber, address.street].filter(Boolean).join(" ").trim();
  const candidates = [
    street,
    address.district,
    address.city,
    address.subregion,
    address.region,
    address.postalCode,
    address.country,
    address.name,
  ];

  const seen = new Set<string>();
  const parts = candidates.filter((part): part is string => {
    const value = typeof part === "string" ? part.trim() : "";
    if (!value || seen.has(value.toLowerCase())) return false;
    seen.add(value.toLowerCase());
    return true;
  });

  return parts.join(", ");
};

export const buildGoogleMapsUrl = ({ latitude, longitude }: MapCoordinates): string => {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${latitude},${longitude}`
  )}`;
};
