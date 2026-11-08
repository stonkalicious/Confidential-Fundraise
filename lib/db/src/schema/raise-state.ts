import { createInsertSchema } from "drizzle-zod";
import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const raiseStateTable = pgTable("raise_state", {
  id: text("id").primaryKey(),
  position: integer("position").notNull(),
  state: jsonb("state").$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertRaiseStateSchema = createInsertSchema(raiseStateTable).omit({
  updatedAt: true,
});

export type InsertRaiseState = z.infer<typeof insertRaiseStateSchema>;
export type RaiseState = typeof raiseStateTable.$inferSelect;
