import { createClient } from "polkadot-api";
import { getWsProvider } from "polkadot-api/ws-provider";

/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getAccountBalance,
  getSessionValidators,
  StakingDescriptors,
} from "@/lib/polkadot-api";
import { ChainConfig, chainConfig } from "@/papi-config";
import {
  ActiveChainRef,
  ApiRef,
  ClientRef,
  ConnectedAccountsRef,
  SelectedAccountRef,
  SetActiveRpcChainRef,
  SetSelectedAccountRef,
} from "@/types";
import { UIMessage, UseChatHelpers } from "@ai-sdk/react";
import { SS58String } from "polkadot-api";
import { RefObject } from "react";

export async function onChatToolCall({
  apiRef,
  activeChainRef,
  setActiveChainRef,
  connectedAccountsRef,
  selectedAccountRef,
  setSelectedAccountRef,
  clientRef,
  setActiveRpcChainRef,
  toolCall,
  addToolResult,
}: {
  apiRef: ApiRef;
  activeChainRef: ActiveChainRef;
  setActiveChainRef: RefObject<(chain: ChainConfig) => void>;
  connectedAccountsRef: ConnectedAccountsRef;
  selectedAccountRef: SelectedAccountRef;
  setSelectedAccountRef: SetSelectedAccountRef;
  clientRef: ClientRef;
  setActiveRpcChainRef: SetActiveRpcChainRef;
  toolCall: {
    toolName: string;
    toolCallId: string;
    input: unknown;
  };
  addToolResult: UseChatHelpers<UIMessage>["addToolResult"];
}) {
  // Before handling any tool, try to hydrate the selected account from storage
  const hydrateSelectedFromStorage = () => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("agent-dot:selected-account");
      if (!raw) return;
      const { address, name } = JSON.parse(raw) as {
        address?: string;
        name?: string;
      };
      // try to find a connected account that matches
      let found = address
        ? connectedAccountsRef.current.find((a) => a.address === address)
        : undefined;
      if (!found && name) {
        found = connectedAccountsRef.current.find((a) => a.name === name);
      }
      if (found) {
        const current = selectedAccountRef.current;
        if (current?.address !== found.address) {
          setSelectedAccountRef.current(found);
        }
      }
    } catch {
      // ignore
    }
  };

  hydrateSelectedFromStorage();
  // Resolve freshest active account; prefer latest persisted selection (storage)
  // Returns either a connected account or a lightweight { address, name } from storage
  const resolveActiveSelection = ():
    | { address?: string; name?: string }
    | undefined => {
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem("agent-dot:selected-account");
        if (raw) {
          const { address, name } = JSON.parse(raw) as {
            address?: string;
            name?: string;
          };
          // Prefer connected match by address
          if (address) {
            const byAddress = connectedAccountsRef.current.find(
              (a) => a.address === address,
            );
            if (byAddress)
              return { address: byAddress.address, name: byAddress.name };
          }
          // Fallback match by name if available
          if (name) {
            const byName = connectedAccountsRef.current.find(
              (a) => a.name === name,
            );
            if (byName) return { address: byName.address, name: byName.name };
          }
          // If not connected yet, still return stored selection for identity answers
          if (address || name) return { address, name };
        }
      } catch {
        // ignore
      }
    }
    // fallback to in-memory selection
    const mem = selectedAccountRef.current;
    if (mem) return { address: mem.address, name: mem.name };
    return undefined;
  };
  if (toolCall.toolName === "getBalances") {
    const input = toolCall.input as { address?: SS58String; network?: string };

    // Prefer the currently selected account from UI if present.
    // This ensures manual account switches are respected even if a stale address was passed.
    const activeAddress = resolveActiveSelection()?.address;
    const address = activeAddress ?? input.address;
    if (!address) {
      addToolResult({
        tool: toolCall.toolName,
        toolCallId: toolCall.toolCallId,
        output: "No account selected. Please connect a wallet first.",
      });
      return;
    }

    const balance = await getAccountBalance(address, apiRef, activeChainRef);

    addToolResult({
      tool: toolCall.toolName,
      toolCallId: toolCall.toolCallId,
      output: balance,
    });
  }

  if (toolCall.toolName === "getActiveNameAndBalance") {
    const active = resolveActiveSelection();

    if (!active?.address) {
      addToolResult({
        tool: toolCall.toolName,
        toolCallId: toolCall.toolCallId,
        output: "No account selected. Please connect a wallet first.",
      });
      return;
    }

    const balance = await getAccountBalance(
      active.address,
      apiRef,
      activeChainRef,
    );

    const text = `Name: ${active.name ?? "Unknown"}\nAddress: ${active.address}\nBalance: ${balance}`;
    addToolResult({
      tool: toolCall.toolName,
      toolCallId: toolCall.toolCallId,
      output: text,
    });
  }

  if (toolCall.toolName === "getConnectedAccounts") {
    const accounts = connectedAccountsRef.current.map((account) => ({
      name: account.name,
      address: account.address,
    }));

    addToolResult({
      tool: toolCall.toolName,
      toolCallId: toolCall.toolCallId,
      output: JSON.stringify(accounts),
    });
  }

  if (toolCall.toolName === "getActiveAccount") {
    const active = resolveActiveSelection();
    const text = active?.address
      ? `Name: ${active.name ?? "Unknown"}\nAddress: ${active.address}`
      : "No account selected. Please connect a wallet first.";

    addToolResult({
      tool: toolCall.toolName,
      toolCallId: toolCall.toolCallId,
      output: text,
    });
  }

  if (toolCall.toolName === "setActiveAccount") {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _account = toolCall.input as {
      address: SS58String | undefined;
      name: string;
    };

    // Safety: require explicit user instruction to switch; do not switch on corrections like "nope"
    addToolResult({
      tool: toolCall.toolName,
      toolCallId: toolCall.toolCallId,
      output:
        "Switching accounts requires explicit instruction. Ask the user to pick from the side tab or say: 'switch account to <address>'.",
    });
  }

  if (toolCall.toolName === "getAvailableNetworks") {
    const networks = chainConfig.map((chain) => chain.name);

    addToolResult({
      tool: toolCall.toolName,
      toolCallId: toolCall.toolCallId,
      output: JSON.stringify(networks),
    });
  }

  if (toolCall.toolName === "getActiveNetwork") {
    const network = activeChainRef.current.name;

    addToolResult({
      tool: toolCall.toolName,
      toolCallId: toolCall.toolCallId,
      output: network,
    });
  }

  if (toolCall.toolName === "setActiveNetwork") {
    const input = toolCall.input as {
      chain: string;
    };
    const network = chainConfig.find(
      (chain) => chain.name.toLowerCase() === input.chain.toLowerCase(),
    );
    if (input.chain === activeChainRef.current.name) {
      addToolResult({
        tool: toolCall.toolName,
        toolCallId: toolCall.toolCallId,
        output: `Network ${input.chain} is already active`,
      });
    }
    if (network) {
      setActiveChainRef.current(network);
      setActiveRpcChainRef.current(network);
      addToolResult({
        tool: toolCall.toolName,
        toolCallId: toolCall.toolCallId,
        output: `Set active network to ${network.name}`,
      });
    } else {
      addToolResult({
        tool: toolCall.toolName,
        toolCallId: toolCall.toolCallId,
        output: `Network ${input.chain} not found`,
      });
    }
  }

  if (toolCall.toolName === "getAvailableValidators") {
    const assetHub = chainConfig.find(
      (chain) => chain.key === `${activeChainRef.current.key}_asset_hub`,
    );

    let assetHubClient = null;
    if (assetHub) {
      const provider = getWsProvider(assetHub.endpoints);
      assetHubClient = createClient(provider);
    }

    const validators = await getSessionValidators({
      client: clientRef,
      assetHubClient: assetHubClient,
      activeChain: activeChainRef,
    });

    if (assetHubClient) {
      assetHubClient.destroy();
    }

    if ("error" in validators) {
      const errText =
        typeof validators.error === "string"
          ? validators.error
          : JSON.stringify(validators.error);
      addToolResult({
        tool: toolCall.toolName,
        toolCallId: toolCall.toolCallId,
        output: errText,
      });
      return;
    }

    const val_addrs = validators.map((validator) => {
      return {
        address: validator.address,
        staked: validator.staked,
      };
    });

    addToolResult({
      tool: toolCall.toolName,
      toolCallId: toolCall.toolCallId,
      output: JSON.stringify(val_addrs),
    });
  }

  if (toolCall.toolName === "getBondedAmountAgent") {
    const input = toolCall.input as { controllerAccount: SS58String };

    try {
      const descriptors = activeChainRef.current
        .descriptors as StakingDescriptors;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const api = clientRef.current!.getTypedApi(descriptors);

      const ledger = await api.query.Staking.Ledger.getValue(
        input.controllerAccount,
      );

      if (!ledger) {
        addToolResult({
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          output: `No bonded stake found for controller account ${input.controllerAccount}. This account may not be a controller for any staking account.`,
        });
        return;
      }

      const tokenDecimals =
        activeChainRef.current.chainSpec.properties.tokenDecimals;
      const tokenSymbol =
        activeChainRef.current.chainSpec.properties.tokenSymbol;
      const totalBonded = Number(ledger.total) / Math.pow(10, tokenDecimals);
      const activeBonded = Number(ledger.active) / Math.pow(10, tokenDecimals);
      const stashAccount = ledger.stash;

      addToolResult({
        tool: toolCall.toolName,
        toolCallId: toolCall.toolCallId,
        output: `Stash: ${stashAccount}\nTotal Bonded: ${totalBonded.toFixed(2)} ${tokenSymbol}\nActive Bonded: ${activeBonded.toFixed(2)} ${tokenSymbol}`,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      addToolResult({
        tool: toolCall.toolName,
        toolCallId: toolCall.toolCallId,
        output: `Failed to query bonded amount: ${errorMessage}`,
      });
    }
  }
}
