import type { Metadata } from "next";
import { IBM_Plex_Mono, Outfit, Cinzel } from "next/font/google";
import "./globals.css";

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "TVA Protocol | EVM on Stellar",
  description: "Compile Solidity. Settle on Stellar. 5-second finality, near-zero fees. The EVM compatibility layer that compiles, not interprets.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${cinzel.variable} ${outfit.variable} ${ibmPlexMono.variable} antialiased bg-black text-white`}
      >
        {children}
      </body>
    </html>
  );
}
