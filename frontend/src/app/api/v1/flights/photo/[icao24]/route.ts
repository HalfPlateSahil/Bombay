import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const KNOWN_AIRCRAFT_PHOTOS: Record<string, string> = {
  // Direct verified photo URLs for Mumbai fleet aircraft
  "VT-ILH": "https://t.plnspttrs.net/22530/1445721_1a8784e0f8_280.jpg",
  "800b46": "https://t.plnspttrs.net/22530/1445721_1a8784e0f8_280.jpg",
  "IGO447L": "https://t.plnspttrs.net/22530/1445721_1a8784e0f8_280.jpg",

  "VT-ANB": "https://t.plnspttrs.net/10848/1762968_792c2a31b7_280.jpg",
  "800366": "https://t.plnspttrs.net/10848/1762968_792c2a31b7_280.jpg",
  "AIC655": "https://t.plnspttrs.net/10848/1762968_792c2a31b7_280.jpg",

  "VT-TNB": "https://t.plnspttrs.net/40342/1852294_b34e5ca360_280.jpg",
  "8006e8": "https://t.plnspttrs.net/40342/1852294_b34e5ca360_280.jpg",
  "VTI832": "https://t.plnspttrs.net/40342/1852294_b34e5ca360_280.jpg",

  "VT-YAA": "https://t.plnspttrs.net/33643/1928442_aa250a729f_280.jpg",
  "800ec4": "https://t.plnspttrs.net/33643/1928442_aa250a729f_280.jpg",
  "AKJ1102": "https://t.plnspttrs.net/33643/1928442_aa250a729f_280.jpg",

  "A6-BLA": "https://t.plnspttrs.net/16686/1907160_d45143312b_280.jpg",
  "89635b": "https://t.plnspttrs.net/16686/1907160_d45143312b_280.jpg",
  "ETD412": "https://t.plnspttrs.net/16686/1907160_d45143312b_280.jpg",

  "A6-EGO": "https://t.plnspttrs.net/48650/1907653_86215045a5_280.jpg",
  "89617d": "https://t.plnspttrs.net/48650/1907653_86215045a5_280.jpg",
  "UAE506": "https://t.plnspttrs.net/48650/1907653_86215045a5_280.jpg",

  "A7-ALA": "https://t.plnspttrs.net/27259/1977304_46c509900f_280.jpg",
  "06a090": "https://t.plnspttrs.net/27259/1977304_46c509900f_280.jpg",
  "QTR556": "https://t.plnspttrs.net/27259/1977304_46c509900f_280.jpg",

  "9V-SKK": "https://t.plnspttrs.net/45190/1145941_8596e93009_280.jpg",
  "76a5eb": "https://t.plnspttrs.net/45190/1145941_8596e93009_280.jpg",
  "SIA422": "https://t.plnspttrs.net/45190/1145941_8596e93009_280.jpg",

  "VT-SZB": "https://t.plnspttrs.net/00538/505047_fae6e985f4_280.jpg",
  "8005b7": "https://t.plnspttrs.net/00538/505047_fae6e985f4_280.jpg",
  "SEJ204": "https://t.plnspttrs.net/00538/505047_fae6e985f4_280.jpg",

  "VT-ITG": "https://t.plnspttrs.net/19398/1504807_dbe2461850_280.jpg",
  "80088b": "https://t.plnspttrs.net/19398/1504807_dbe2461850_280.jpg",
  "IGO2114": "https://t.plnspttrs.net/19398/1504807_dbe2461850_280.jpg",

  "VT-PPA": "https://t.plnspttrs.net/00309/1397118_217324f4ce_280.jpg",
  "80051e": "https://t.plnspttrs.net/00309/1397118_217324f4ce_280.jpg",
  "AIC887": "https://t.plnspttrs.net/00309/1397118_217324f4ce_280.jpg",

  "VT-IVB": "https://t.plnspttrs.net/00399/1823098_6dde697d26_280.jpg",
  "8007ae": "https://t.plnspttrs.net/00399/1823098_6dde697d26_280.jpg",
  "IGO601": "https://t.plnspttrs.net/00399/1823098_6dde697d26_280.jpg",

  "D-AIGX": "https://t.plnspttrs.net/09962/1992062_249147a857_280.jpg",
  "3c4738": "https://t.plnspttrs.net/09962/1992062_249147a857_280.jpg",
  "DLH756": "https://t.plnspttrs.net/09962/1992062_249147a857_280.jpg",

  "G-VIIA": "https://t.plnspttrs.net/32486/1941585_b21efd71a5_280.jpg",
  "400619": "https://t.plnspttrs.net/32486/1941585_b21efd71a5_280.jpg",
  "BAW199": "https://t.plnspttrs.net/32486/1941585_b21efd71a5_280.jpg"
};

const photoCache = new Map<string, string>();

export async function GET(
  request: Request,
  { params }: { params: { icao24: string } }
) {
  const query = (params.icao24 || "").trim();
  if (!query) {
    return NextResponse.json({ error: "No aircraft identifier provided" }, { status: 400 });
  }

  // Check known aircraft photos directly
  if (KNOWN_AIRCRAFT_PHOTOS[query] || KNOWN_AIRCRAFT_PHOTOS[query.toLowerCase()] || KNOWN_AIRCRAFT_PHOTOS[query.toUpperCase()]) {
    const directUrl = KNOWN_AIRCRAFT_PHOTOS[query] || KNOWN_AIRCRAFT_PHOTOS[query.toLowerCase()] || KNOWN_AIRCRAFT_PHOTOS[query.toUpperCase()];
    return NextResponse.redirect(directUrl);
  }

  if (photoCache.has(query)) {
    return NextResponse.redirect(photoCache.get(query)!);
  }

  // Query Planespotters by registration or hex with verified contact User-Agent
  const tryEndpoints = [
    `https://api.planespotters.net/pub/photos/reg/${query.toUpperCase()}`,
    `https://api.planespotters.net/pub/photos/hex/${query.toLowerCase()}`
  ];

  for (const endpoint of tryEndpoints) {
    try {
      const res = await fetch(endpoint, {
        headers: { "User-Agent": "MumbaiAtlas/1.0 (+https://mumbai-atlas.vercel.app/contact)" },
        next: { revalidate: 86400 }
      });
      if (res.ok) {
        const data = await res.json();
        const photos = data.photos || [];
        if (photos.length > 0) {
          const photoUrl = photos[0]?.thumbnail_large?.src || photos[0]?.thumbnail?.src;
          if (photoUrl) {
            photoCache.set(query, photoUrl);
            return NextResponse.redirect(photoUrl);
          }
        }
      }
    } catch (e) {
      // Continue to next endpoint
    }
  }

  // Real aircraft fallback from fleet (IndiGo A321neo)
  const defaultPhoto = "https://t.plnspttrs.net/22530/1445721_1a8784e0f8_280.jpg";
  photoCache.set(query, defaultPhoto);
  return NextResponse.redirect(defaultPhoto);
}
