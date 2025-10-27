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
  assetHubClientRef,
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
  assetHubClientRef: ClientRef;
  setActiveRpcChainRef: SetActiveRpcChainRef;
  toolCall: {
    toolName: string;
    toolCallId: string;
    input: unknown;
  };
  addToolResult: UseChatHelpers<UIMessage>["addToolResult"];
}) {
  if (toolCall.toolName === "getBalances") {
    const account = toolCall.input as { address: SS58String };
    const balance = await getAccountBalance(
      account.address,
      apiRef,
      activeChainRef,
    );

    addToolResult({
      tool: toolCall.toolName,
      toolCallId: toolCall.toolCallId,
      output: balance,
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
    const active = selectedAccountRef.current;

    addToolResult({
      tool: toolCall.toolName,
      toolCallId: toolCall.toolCallId,
      output: JSON.stringify({
        name: active?.name,
        address: active?.address,
      }),
    });
  }

  if (toolCall.toolName === "setActiveAccount") {
    const account = toolCall.input as {
      address: SS58String | undefined;
      name: string;
    };

    // Find account in connected accounts
    const foundAccount = connectedAccountsRef.current.find(
      (acc) => acc.address === account.address,
    );

    if (foundAccount) {
      setSelectedAccountRef.current(foundAccount);
      addToolResult({
        tool: toolCall.toolName,
        toolCallId: toolCall.toolCallId,
        output: {
          success: true,
          message: `Set active account to ${account.name}`,
        },
      });
    } else {
      addToolResult({
        tool: toolCall.toolName,
        toolCallId: toolCall.toolCallId,
        output: {
          success: false,
          message: `Account ${account.name} not found`,
        },
      });
    }
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
        output: {
          success: false,
          message: `Network ${input.chain} is already active`,
        },
      });
    }
    if (network) {
      setActiveChainRef.current(network);
      setActiveRpcChainRef.current(network);
      addToolResult({
        tool: toolCall.toolName,
        toolCallId: toolCall.toolCallId,
        output: {
          success: true,
          message: `Set active network to ${network.name}`,
        },
      });
    } else {
      addToolResult({
        tool: toolCall.toolName,
        toolCallId: toolCall.toolCallId,
        output: {
          success: false,
          message: `Network ${input.chain} not found`,
        },
      });
    }
  }

  if (toolCall.toolName === "getAvailableValidators") {
    const validators = await getSessionValidators({
      client: clientRef,
      assetHubClient: assetHubClientRef,
      activeChain: activeChainRef,
    });

    if ("error" in validators) {
      addToolResult({
        tool: toolCall.toolName,
        toolCallId: toolCall.toolCallId,
        output: { error: validators.error },
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
          output: {
            error: `No bonded stake found for controller account ${input.controllerAccount}. This account may not be a controller for any staking account.`,
          },
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
        output: {
          stashAccount,
          totalBonded: `${totalBonded.toFixed(2)} ${tokenSymbol}`,
          activeBonded: `${activeBonded.toFixed(2)} ${tokenSymbol}`,
          tokenSymbol,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      addToolResult({
        tool: toolCall.toolName,
        toolCallId: toolCall.toolCallId,
        output: { error: `Failed to query bonded amount: ${errorMessage}` },
      });
    }
  }
}
