import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://mobilev2.gruposgapetro.com.br:4444'

export const metadata: Metadata = {
  title:       "Portal Mobile",
  description: "Plataforma de gestão para postos de combustível — SGA Petro",
  openGraph: {
    title:       "Portal Mobile",
    description: "Plataforma de gestão para postos de combustível — SGA Petro",
    siteName:    "SGA Petro",
    type:        "website",
    url:         BASE_URL,
    images: [
      {
        url:    `${BASE_URL}/logo-vertical.png`,
        width:  192,
        height: 192,
        alt:    "Logo SGA Petro",
      },
    ],
  },
  twitter: {
    card:        "summary",
    title:       "Portal Mobile",
    description: "Plataforma de gestão para postos de combustível",
    images:      [`${BASE_URL}/logo-vertical.png`],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
