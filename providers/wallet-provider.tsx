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
  const [rpcStuck, setRpcStuck] = useState(false);
  const [rpcRetryKey, setRpcRetryKey] = useState(0);

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

  const setSelectedAccount = useCallback((account: WalletAccount) => {
    setSelectedAccountState(account);
    const stored: StoredAccount = {
      walletId: account.wallet.id,
      address: account.address,
    };
    localStorage.setItem(SELECTED_ACCOUNT_KEY, JSON.stringify(stored));
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

  // Detect potentially stuck RPC (simple timeout heuristic)
  useEffect(() => {
    setRpcStuck(false);
    const timeout = setTimeout(() => {
      setRpcStuck(true);
    }, 20000);

    return () => {
      clearTimeout(timeout);
    };
  }, [chainId, rpcRetryKey]);

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
        <>
          {rpcStuck && (
            <div className="bg-background/80 pointer-events-auto fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-background border-border w-full max-w-sm rounded-xl border p-5 shadow-lg">
                <div className="mb-2 text-lg font-semibold">
                  RPC not responding
                </div>
                <p className="text-muted-foreground mb-4 text-sm">
                  The current network appears to be taking too long to load. You
                  can retry, or switch to Polkadot.
                </p>
                <div className="flex gap-2">
                  <button
                    className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium"
                    onClick={() => {
                      switchChain("polkadot");
                      setRpcStuck(false);
                    }}
                  >
                    Switch to Polkadot
                  </button>
                  <button
                    className="border-input hover:bg-accent hover:text-accent-foreground inline-flex h-9 items-center justify-center rounded-md border bg-transparent px-3 text-sm"
                    onClick={() => {
                      setRpcStuck(false);
                      setRpcRetryKey((k) => k + 1);
                    }}
                  >
                    Retry
                  </button>
                </div>
              </div>
            </div>
          )}
          {children}
        </>
      )}
    </WalletContext.Provider>
  );
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [isInitializing, setIsInitializing] = useState(true);

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

  // Initialize on mount
  useEffect(() => {
    // Small delay to allow reactive-dot to initialize
    const timer = setTimeout(() => {
      setIsInitializing(false);
    }, 100);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  if (isInitializing) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"></div>
          <p className="text-muted-foreground text-sm">Loading AgentDot...</p>
        </div>
      </div>
    );
  }

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
