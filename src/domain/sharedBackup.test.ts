import { describe, expect, it } from 'vitest';
import {
  buildSharedBackupHeader,
  decryptSharedBackup,
  encryptSharedBackup,
  parseSharedBackupHeader,
} from './sharedBackup';

// Test vector from docs/BACKUP_FORMAT.md section 5. Test-only values.
const passphrase = 'AUXO test';
const salt = Uint8Array.from(Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex'));
const nonce = Uint8Array.from(Buffer.from('101112131415161718191a1b', 'hex'));
const expectedHeaderHex =
  '4155584f424b5550000150424b4446322d484d41432d53484132353600004145532d3235362d47434d00000927c0000102030405060708090a0b0c0d0e0f101112131415161718191a1b';
const expectedJson =
  '{"format":"auxo-backup","version":1,"sharedModelVersion":1,"createdAt":0,"source":{"platform":"web","appVersion":"test"},"shopName":"A","tables":{"settings":[{"id":"shop","storeName":"A","address":"","gstin":"","stateCode":"","gstRegistered":false,"pricesIncludeTax":true,"roundOff":true,"invoicePrefix":"INV","creditNotePrefix":"CN","phone":"","fssai":"","upiId":"","upiPayeeName":"","receiptPaper":"THERMAL_80","receiptFooter":"Thank you for shopping with us!","receiptLanguage":"en","receiptShowHsn":true,"receiptShowTaxBreakdown":true,"receiptShowCustomer":true,"receiptShowSavings":true,"receiptShowBarcode":true,"receiptShowUpiQr":true,"employeeDiscountLimitBp":0,"expiryWarningDays":30,"metalRatesPaise":{}}],"categories":[],"subcategories":[],"products":[],"variants":[],"stockBatches":[],"stockMovements":[],"customers":[],"customerLedger":[],"invoices":[],"invoiceLines":[],"payments":[],"suppliers":[],"purchaseOrders":[],"purchaseOrderLines":[],"receipts":[],"receiptLines":[],"dayClosings":[],"loyaltySettings":[],"loyaltyLedger":[],"heldBills":[],"heldBillLines":[],"quotations":[],"quotationLines":[],"stockCounts":[],"stockCountLines":[],"auditLog":[],"numberSequences":[],"extensions":[]},"photos":[]}';
const expectedCiphertextB64 =
  'v2QGyjtGPdiMvXuzjdzNAu0WNoJd6Po3Ns9JztzRiTqOz45zQd017wyHgwWcUI6Fw7QEAMwG+YxGicA5+U4dfiD2b1xR5AO7EbrbWAxNq3aldJ3+x2S6LoFEYRndViMn63td1fkrS4VeFpqcQOMMu/AF51eK4M8Fr8dle5gXFUNUBbhsM8Jb5mGTBhjI0DWXMgacgGfAoq0eCHwPm10O6q1eVglH4OBeN3NCbkAuh02CvmrpjLq42Dplpzjk9hSSPrv2aJmwGOR6DEOiy44RglP8o9vUTVrc4edev2O07BwiE5PUtBzmtFrRhSt5iYS5YsgeYYu3hKDwhikk1CdiXnsxpO/ETIzb3uGLr0FUG11sNCIsqttd6ca9YGW7rMLpD1WiGpHW2dEsJJOApSvdMv3FkyDjMNrL24vZiPKlNLK+3KYDDwITRsVMA2FnyA8gWwqC40hXYub4lBQQehDpK1gDl5K2eDQYK6tm99DJRNEiipTcmrj/9XWbGFnCDv1HReoq5aIDmucSWaFWMdlK8q7z+SHISUqyhaUkn3Vtm2EI5+d83OS1rS3lLkIw7ifjDON/PYcdhN/lRSRRXQ2RPJ/ffpISmb07MZw4J62l4Se/YFJr4z3BoVKQZW/O/jTaII1XTa6ulD3gyre8ngLb7h3vFf9oXqnloaEYA2/h40GN2gymzFD+AlJHhiIRdXDuf4TJTAmQ6/Jj3UIS/o4U4HOJPUHanqhazXfW3f+f6zPFKjIHUXV+Lc74klqr6U+mw0XHgTn97/4e8lyHlUaKmcrWlghRFW6JYLSG4skKB8MVsV+dgY1bjEe/stT/pWuutDIP7w/pLVswhyd0hBqSuOwev0ptqtHNXGzskfTz2DJKQWjbC+CY1oynFuGP8DRXGDqCSPlFFaVIhGQKmv9ndgxCIxyg716iG1618sEnjp21uJA5tV6Bvgnb7cFIBtG6i5/4dau4+veUF4F3a8XG9gbhhbU7/kimb2WZ3w7buMA0StIeLqt+XWf/vp7w0ltIscWSksBDkOnhCw5Cnf8MmqIs7kK4BOU5HhEAs+8LQsy/EkDiRfPU5RGkCOcdX2CGckA+34vZY5feR6yby+nmkxUSlJVxNLTqsvWm/8VYfVx6B4d9NdhXNhfg8s4Nw2ABJrI20FxgTCIEMAz/VFlDzjGXOL4sdWyTHu+oEL2qElGY5zEmPaZ88P0oilH+thuGTD7HS9p7sM3gsMgSVcd0rQs48oHIKS7ERyjQXbs/+XcMMSk2HV/skGseDXLCB9Dm7bBteqi1MOr+eYQ8E1PxbLvRLGqkOoJKVsreCPlNfxbJI2lpbtjav7yoxGLXFJuZld1bJ9h6LOOKLgW6M4vTdRWh1ZQ1QSde3AM2ZJS4lf7FR4JQ2LBw81NUaVih/UAl7Bg/Hq6Dg0viuDkR5/Uhsy2AgXvkksB7xxZn3UT2vL/nJpnZxft984ZXkf/v03jYAOtKYU2efrLrw4ntwAh1pOKZMd65rtmIb4U57+tyDJ+kXTFeME20lt5B/caIlLGPkbe0Pavu8igcsZJCua8zHpV68jfSxZd6k21QPuD2X2w4Rd1lAnXLSw+4n/70lqEycZWyGrGvslufAVdNTktSWlpBofOoQ1O/Yb0zVcK0F00WsQ==';

const bytesToHex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');
const expectedFile = () => Uint8Array.from(Buffer.concat([
  Buffer.from(expectedHeaderHex, 'hex'),
  Buffer.from(expectedCiphertextB64, 'base64'),
]));

describe('shared backup container (auxo-backup v1)', () => {
  it('builds the exact 74-byte header from the test vector', () => {
    const header = buildSharedBackupHeader(salt, nonce);
    expect(header.length).toBe(74);
    expect(bytesToHex(header)).toBe(expectedHeaderHex);
  });

  it('parses the header fields back out', () => {
    const parsed = parseSharedBackupHeader(expectedFile());
    expect(parsed.iterations).toBe(600_000);
    expect(bytesToHex(parsed.salt)).toBe('000102030405060708090a0b0c0d0e0f');
    expect(bytesToHex(parsed.nonce)).toBe('101112131415161718191a1b');
  });

  it('encrypts the test vector to the exact expected file bytes', async () => {
    const file = await encryptSharedBackup(expectedJson, passphrase, { salt, nonce });
    expect(bytesToHex(file)).toBe(bytesToHex(expectedFile()));
  });

  it('decrypts the test vector back to the exact JSON', async () => {
    const json = await decryptSharedBackup(expectedFile(), passphrase);
    expect(json).toBe(expectedJson);
  });

  it('rejects a wrong passphrase without returning any content', async () => {
    await expect(decryptSharedBackup(expectedFile(), 'AUXO wrong')).rejects.toThrow(/Wrong passphrase/);
  });

  it('rejects a single changed header byte', async () => {
    const tampered = expectedFile();
    tampered[46]! ^= 0x01;
    await expect(decryptSharedBackup(tampered, passphrase)).rejects.toThrow();
  });

  it('rejects a changed ciphertext byte', async () => {
    const tampered = expectedFile();
    tampered[80]! ^= 0x01;
    await expect(decryptSharedBackup(tampered, passphrase)).rejects.toThrow();
  });

  it('rejects files that are too short or have the wrong magic', () => {
    expect(() => parseSharedBackupHeader(new Uint8Array(40))).toThrow(/too small/);
    const wrongMagic = expectedFile();
    wrongMagic[0] = 0x58;
    expect(() => parseSharedBackupHeader(wrongMagic)).toThrow(/not an AUXO backup/);
  });

  it('rejects unsupported iteration counts', () => {
    const file = expectedFile();
    new DataView(file.buffer).setUint32(42, 1000, false);
    expect(() => parseSharedBackupHeader(file)).toThrow(/unsupported key settings/);
  });

  it('round-trips with fresh random salt and nonce', async () => {
    const file = await encryptSharedBackup('{"hello":"world"}', 'a passphrase of ten');
    expect(await decryptSharedBackup(file, 'a passphrase of ten')).toBe('{"hello":"world"}');
  });

  it('normalises the passphrase to NFC', async () => {
    const composed = 'café-passphrase';
    const decomposed = 'café-passphrase';
    const file = await encryptSharedBackup('{}', composed, { salt, nonce });
    expect(await decryptSharedBackup(file, decomposed)).toBe('{}');
  });
});
