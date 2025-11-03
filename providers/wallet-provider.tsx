"use client";

import { config } from "@/lib/wallet-config";
import type { Wallet } from "@reactive-dot/core/wallets.js";
import {
  ChainProvider,
  ReactiveDotProvider,
  useAccounts,
  useConnectedWallets,
  useWalletConnector,
  useWalletDisconnector,
  useWallets,
} from "@reactive-dot/react";
import type { PolkadotSigner } from "polkadot-api";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

export interface WalletAccount {
  address: string;
  name?: string;
  polkadotSigner: PolkadotSigner;
  wallet: Wallet;
}

interface WalletContextType {
  isInitializing: boolean;
  selectedAccount: WalletAccount | null;
  setSelectedAccount: (account: WalletAccount) => void;
  availableWallets: Wallet[];
  connectedWallets: Wallet[];
  connectWallet: (wallet: Wallet) => Promise<void>;
  disconnectWallet: (wallet: Wallet) => Promise<void>;
  allAccounts: WalletAccount[];
  isWalletOpen: boolean;
  setIsWalletOpen: (open: boolean) => void;
  activeChainId: string;
  switchChain: (chainId: string) => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const SELECTED_ACCOUNT_KEY = "agent-dot:selected-account";
const SELECTED_CHAIN_KEY = "agent-dot:selected-chain";

interface StoredAccount {
  walletId: string;
  address: string;
}

function WalletProviderInner({
  children,
  chainId,
  onChainSwitch,
}: {
  children: ReactNode;
  chainId: string;
  onChainSwitch: (chainId: string) => void;
}) {
  const wallets = useWallets();
  const connectedWallets = useConnectedWallets();
  const accounts = useAccounts();

  const [, connectWallet] = useWalletConnector();
  const [, disconnectWallet] = useWalletDisconnector();

  const [isInitializing, setIsInitializing] = useState(true);
  const [selectedAccount, setSelectedAccountState] =
    useState<WalletAccount | null>(null);
  const [isWalletOpen, setIsWalletOpen] = useState(false);

  // Convert @reactive-dot accounts to our WalletAccount format
  // Memoize to prevent infinite loops in useEffect
  const allAccounts: WalletAccount[] = useMemo(
    () =>
      accounts.map((account) => ({
        address: account.address,
        name: account.name,
        polkadotSigner: account.polkadotSigner,
        wallet: account.wallet,
      })),
    [accounts],
  );

  const setSelectedAccount = useCallback((account: WalletAccount | null) => {
    setSelectedAccountState(account);
    if (account) {
      const stored: StoredAccount = {
        walletId: account.wallet.id,
        address: account.address,
      };
      localStorage.setItem(SELECTED_ACCOUNT_KEY, JSON.stringify(stored));
    } else {
      localStorage.removeItem(SELECTED_ACCOUNT_KEY);
    }
  }, []);

  const handleConnectWallet = useCallback(
    async (wallet: Wallet) => {
      try {
        await connectWallet(wallet);
      } catch (error) {
        const err = error as Error;
        toast.error(`Failed to connect ${wallet.name}: ${err.message}`);
      }
    },
    [connectWallet],
  );

  const handleDisconnectWallet = useCallback(
    async (wallet: Wallet) => {
      try {
        await disconnectWallet(wallet);
        // If the disconnected wallet had the selected account, clear it
        if (selectedAccount?.wallet.id === wallet.id) {
          setSelectedAccountState(null);
          localStorage.removeItem(SELECTED_ACCOUNT_KEY);
        }
      } catch (error) {
        const err = error as Error;
        toast.error(`Failed to disconnect ${wallet.name}: ${err.message}`);
      }
    },
    [disconnectWallet, selectedAccount],
  );

  // Restore selected account on mount
  useEffect(() => {
    const stored = localStorage.getItem(SELECTED_ACCOUNT_KEY);
    if (!stored || allAccounts.length === 0) {
      setIsInitializing(false);
      return;
    }

    try {
      const { walletId, address } = JSON.parse(stored) as StoredAccount;
      const account = allAccounts.find(
        (acc) => acc.wallet.id === walletId && acc.address === address,
      );
      if (account) {
        setSelectedAccountState(account);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn("Failed to restore selected account:", error);
      localStorage.removeItem(SELECTED_ACCOUNT_KEY);
    } finally {
      setIsInitializing(false);
    }
  }, [allAccounts]);

  const switchChain = useCallback(
    (newChainId: string) => {
      onChainSwitch(newChainId);
    },
    [onChainSwitch],
  );

  return (
    <WalletContext.Provider
      value={{
        isInitializing,
        selectedAccount,
        setSelectedAccount,
        availableWallets: wallets,
        connectedWallets,
        connectWallet: handleConnectWallet,
        disconnectWallet: handleDisconnectWallet,
        allAccounts,
        isWalletOpen,
        setIsWalletOpen,
        activeChainId: chainId,
        switchChain,
      }}
    >
      {isInitializing ? (
        <div className="flex h-screen items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"></div>
            <p className="text-muted-foreground text-sm">Loading AgentDot...</p>
          </div>
        </div>
      ) : (
        <>{children}</>
      )}
    </WalletContext.Provider>
  );
}

export function WalletProvider({ children }: { children: ReactNode }) {
  // Restore chain from localStorage on mount
  const [activeChainId, setActiveChainId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(SELECTED_CHAIN_KEY);
      return stored ?? "polkadot";
    }
    return "polkadot";
  });

  const handleChainSwitch = useCallback((chainId: string) => {
    setActiveChainId(chainId);
    // Persist chain selection
    if (typeof window !== "undefined") {
      localStorage.setItem(SELECTED_CHAIN_KEY, chainId);
    }
  }, []);

  return (
    <ReactiveDotProvider config={config}>
      <ChainProvider chainId={activeChainId}>
        <WalletProviderInner
          chainId={activeChainId}
          onChainSwitch={handleChainSwitch}
        >
          {children}
        </WalletProviderInner>
      </ChainProvider>
    </ReactiveDotProvider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
