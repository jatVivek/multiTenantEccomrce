import type { Brand, AdminUser } from "../db/schema";

export type AppEnv = {
  Variables: {
    brand: Brand;
    admin?: AdminUser;
  };
};

export type AdminEnv = {
  Variables: {
    admin: AdminUser;
  };
};
