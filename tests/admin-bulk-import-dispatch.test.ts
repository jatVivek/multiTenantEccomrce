import { describe, it, expect, beforeAll } from "vitest";
import { db } from "../lib/db";
import { brands, products, productVariants, importBatches, orders } from "../src/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import {
  importProductsCsv,
  undoImportBatch,
  getImportBatches,
  updateOrderFulfillmentAdmin,
  getBrandOrdersFulfillmentAdmin,
  type CsvProductRow,
} from "../lib/db/queries/admin";

describe("Phase 7: Bulk CSV Importer & Order Dispatch Desk Suite", () => {
  let brand1: any;
  let brand2: any;
  let testOrderId: string;

  beforeAll(async () => {
    const [b1] = await db
      .select()
      .from(brands)
      .where(eq(brands.slug, "urban-streetwear"));
    const [b2] = await db
      .select()
      .from(brands)
      .where(eq(brands.slug, "linen-and-co"));

    expect(b1).toBeDefined();
    expect(b2).toBeDefined();
    brand1 = b1;
    brand2 = b2;

    // Create a test order for fulfillment tests
    const [newOrder] = await db
      .insert(orders)
      .values({
        brandId: brand1.id,
        orderNumber: Math.floor(Date.now() / 1000) + 7000,
        customerName: "Fulfillment Customer",
        customerPhone: "9812345678",
        deliveryAddress: {
          fullName: "Fulfillment Customer",
          addressLine1: "456 Logistic Hub",
          city: "Bengaluru",
          state: "KA",
          postalCode: "560001",
        },
        items: [
          {
            title: "Heavyweight Boxy Tee",
            size: "L",
            quantity: 2,
            pricePaise: 199900,
          },
        ],
        subtotalPaise: 399800,
        shippingPaise: 0,
        totalAmountPaise: 399800,
        paymentMethod: "COD",
        paymentStatus: "PENDING",
        status: "RECEIVED",
        idempotencyKey: `dispatch-${Date.now()}`,
      })
      .returning();
    testOrderId = newOrder.id;
  });

  describe("Bulk CSV Importer & Rollback Engine", () => {
    it("Dry-Run: accurately detects invalid rows without committing to database", async () => {
      const mockCsvRows: CsvProductRow[] = [
        {
          title: "Valid Tee 1",
          slug: `dry-tee-1-${Date.now()}`,
          category: "T-Shirts",
          base_price: 1499,
          sku: `DRY-SKU-1-${Date.now()}`,
          stock_quantity: 20,
        },
        {
          title: "Invalid Price Tee",
          base_price: -50, // Invalid: negative price
          sku: `DRY-SKU-ERR-1-${Date.now()}`,
          stock_quantity: 10,
        },
        {
          title: "Valid Tee 2",
          slug: `dry-tee-2-${Date.now()}`,
          category: "T-Shirts",
          base_price: 1999,
          sku: `DRY-SKU-2-${Date.now()}`,
          stock_quantity: 15,
        },
        {
          title: "Missing SKU Tee",
          base_price: 999,
          sku: "", // Invalid: missing SKU
          stock_quantity: 5,
        },
      ];

      const dryResult = await importProductsCsv(brand1.id, mockCsvRows, {
        dryRun: true,
        filename: "test_dry_run.csv",
      });

      expect(dryResult.dryRun).toBe(true);
      expect(dryResult.totalRows).toBe(4);
      expect(dryResult.importedCount).toBe(2);
      expect(dryResult.failedCount).toBe(2);
      expect(dryResult.errors.length).toBe(2);
      expect(dryResult.errors[0].row).toBe(2);
      expect(dryResult.errors[1].row).toBe(4);

      // Verify ZERO records were inserted into DB
      const [check] = await db
        .select()
        .from(products)
        .where(eq(products.slug, mockCsvRows[0].slug!));
      expect(check).toBeUndefined();
    });

    it("Execute Import: imports valid rows and records batch tracking", async () => {
      const timestamp = Date.now();
      const mockCsvRows: CsvProductRow[] = [
        {
          title: "Batch Imported Oversized Tee",
          slug: `batch-tee-1-${timestamp}`,
          category: "T-Shirts",
          base_price: 1799,
          sku: `BATCH-SKU-1-${timestamp}`,
          size: "M",
          stock_quantity: 25,
        },
        {
          title: "Batch Imported Oversized Tee",
          slug: `batch-tee-1-${timestamp}`,
          category: "T-Shirts",
          base_price: 1799,
          sku: `BATCH-SKU-2-${timestamp}`,
          size: "L",
          stock_quantity: 35,
        },
      ];

      const result = await importProductsCsv(brand1.id, mockCsvRows, {
        dryRun: false,
        filename: "summer_collection.csv",
      });

      expect(result.dryRun).toBe(false);
      expect(result.batchId).toBeDefined();
      expect(result.totalRows).toBe(2);
      expect(result.importedCount).toBe(2);
      expect(result.failedCount).toBe(0);

      // Verify batch in import_batches table
      const [batchRec] = await db
        .select()
        .from(importBatches)
        .where(eq(importBatches.id, result.batchId!));
      expect(batchRec).toBeDefined();
      expect(batchRec.status).toBe("COMPLETED");

      // Verify product and variants in database
      const [prod] = await db
        .select()
        .from(products)
        .where(
          and(
            eq(products.slug, `batch-tee-1-${timestamp}`),
            eq(products.brandId, brand1.id)
          )
        );
      expect(prod).toBeDefined();
      expect(prod.importBatchId).toBe(result.batchId);

      const variants = await db
        .select()
        .from(productVariants)
        .where(eq(productVariants.productId, prod.id));
      expect(variants.length).toBe(2);

      // Test Undo Import
      const undoRes = await undoImportBatch(brand1.id, result.batchId!);
      expect(undoRes.success).toBe(true);
      expect(undoRes.deletedCount).toBe(1);

      // Verify product and variants are gone
      const [deletedCheck] = await db
        .select()
        .from(products)
        .where(eq(products.id, prod.id));
      expect(deletedCheck).toBeUndefined();

      const [variantsCheck] = await db
        .select()
        .from(productVariants)
        .where(eq(productVariants.productId, prod.id));
      expect(variantsCheck).toBeUndefined();

      // Verify batch marked as REVERTED
      const [revertedBatch] = await db
        .select()
        .from(importBatches)
        .where(eq(importBatches.id, result.batchId!));
      expect(revertedBatch.status).toBe("REVERTED");
    });

    it(
      "Acceptance Criterion: 1,000-row batch with 10 invalid rows reports exactly 10 errors, imports 990, and undo removes them",
      async () => {
      const timestamp = Date.now();
      const largeRows: CsvProductRow[] = [];
      const invalidIndices = new Set([10, 50, 100, 200, 300, 400, 500, 600, 700, 800]);

      for (let i = 1; i <= 1000; i++) {
        if (invalidIndices.has(i)) {
          // Invalid row: missing SKU or negative price
          largeRows.push({
            title: `Product ${i}`,
            base_price: -100, // Invalid
            sku: "", // Invalid
            stock_quantity: -5,
          });
        } else {
          largeRows.push({
            title: `Stress Import Product ${i}`,
            slug: `stress-prod-${i}-${timestamp}`,
            category: "Apparel",
            base_price: 1999,
            sku: `STRESS-SKU-${i}-${timestamp}`,
            stock_quantity: 10,
          });
        }
      }

      // 1. Dry run check
      const dryCheck = await importProductsCsv(brand1.id, largeRows, {
        dryRun: true,
      });
      expect(dryCheck.totalRows).toBe(1000);
      expect(dryCheck.failedCount).toBe(10);
      expect(dryCheck.importedCount).toBe(990);
      expect(dryCheck.errors.length).toBe(10);

      // 2. Real import
      const execResult = await importProductsCsv(brand1.id, largeRows, {
        dryRun: false,
        filename: "large_catalog_test.csv",
      });
      expect(execResult.totalRows).toBe(1000);
      expect(execResult.failedCount).toBe(10);
      expect(execResult.importedCount).toBe(990);
      expect(execResult.batchId).toBeDefined();

      // 3. Undo import removes all 990 products cleanly
      const undoResult = await undoImportBatch(brand1.id, execResult.batchId!);
      expect(undoResult.success).toBe(true);
      expect(undoResult.deletedCount).toBe(990);
    }, 30000);

    it("Tenant Isolation: Brand 2 cannot undo or access an import batch belonging to Brand 1", async () => {
      const timestamp = Date.now();
      const res = await importProductsCsv(
        brand1.id,
        [
          {
            title: "Tenant Test Tee",
            slug: `tenant-iso-${timestamp}`,
            base_price: 999,
            sku: `ISO-SKU-${timestamp}`,
            stock_quantity: 5,
          },
        ],
        { dryRun: false }
      );

      // Attempting to undo Brand 1's batch using Brand 2's id must be rejected
      await expect(undoImportBatch(brand2.id, res.batchId!)).rejects.toThrow(
        /Import batch not found or unauthorized/
      );

      // Clean up using Brand 1
      await undoImportBatch(brand1.id, res.batchId!);
    });
  });

  describe("Order Dispatch Desk & Fulfillment Workflow", () => {
    it("fetches orders for fulfillment scoped by brand", async () => {
      const ordersList = await getBrandOrdersFulfillmentAdmin(brand1.id, "ALL");
      expect(ordersList.length).toBeGreaterThan(0);
      const found = ordersList.find((o) => o.id === testOrderId);
      expect(found).toBeDefined();
    });

    it("updates order fulfillment: courier and tracking number assignment", async () => {
      const updated = await updateOrderFulfillmentAdmin(brand1.id, testOrderId, {
        status: "PACKED",
        courier: "Delhivery",
        trackingId: "DEL987654321",
      });

      expect(updated.id).toBe(testOrderId);
      expect(updated.status).toBe("PACKED");
      expect(updated.courier).toBe("Delhivery");
      expect(updated.trackingId).toBe("DEL987654321");
    });

    it("advances fulfillment state to DISPATCHED", async () => {
      const updated = await updateOrderFulfillmentAdmin(brand1.id, testOrderId, {
        status: "DISPATCHED",
      });

      expect(updated.id).toBe(testOrderId);
      expect(updated.status).toBe("DISPATCHED");
      expect(updated.courier).toBe("Delhivery");
      expect(updated.trackingId).toBe("DEL987654321");
    });

    it("Tenant Isolation: Brand 2 cannot update fulfillment of Brand 1 order", async () => {
      await expect(
        updateOrderFulfillmentAdmin(brand2.id, testOrderId, {
          status: "DELIVERED",
        })
      ).rejects.toThrow(/Order not found or unauthorized brand modification/);
    });
  });
});
