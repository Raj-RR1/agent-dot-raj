/* eslint-disable @typescript-eslint/ban-ts-comment -- TypeScript compiler shows errors but ESLint parser doesn't, so we use @ts-ignore */
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Zod schema returns any for transaction arrays */
import { tool } from "ai";
import z from "zod";

// Transaction type schemas
const transferTransactionSchema = z.object({
  type: z.literal("transfer"),
  to: z.string().describe("SS58-encoded recipient address"),
  amount: z.number().describe("Amount of tokens to transfer"),
});

const bondTransactionSchema = z.object({
  type: z.literal("bond"),
  amount: z.number().describe("Amount to bond"),
  payee: z
    .object({
      type: z.enum(["Staked", "Stash", "Controller", "Account", "None"]),
      value: z.string().optional(),
    })
    .describe("Reward destination"),
});

const unbondTransactionSchema = z.object({
  type: z.literal("unbond"),
  amount: z.number().describe("Amount to unbond"),
});

const bondExtraTransactionSchema = z.object({
  type: z.literal("bondExtra"),
  amount: z.number().describe("Additional amount to bond"),
});

const nominateTransactionSchema = z.object({
  type: z.literal("nominate"),
  targets: z
    .array(z.string())
    .min(1)
    .describe("Array of validator addresses to nominate"),
});

const joinPoolTransactionSchema = z.object({
  type: z.literal("joinPool"),
  poolId: z.number().int().min(1).describe("Nomination pool ID"),
  amount: z.number().describe("Amount to bond to the pool"),
});

const bondExtraPoolTransactionSchema = z.object({
  type: z.literal("bondExtraPool"),
  amount: z
    .number()
    .optional()
    .describe("Amount to bond extra (if type is FreeBalance)"),
  extraType: z
    .enum(["FreeBalance", "Rewards"])
    .describe(
      "Type of bond extra: FreeBalance for additional tokens, Rewards for restaking rewards",
    ),
});

const unbondPoolTransactionSchema = z.object({
  type: z.literal("unbondPool"),
  amount: z.number().describe("Amount to unbond from pool"),
});

const xcmTransactionSchema = z.object({
  type: z.literal("xcm"),
  src: z.string().describe("The source chain name"),
  dst: z.string().describe("The destination chain name"),
  recipient: z.string().describe("The recipient's SS58 address"),
  amount: z.number().describe("The amount of tokens to teleport"),
  symbol: z.string().describe("The token symbol (e.g., PAS, WND, DOT)"),
});

// Union of all transaction types
const transactionSchema = z.discriminatedUnion("type", [
  transferTransactionSchema,
  bondTransactionSchema,
  unbondTransactionSchema,
  bondExtraTransactionSchema,
  nominateTransactionSchema,
  joinPoolTransactionSchema,
  bondExtraPoolTransactionSchema,
  unbondPoolTransactionSchema,
  xcmTransactionSchema,
]);

export const batchAgent = tool({
  name: "batchAgent",
  description:
    "**MUST USE THIS TOOL when user requests multiple actions in one message AND says 'batch' (but NOT 'batchAll')** (e.g., 'transfer X and bond Y, batch them', 'send A to B and bond extra C'). Batch multiple transactions together using the Utility pallet's batch function. This allows executing multiple transactions in a single call. If one transaction fails, the others will still execute. Use this when the user wants to perform multiple actions together but can tolerate partial failures. **CRITICAL: If the user says 'batchAll' or 'batch all', you MUST use batchAllAgent instead, NOT this tool.** **NEVER call individual tools (transferAgent, bondAgent, xcmAgent, etc.) when multiple actions are requested together** - always use batchAgent (when user says 'batch') or batchAllAgent (when user says 'batchAll'). Supported transaction types: transfer, bond, unbond, bondExtra, nominate, joinPool, bondExtraPool, unbondPool, xcm (teleport). MANDATORY: Ask for explicit confirmation ('yes') before calling this tool.",
  // @ts-ignore - tool function overload issue with inline schemas
  inputSchema: z.object({
    transactions: z
      .array(transactionSchema)
      .min(1)
      .max(50)
      .describe("Array of transactions to batch together"),
    network: z
      .string()
      .optional()
      .describe(
        "The network/chain name. If not provided, uses the active network.",
      ),
  }),
  // @ts-ignore - tool function overload issue with inline schemas
  outputSchema: z.object({
    tx: z
      .object({
        transactionCount: z.number(),
        transactions: z.array(z.any()),
      })
      .optional(),
    message: z.string().optional(),
  }),
  // @ts-ignore - tool function overload issue with inline schemas
  // eslint-disable-next-line @typescript-eslint/require-await
  execute: async (input) => {
    const { transactions } = input;
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const transactionCount = transactions.length;
      return {
        tx: {
          transactionCount,
          transactions,
        },
        message: `Batch transaction prepared with ${String(transactionCount)} transaction(s). Sign and submit to execute all transactions. Note: If one transaction fails, others will still execute.`,
      };
    } catch (error: unknown) {
      const err = error as Error;
      return {
        message: `Failed to prepare batch transaction: ${err.message}`,
      };
    }
  },
});

export const batchAllAgent = tool({
  name: "batchAllAgent",
  description:
    "**MUST USE THIS TOOL when user requests multiple actions in one message AND explicitly says 'batchAll', 'batch all', 'batchAll them', 'use batchAll', or ANY variation containing 'batchAll'** (e.g., 'teleport X to Chain1 and teleport Y to Chain2, batchAll them', 'transfer X and bond Y, batchAll them'). Batch multiple transactions together using the Utility pallet's batch_all function. This allows executing multiple transactions in a single call. If ANY transaction fails, ALL transactions will be rolled back (atomic). Use this when the user wants to ensure all transactions succeed or none do. **CRITICAL: When user explicitly says 'batchAll' in any form, you MUST use this tool (batchAllAgent), NOT batchAgent. If user only says 'batch' (without 'All'), use batchAgent instead.** **NEVER call individual tools (transferAgent, bondAgent, xcmAgent, etc.) when multiple actions are requested together** - always use batchAllAgent when user says 'batchAll', or batchAgent when user says 'batch'. Supported transaction types: transfer, bond, unbond, bondExtra, nominate, joinPool, bondExtraPool, unbondPool, xcm (teleport). MANDATORY: Ask for explicit confirmation ('yes') before calling this tool.",
  // @ts-ignore - tool function overload issue with inline schemas
  inputSchema: z.object({
    transactions: z
      .array(transactionSchema)
      .min(1)
      .max(50)
      .describe("Array of transactions to batch together atomically"),
    network: z
      .string()
      .optional()
      .describe(
        "The network/chain name. If not provided, uses the active network.",
      ),
  }),
  // @ts-ignore - tool function overload issue with inline schemas
  outputSchema: z.object({
    tx: z
      .object({
        transactionCount: z.number(),
        transactions: z.array(z.any()),
      })
      .optional(),
    message: z.string().optional(),
  }),
  // @ts-ignore - tool function overload issue with inline schemas
  // eslint-disable-next-line @typescript-eslint/require-await
  execute: async (input) => {
    const { transactions } = input;
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const transactionCount = transactions.length;
      return {
        tx: {
          transactionCount,
          transactions,
        },
        message: `BatchAll transaction prepared with ${String(transactionCount)} transaction(s). Sign and submit to execute all transactions atomically. Note: If any transaction fails, all will be rolled back.`,
      };
    } catch (error: unknown) {
      const err = error as Error;
      return {
        message: `Failed to prepare batchAll transaction: ${err.message}`,
      };
    }
  },
});
