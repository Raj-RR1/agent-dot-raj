"use client";

import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useBlockNumber } from "@/hooks/use-block-number";
import { useLightClientApi } from "@/providers/light-client-provider";
import { WsEvent } from "polkadot-api/ws-provider/web";
import { useMemo, useState } from "react";
import { BiLoaderCircle } from "react-icons/bi";

export default function ChainBlockInfo() {
  const { connectionStatus, activeChain } = useLightClientApi();
  const [isOpen, setIsOpen] = useState(false);

  const blockNumber = useBlockNumber();

  const status: "connected" | "error" | "connecting" =
    connectionStatus?.type === WsEvent.CONNECTED && blockNumber
      ? "connected"
      : connectionStatus?.type === WsEvent.ERROR ||
          connectionStatus?.type === WsEvent.CLOSE
        ? "error"
        : "connecting";

  const Trigger = useMemo(
    function Trigger() {
      return (
        <div className="font-outfit h-6 cursor-pointer rounded-md px-2 text-sm font-light tabular-nums">
          {status === "connected" ? (
            <>
              <span className="mr-1 block h-2 w-2 animate-pulse rounded-full bg-green-500" />
            </>
          ) : status === "error" ? (
            <>
              <span className="block h-2 w-2 rounded-full bg-red-500" />
            </>
          ) : (
            <div className="flex h-6 items-center gap-1">
              <BiLoaderCircle className="h-4 w-4 animate-spin text-yellow-500" />
              <span className="text-xs">
                Connecting to {activeChain.name} via lightclient
              </span>
            </div>
          )}
          {status === "connected" && blockNumber && (
            <span className="text-xs">{`#${blockNumber.toString()}`}</span>
          )}
        </div>
      );
    },
    [status, activeChain, blockNumber],
  );

  return (
    <TooltipProvider>
      <Tooltip delayDuration={100} open={isOpen} onOpenChange={setIsOpen}>
        <TooltipTrigger
          asChild
          className="fixed right-4 bottom-0 flex items-center sm:bottom-4"
        >
          {Trigger}
        </TooltipTrigger>
      </Tooltip>
    </TooltipProvider>
  );
}
