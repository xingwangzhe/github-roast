/**
 * Current sponsor — single source of truth.
 *
 * Drives the on-site credits AND the live `/api/card` image. Because the card is
 * rendered on every request (not a frozen PNG), changing this constant (or its
 * env overrides) and redeploying updates every already-embedded card within the
 * CDN/camo cache window. Swap sponsor / edit text / remove here, one place.
 */
export const SPONSOR = {
  name: process.env.SPONSOR_NAME || "LobeHub",
  url: process.env.SPONSOR_URL || "https://lobehub.com",
  logo: "/lobehub.png",
};
