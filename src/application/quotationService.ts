import type { AuthService } from './authService';
import type { QuotationCart, QuotationRecord } from '../domain/quotations';
import { localDateKey, quotationValidUntil } from '../domain/quotations';
import type { InvoiceRecord } from '../domain/billing';
import type { AuditWrite } from '../domain/audit';

export interface QuotationStorage {
  listQuotations(): Promise<QuotationRecord[]>;
  saveQuotation(cart: QuotationCart, totalPaise: string, validUntil: string, audit?: (quote: QuotationRecord) => AuditWrite): Promise<QuotationRecord>;
  getQuotation(id: string): Promise<QuotationRecord | null>;
  deleteQuotation(id: string, audit?: (quote: QuotationRecord) => AuditWrite): Promise<boolean>;
  markQuotationConverted(id: string, invoiceId: string, audit?: (quote: QuotationRecord, invoice: InvoiceRecord) => AuditWrite): Promise<QuotationRecord>;
}
export class QuotationService {
  constructor(private readonly storage: QuotationStorage, private readonly auth: AuthService) {}
  async list() { await this.auth.require('SELL'); return this.storage.listQuotations(); }
  async get(id: string) { await this.auth.require('SELL'); return this.storage.getQuotation(id); }
  async save(cart: QuotationCart, totalPaise: bigint, validDays: number) {
    await this.auth.require('SELL');
    if (!cart.lines.length || totalPaise <= 0n) throw new Error('Add items with a positive total before saving a quotation.');
    const validUntil = quotationValidUntil(new Date(), validDays);
    const actor = this.auth.getSnapshot();
    return this.storage.saveQuotation(cart, totalPaise.toString(), validUntil, quote => ({ actor, action: 'QUOTATION_CREATED', entityType: 'quotation', entityId: quote.id, summary: `Created quotation ${quote.number}` }));
  }
  async delete(id: string) {
    await this.auth.require('SELL');
    const actor = this.auth.getSnapshot();
    return this.storage.deleteQuotation(id, quote => ({ actor, action: 'QUOTATION_DELETED', entityType: 'quotation', entityId: id, summary: `Deleted quotation ${quote.number}` }));
  }
  async markConverted(id: string, invoice: InvoiceRecord) {
    await this.auth.require('SELL');
    if (invoice.type === 'RETURN') throw new Error('A credit note cannot convert a quotation.');
    const actor = this.auth.getSnapshot();
    return this.storage.markQuotationConverted(id, invoice.id, (quote, saved) => ({ actor, action: 'QUOTATION_CONVERTED', entityType: 'quotation', entityId: quote.id, summary: `Converted ${quote.number} to invoice ${saved.number}` }));
  }
}

export function quotationExpiryLabel(quote: Pick<QuotationRecord, 'validUntil'>) {
  return quote.validUntil < localDateKey() ? 'Expired' : `Valid until ${quote.validUntil}`;
}
