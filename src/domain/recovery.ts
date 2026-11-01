// AUXO Android temp core/auth/RecoveryCodes.kt: 100-bit, human-readable recovery codes.
export const RECOVERY_ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function normalizeRecoveryCode(text:string){return text.toUpperCase().replace(/[^A-Z0-9]/g,'');}
export function validRecoveryCode(text:string){const code=normalizeRecoveryCode(text);return code.length===20&&[...code].every(c=>RECOVERY_ALPHABET.includes(c));}
export function formatRecoveryCode(text:string){return normalizeRecoveryCode(text).match(/.{1,5}/g)?.join('-')??'';}
export function generateRecoveryCode(){const bytes=crypto.getRandomValues(new Uint8Array(20));return Array.from(bytes,b=>RECOVERY_ALPHABET[b&31]).join('');}
