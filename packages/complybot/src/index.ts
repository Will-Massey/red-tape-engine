import { eq, sum } from 'drizzle-orm';
import { db, schema, categoriseReceipt, logUsage } from '@rte/core';

type ExpenseRow = typeof schema.expenses.$inferSelect;

export async function processReceipt(input: {
  tenantId: string;
  filename: string;
  rawText: string;
}) {
  const categorised = await categoriseReceipt({
    rawText: input.rawText,
    filename: input.filename,
  });

  const [expense] = await db
    .insert(schema.expenses)
    .values({
      tenantId: input.tenantId,
      vendor: categorised.vendor,
      amountPence: categorised.amountPence,
      date: categorised.date,
      category: categorised.category,
      mtdBox: categorised.mtdBox,
      confidence: categorised.confidence,
      rawText: input.rawText,
    })
    .returning();

  await logUsage({
    tenantId: input.tenantId,
    vertical: 'complybot',
    action: 'receipt_categorised',
    metadata: { category: categorised.category, amountPence: categorised.amountPence },
  });

  return { expense, categorised };
}

export async function getExpenses(tenantId: string) {
  const rows = await db
    .select()
    .from(schema.expenses)
    .where(eq(schema.expenses.tenantId, tenantId));

  const [totals] = await db
    .select({ total: sum(schema.expenses.amountPence) })
    .from(schema.expenses)
    .where(eq(schema.expenses.tenantId, tenantId));

  const byCategory = rows.reduce<Record<string, number>>((acc: Record<string, number>, row: ExpenseRow) => {
    acc[row.category] = (acc[row.category] ?? 0) + row.amountPence;
    return acc;
  }, {});

  return {
    expenses: rows,
    totalPence: Number(totals?.total ?? 0),
    totalGbp: (Number(totals?.total ?? 0) / 100).toFixed(2),
    byCategory,
    mtdExportReady: rows.length > 0,
  };
}

export function generateMtdExportPack(tenantId: string, expenses: Awaited<ReturnType<typeof getExpenses>>) {
  const lines = [
    `MTD EXPORT PACK — Tenant ${tenantId}`,
    `Generated: ${new Date().toISOString()}`,
    `Total: £${expenses.totalGbp}`,
    ``,
    `Date,Vendor,Category,MTD Box,Amount`,
    ...expenses.expenses.map(
      (e: ExpenseRow) =>
        `${e.date},${e.vendor},${e.category},${e.mtdBox},£${(e.amountPence / 100).toFixed(2)}`,
    ),
  ];
  return lines.join('\n');
}