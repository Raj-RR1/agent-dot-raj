"use client";

import { WalletProvider } from "@/providers/wallet-provider";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      {children}
      <Toaster
        position="bottom-right"
        richColors
        duration={3000}
        theme="dark"
      />
    </WalletProvider>
  );
}
