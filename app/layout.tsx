import {
  geist,
  manrope,
  montserrat,
  outfit,
  poppins,
  unbounded,
  workSans,
} from "@/lib/font";
import { ClientProviders } from "@/providers/client-providers";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentDot",
  description:
    "AgentDot is an AI-Powered Interaction Layer for the Polkadot ecosystem.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geist.variable} ${manrope.variable} ${montserrat.variable} ${outfit.variable} ${poppins.variable} ${unbounded.variable} ${workSans.variable} antialiased`}
      >
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
