import { validateShop, type ShopIdentity } from '../domain/shop';
import type {AuditWrite} from '../domain/audit';
export interface ShopStorage {
  load(): Promise<ShopIdentity | null>;
  save(shop: ShopIdentity,audit?:AuditWrite): Promise<void>;
}
export class ShopService {
  constructor(private readonly storage: ShopStorage) {}
  load() { return this.storage.load(); }
  async save(input: ShopIdentity): Promise<ShopIdentity> {
    const shop = validateShop(input);
    await this.storage.save(shop);
    return shop;
  }
}
