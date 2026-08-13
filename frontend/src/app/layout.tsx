import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mumbai Atlas | Real-time Digital Twin & Climate / Disaster Simulator",
  description: "Real-time interactive 3D digital twin clone of Mumbai with live weather, air quality, marine telemetry, traffic congestion, and interactive disaster impact simulations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-[#080c14] text-slate-100 overflow-hidden w-screen h-screen">
        {children}
      </body>
    </html>
  );
}
