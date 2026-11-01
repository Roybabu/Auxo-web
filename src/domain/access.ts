// Source: AUXO Android temp core/auth/Permission.kt and AdminSetupValidator.kt.
export const PERMISSIONS=['SELL','VIEW_INVOICES','PROCESS_RETURN','CLOSE_DAY','VIEW_FINANCIALS','VIEW_REPORTS','GST_REPORT','MANAGE_LOYALTY','UNLIMITED_DISCOUNT','VIEW_DASHBOARD','MANAGE_PRODUCTS','ADJUST_STOCK','VIEW_STOCK_RECORDS','MANAGE_CUSTOMERS','RECEIVE_ACCOUNT_PAYMENT','MANAGE_SUPPLIERS','MANAGE_PURCHASES','RECEIVE_GOODS','MANAGE_SETTINGS','BACKUP_AND_RESTORE','MANAGE_USERS','VIEW_ACTIVITY_LOG'] as const;
export type Permission=typeof PERMISSIONS[number];
export type Role='SUPER_ADMIN'|'EMPLOYEE';
export const BASE_PERMISSIONS:Permission[]=['SELL','VIEW_INVOICES'];
export const GRANTABLE:Permission[]=['PROCESS_RETURN','CLOSE_DAY','VIEW_DASHBOARD','VIEW_FINANCIALS','VIEW_REPORTS','MANAGE_PRODUCTS','VIEW_STOCK_RECORDS','ADJUST_STOCK','MANAGE_CUSTOMERS','RECEIVE_ACCOUNT_PAYMENT','MANAGE_SUPPLIERS','MANAGE_PURCHASES','RECEIVE_GOODS','MANAGE_SETTINGS','VIEW_ACTIVITY_LOG'];
const needs:Partial<Record<Permission,Permission[]>>={VIEW_DASHBOARD:['VIEW_FINANCIALS'],VIEW_REPORTS:['VIEW_FINANCIALS'],MANAGE_PRODUCTS:['VIEW_STOCK_RECORDS'],ADJUST_STOCK:['MANAGE_PRODUCTS','VIEW_STOCK_RECORDS'],RECEIVE_ACCOUNT_PAYMENT:['MANAGE_CUSTOMERS'],MANAGE_PURCHASES:['MANAGE_SUPPLIERS'],RECEIVE_GOODS:['MANAGE_PURCHASES','MANAGE_SUPPLIERS']};
export function normalizeGrants(requested:readonly Permission[]):Permission[]{const grants=new Set(requested.filter(p=>GRANTABLE.includes(p)));for(const p of [...grants])for(const dependency of needs[p]??[])grants.add(dependency);return GRANTABLE.filter(p=>grants.has(p));}
export function switchOff(grants:readonly Permission[],permission:Permission):Permission[]{let result=new Set(grants);result.delete(permission);let changed=true;while(changed){changed=false;for(const p of result)if((needs[p]??[]).some(n=>!result.has(n))){result.delete(p);changed=true;}}return GRANTABLE.filter(p=>result.has(p));}
export function permissionsFor(role:Role,grants:readonly Permission[]=[]):Permission[]{return role==='SUPER_ADMIN'?[...PERMISSIONS]:[...new Set([...BASE_PERMISSIONS,...normalizeGrants(grants)])];}
export function validateAccount(name:string,identifier:string,password:string,confirm:string){
  const cleanName=name.trim().replace(/\s+/g,' '),id=identifier.trim().toLowerCase();
  if(!cleanName||cleanName.length>60)throw new Error('Name is required and must be 60 characters or fewer.');
  if(id.length>254||!(/^[a-z0-9._-]{3,32}$/.test(id)||/^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(id)))throw new Error('Enter a valid username or email.');
  if(password.length<8||password.length>128||!/[A-Za-z]/.test(password)||!/[0-9]/.test(password))throw new Error('Password must be 8–128 characters and include a letter and a digit.');
  const lower=password.toLowerCase();
  if(['password1','password12','password123','passw0rd','p@ssw0rd','12345678','123456789','1234567890','qwerty123','qwertyuiop1','abc12345','admin123','admin1234','welcome1','welcome123','letmein123','iloveyou1','auxo1234','auxo12345','changeme1','test1234','india123','asdf1234'].includes(lower)||id.split('@')[0]!.length>=3&&lower.includes(id.split('@')[0]!))throw new Error('Choose a less predictable password that does not contain the username.');
  if(password!==confirm)throw new Error('Passwords do not match.');return {name:cleanName,identifier:id};
}
export function discountExceeds(subtotal:bigint,discount:bigint,lineDiscounts:{gross:bigint;discount:bigint}[],limitBp:number){
  const exceeds=(base:bigint,amount:bigint,slack:bigint)=>amount>0n&&(base<=0n||((amount-(limitBp===0?0n:slack))*10000n>base*BigInt(limitBp)));
  return exceeds(subtotal,discount,BigInt(lineDiscounts.length+1))||lineDiscounts.some(l=>exceeds(l.gross,l.discount,1n));
}
