"use client";

import { useSyncedRef } from "@/hooks/use-sync-ref";
import { chainConfig, type ChainConfig } from "@/papi-config";
import { useWallet, type WalletAccount } from "@/providers/wallet-provider";
import { useChainId, useClient, useTypedApi } from "@reactive-dot/react";
import { createClient, PolkadotClient } from "polkadot-api";
import { getWsProvider } from "polkadot-api/ws-provider";

export function useRefObject() {
  const client = useClient();
  const chainId = useChainId();
  const api = useTypedApi();

  // Get active chain config from chainId
  const activeChain =
    chainConfig.find((chain) => chain.key === chainId) ?? chainConfig[0];

  const {
    allAccounts,
    selectedAccount,
    setSelectedAccount,
    connectedWallets,
    switchChain,
  } = useWallet();

  let assetHubClient: PolkadotClient | null = null;

  if (
    activeChain.name.toLowerCase().includes("paseo") ||
    activeChain.name.toLowerCase().includes("kusama") ||
    activeChain.name.toLowerCase().includes("westend")
  ) {
    const assetHubRpc = activeChain.name.toLowerCase().includes("paseo")
      ? "wss://sys.turboflakes.io/asset-hub-paseo"
      : activeChain.name.toLowerCase().includes("kusama")
        ? "wss://rpc-asset-hub-kusama.luckyfriday.io"
        : activeChain.name.toLowerCase().includes("westend")
          ? "wss://asset-hub-westend.rpc.permanence.io"
          : "wss://asset-hub-polkadot-rpc.n.dwellir.com";
    const provider = getWsProvider([assetHubRpc]);
    assetHubClient = createClient(provider);
  }

  // Chain switching function that uses reactive-dot's switchChain
  const setActiveChain = (chain: ChainConfig) => {
    switchChain(chain.key);
  };

  // refs to pass down to useChat
  const activeChainRef = useSyncedRef<ChainConfig>(activeChain);
  const setActiveChainRef = useSyncedRef<typeof setActiveChain>(setActiveChain);
  const apiRef = useSyncedRef<typeof api>(api);
  const connectedAccountsRef = useSyncedRef<WalletAccount[]>(allAccounts);
  const selectedAccountRef = useSyncedRef<WalletAccount | null>(
    selectedAccount,
  );
  const setSelectedAccountRef =
    useSyncedRef<typeof setSelectedAccount>(setSelectedAccount);
  const selectedExtensionsRef =
    useSyncedRef<typeof connectedWallets>(connectedWallets);
  const clientRef = useSyncedRef<typeof client>(client);
  const assetHubClientRef = useSyncedRef<typeof assetHubClient>(assetHubClient);
  const activeRpcChainRef = useSyncedRef<ChainConfig>(activeChain);
  const setActiveRpcChainRef =
    useSyncedRef<typeof setActiveChain>(setActiveChain);

  return {
    activeChainRef,
    setActiveChainRef,
    apiRef,
    connectedAccountsRef,
    selectedAccountRef,
    setSelectedAccountRef,
    selectedExtensionsRef,
    clientRef,
    assetHubClientRef,
    activeRpcChainRef,
    setActiveRpcChainRef,
  };
}
