import { describe, it, expect, beforeAll } from "vitest";
import { getBrandBySlug } from "../lib/db/queries/brands";
import {
  createCustomer,
  findCustomerByEmail,
  findCustomerById,
  verifyCustomerCredentials,
  updateCustomerProfile,
  addCustomerSavedAddress,
  deleteCustomerSavedAddress,
  getCustomerOrderHistory,
  cancelCustomerOrder,
  createPasswordResetToken,
  resetCustomerPasswordWithToken,
} from "../lib/db/queries/customers";
import {
  hashCustomerPassword,
  verifyCustomerPassword,
  generateCustomerToken,
  verifyCustomerToken,
} from "../lib/customer-auth";
import { createOrderWithStockDecrement } from "../lib/db/queries/orders";
import { getProductBySlug } from "../lib/db/queries/products";

describe("Customer Authentication & Order Management", () => {
  let brandA: any;
  let brandB: any;
  const testEmail = `testuser_${Date.now()}@example.com`;
  const testPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
  let customerAId: string;

  beforeAll(async () => {
    brandA = await getBrandBySlug("urban-streetwear");
    brandB = await getBrandBySlug("linen-and-co");
    expect(brandA).toBeDefined();
    expect(brandB).toBeDefined();
  });

  describe("1. Password Hashing and JWT Tokens", () => {
    it("hashes and verifies customer passwords accurately with bcrypt", async () => {
      const plain = "SecureSecret123!";
      const hash = await hashCustomerPassword(plain);

      expect(hash).not.toBe(plain);
      expect(hash.startsWith("$2")).toBe(true);

      const isValid = await verifyCustomerPassword(plain, hash);
      expect(isValid).toBe(true);

      const isInvalid = await verifyCustomerPassword("WrongPassword!", hash);
      expect(isInvalid).toBe(false);
    });

    it("generates and verifies customer JWT tokens scoped to brand", () => {
      const payload = {
        id: "cust_123",
        brandId: brandA.id,
        email: "customer@brand-a.com",
        name: "Test Customer",
      };

      const token = generateCustomerToken(payload);
      expect(typeof token).toBe("string");

      const decoded = verifyCustomerToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded?.customerId).toBe(payload.id);
      expect(decoded?.brandId).toBe(brandA.id);
      expect(decoded?.email).toBe(payload.email);

      // Verify tampered token returns null
      const tampered = token + "xyz";
      expect(verifyCustomerToken(tampered)).toBeNull();
    });
  });

  describe("2. Customer Registration & Multi-Tenant Isolation", () => {
    it("registers a new customer under brand A", async () => {
      const customer = await createCustomer(brandA.id, {
        name: "Rahul Verma",
        email: testEmail,
        password: "MyPassword456!",
        phone: testPhone,
      });

      expect(customer).toBeDefined();
      expect(customer.id).toBeDefined();
      expect(customer.brandId).toBe(brandA.id);
      expect(customer.email).toBe(testEmail.toLowerCase().trim());
      expect(customer.name).toBe("Rahul Verma");
      expect(customer.phone).toBe(testPhone);

      customerAId = customer.id;
    });

    it("verifies credentials for newly registered customer", async () => {
      const authSuccess = await verifyCustomerCredentials(
        brandA.id,
        testEmail,
        "MyPassword456!"
      );
      expect(authSuccess).not.toBeNull();
      expect(authSuccess?.id).toBe(customerAId);

      const authFail = await verifyCustomerCredentials(
        brandA.id,
        testEmail,
        "IncorrectPassword"
      );
      expect(authFail).toBeNull();
    });

    it("rejects duplicate registration with identical email under the same brand", async () => {
      await expect(
        createCustomer(brandA.id, {
          name: "Duplicate User",
          email: testEmail,
          password: "AnotherPassword123!",
        })
      ).rejects.toThrow(/already exists/i);
    });

    it("allows the same email to register under a DIFFERENT brand (tenant isolation)", async () => {
      const customerB = await createCustomer(brandB.id, {
        name: "Rahul Verma (Linen)",
        email: testEmail,
        password: "LinenPassword789!",
        phone: testPhone,
      });

      expect(customerB).toBeDefined();
      expect(customerB.brandId).toBe(brandB.id);
      expect(customerB.id).not.toBe(customerAId);

      // Verify each brand verifies with their own respective password
      const authBrandB = await verifyCustomerCredentials(
        brandB.id,
        testEmail,
        "LinenPassword789!"
      );
      expect(authBrandB).not.toBeNull();
      expect(authBrandB?.brandId).toBe(brandB.id);

      // Incorrect password across tenants
      const crossAuth = await verifyCustomerCredentials(
        brandA.id,
        testEmail,
        "LinenPassword789!"
      );
      expect(crossAuth).toBeNull();
    });
  });

  describe("3. Profile & Saved Delivery Addresses", () => {
    it("updates customer profile name and phone", async () => {
      const updated = await updateCustomerProfile(brandA.id, customerAId, {
        name: "Rahul V. Sharma",
        phone: "9988776655",
      });

      expect(updated.name).toBe("Rahul V. Sharma");
      expect(updated.phone).toBe("9988776655");

      const fetched = await findCustomerById(brandA.id, customerAId);
      expect(fetched?.name).toBe("Rahul V. Sharma");
    });

    it("adds saved delivery addresses and manages default address", async () => {
      // Add first address (should be default)
      const addresses1 = await addCustomerSavedAddress(brandA.id, customerAId, {
        name: "Rahul (Home)",
        phone: "9988776655",
        line1: "Flat 204, Pine Heights",
        line2: "Green Glen Layout, Bellandur",
        city: "Bengaluru",
        state: "Karnataka",
        pincode: "560103",
        isDefault: true,
      });

      expect(addresses1.length).toBe(1);
      expect(addresses1[0].line1).toBe("Flat 204, Pine Heights");
      expect(addresses1[0].isDefault).toBe(true);
      const addr1Id = addresses1[0].id;

      // Add second address with isDefault: true (should unset first address default)
      const addresses2 = await addCustomerSavedAddress(brandA.id, customerAId, {
        name: "Rahul (Work)",
        phone: "9988776655",
        line1: "Embassy TechVillage, Tower 3",
        city: "Bengaluru",
        state: "Karnataka",
        pincode: "560103",
        isDefault: true,
      });

      expect(addresses2.length).toBe(2);
      const first = addresses2.find((a) => a.id === addr1Id);
      const second = addresses2.find((a) => a.name === "Rahul (Work)");
      expect(first?.isDefault).toBe(false);
      expect(second?.isDefault).toBe(true);

      // Delete the first address
      const addresses3 = await deleteCustomerSavedAddress(brandA.id, customerAId, addr1Id);
      expect(addresses3.length).toBe(1);
      expect(addresses3[0].name).toBe("Rahul (Work)");
    });
  });

  describe("4. Order History and Self-Service Cancellation", () => {
    let placedOrderId: string;

    it("fetches orders linked to customer phone or email", async () => {
      const product = await getProductBySlug(brandA.id, "heavyweight-boxy-tee-380gsm");
      expect(product).toBeDefined();
      const variant = product!.variants[0];

      // Place an order using the customer's phone and email
      const result = await createOrderWithStockDecrement({
        brand: brandA,
        customerName: "Rahul V. Sharma",
        customerPhone: "9988776655",
        deliveryAddress: {
          street: "Embassy TechVillage, Tower 3",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560103",
          email: testEmail,
        },
        items: [
          {
            variantId: variant.id,
            productId: product!.id,
            title: product!.title,
            sku: variant.sku,
            qty: 1,
            unitPricePaise: variant.pricePaise,
          },
        ],
        shippingPaise: 0,
        paymentMethod: "UPI",
      });

      expect(result.order).toBeDefined();
      expect(result.order.id).toBeDefined();
      expect(result.order.status).toBe("RECEIVED");
      placedOrderId = result.order.id;

      // Query order history
      const orderHistory = await getCustomerOrderHistory(
        brandA.id,
        "9988776655",
        testEmail
      );
      expect(orderHistory.length).toBeGreaterThanOrEqual(1);
      const matched = orderHistory.find((o) => o.id === placedOrderId);
      expect(matched).toBeDefined();
      expect(matched?.customerPhone).toBe("9988776655");
    });

    it("allows customer to cancel an order in RECEIVED status", async () => {
      const cancelled = await cancelCustomerOrder(
        brandA.id,
        placedOrderId,
        "9988776655",
        testEmail
      );

      expect(cancelled.id).toBe(placedOrderId);
      expect(cancelled.status).toBe("CANCELLED");

      // Verify in history that status is CANCELLED
      const orderHistory = await getCustomerOrderHistory(
        brandA.id,
        "9988776655",
        testEmail
      );
      const found = orderHistory.find((o) => o.id === placedOrderId);
      expect(found?.status).toBe("CANCELLED");
    });

    it("blocks cancellation of an already cancelled or dispatched order", async () => {
      await expect(
        cancelCustomerOrder(brandA.id, placedOrderId, "9988776655", testEmail)
      ).rejects.toThrow(/cannot be cancelled because it is already cancelled/i);
    });
  });

  describe("5. Password Reset Flow", () => {
    it("generates a 6-digit reset token and resets password successfully", async () => {
      const { token } = await createPasswordResetToken(brandA.id, testEmail);
      expect(token).toBeDefined();
      expect(token.length).toBe(6);

      // Reset password using the code
      const updatedCust = await resetCustomerPasswordWithToken(
        brandA.id,
        testEmail,
        token,
        "BrandNewPassword999!"
      );
      expect(updatedCust).toBeDefined();

      // Verify sign in with the new password
      const newAuth = await verifyCustomerCredentials(
        brandA.id,
        testEmail,
        "BrandNewPassword999!"
      );
      expect(newAuth).not.toBeNull();
      expect(newAuth?.id).toBe(customerAId);

      // Verify old password no longer works
      const oldAuth = await verifyCustomerCredentials(
        brandA.id,
        testEmail,
        "MyPassword456!"
      );
      expect(oldAuth).toBeNull();
    });

    it("rejects password reset with invalid code", async () => {
      await expect(
        resetCustomerPasswordWithToken(
          brandA.id,
          testEmail,
          "000000",
          "ShouldFailPassword123!"
        )
      ).rejects.toThrow(/invalid reset code/i);
    });
  });
});
