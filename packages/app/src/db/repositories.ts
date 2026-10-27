import type {
  Category,
  Product,
  ProductVariant,
  Customer,
  Employee,
  StockMovement,
  Invoice,
} from "@auxo/core";
import { SqliteRepository } from "./sqliteRepository.js";
import { SqliteKeyValueStore } from "./sqliteKv.js";

/**
 * One repository per entity, plus the settings KV store. Created lazily
 * (not at module load) so nothing touches the database before
 * initDatabase() has run.
 */
export interface Repositories {
  categories: SqliteRepository<Category>;
  products: SqliteRepository<Product>;
  productVariants: SqliteRepository<ProductVariant>;
  customers: SqliteRepository<Customer>;
  employees: SqliteRepository<Employee>;
  stockMovements: SqliteRepository<StockMovement>;
  invoices: SqliteRepository<Invoice>;
  settings: SqliteKeyValueStore;
}

let repositories: Repositories | null = null;

export function getRepositories(): Repositories {
  repositories ??= {
    categories: new SqliteRepository<Category>("category"),
    products: new SqliteRepository<Product>("product"),
    productVariants: new SqliteRepository<ProductVariant>("product_variant"),
    customers: new SqliteRepository<Customer>("customer"),
    employees: new SqliteRepository<Employee>("employee"),
    stockMovements: new SqliteRepository<StockMovement>("stock_movement"),
    invoices: new SqliteRepository<Invoice>("invoice"),
    settings: new SqliteKeyValueStore(),
  };
  return repositories;
}
