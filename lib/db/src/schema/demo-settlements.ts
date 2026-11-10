import { createInsertSchema } from "drizzle-zod";
import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { raiseStateTable } from "./raise-state";

// Separate from commitment amounts/status: a demo payment never funds a raise.
export const demoSettlementsTable = pgTable("demo_settlements", {
  id: uuid("id").primaryKey().defaultRandom(),
  raiseId: text("raise_id").notNull().references(() => raiseStateTable.id, { onDelete: "cascade" }),
  commitmentId: text("commitment_id").notNull(),
  network: text("network").notNull(),
  receiverAccount: text("receiver_account").notNull(),
  reference: text("reference"),
  investorLinkTokenHash: text("investor_link_token_hash"),
  investorLinkExpiresAt: timestamp("investor_link_expires_at", { withTimezone: true }),
  sponsorConfirmedAt: timestamp("sponsor_confirmed_at", { withTimezone: true }).notNull(),
  investorConfirmedAt: timestamp("investor_confirmed_at", { withTimezone: true }),
  signerAccount: text("signer_account"),
  preparedAt: timestamp("prepared_at", { withTimezone: true }),
  transferMemo: text("transfer_memo"),
  transactionHash: text("transaction_hash"),
}, (table) => [
  uniqueIndex("demo_settlements_commitment").on(table.raiseId, table.commitmentId),
  uniqueIndex("demo_settlements_transaction").on(table.network, table.transactionHash),
]);

export const insertDemoSettlementSchema = createInsertSchema(demoSettlementsTable);
export type InsertDemoSettlement = z.infer<typeof insertDemoSettlementSchema>;
export type DemoSettlementRecord = typeof demoSettlementsTable.$inferSelect;
