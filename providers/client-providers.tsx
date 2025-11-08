"use client";

import { Providers } from "@/providers";
import dynamic from "next/dynamic";

export const ClientProviders = dynamic(() => Promise.resolve(Providers), {
  ssr: false,
});
