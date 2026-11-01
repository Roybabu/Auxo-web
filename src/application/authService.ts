import { normalizeGrants, permissionsFor, validateAccount, type Permission, type Role } from '../domain/access';
import { formatRecoveryCode, generateRecoveryCode, normalizeRecoveryCode, validRecoveryCode } from '../domain/recovery';

export type RecoveryRecord={salt:string;hash:string;iterations:number;createdAt:number};
export type StoredAccount={id:string;name:string;identifier:string;role:Role;active:boolean;salt:string;hash:string;iterations:number;createdAt:number;granted:Permission[];recovery?:RecoveryRecord|null};
export type SessionUser=Pick<StoredAccount,'id'|'name'|'role'> & {permissions:Permission[]};
export interface AccountStorage {listAccounts():Promise<StoredAccount[]>;getAccount(id:string):Promise<StoredAccount|null>;findAccount(identifier:string):Promise<StoredAccount|null>;createAdmin(account:StoredAccount):Promise<void>;createEmployeeAccount(account:StoredAccount):Promise<void>;updateAccount(account:StoredAccount):Promise<void>;replaceRecoveryAccount(account:StoredAccount,expectedHash:string|null):Promise<void>}
const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const unhex=(text:string)=>new Uint8Array(text.match(/../g)!.map(x=>parseInt(x,16)));
async function hash(password:string,salt:string,iterations:number){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);return hex(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:unhex(salt) as BufferSource,iterations},key,256)));}
function equal(a:string,b:string){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
async function newAccount(name:string,identifier:string,password:string,role:Role,granted:Permission[]=[]):Promise<StoredAccount>{const salt=hex(crypto.getRandomValues(new Uint8Array(16)));const iterations=600_000;return {id:crypto.randomUUID(),name,identifier,role,active:true,salt,hash:await hash(password,salt,iterations),iterations,createdAt:Date.now(),granted:normalizeGrants(granted)};}
export class AuthService {
  private current:SessionUser|null=null;private listeners=new Set<()=>void>();private failures=0;private lockedUntil=0;
  private prompt:'required'|'offered'|null=null;private pendingCode:string|null=null;private codeFailures=0;private codeLockedUntil=0;
  constructor(private readonly storage:AccountStorage){}
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return ()=>this.listeners.delete(listener);};
  getSnapshot=()=>this.current;
  getRecoveryPrompt=()=>this.prompt;
  private notify(){for(const listener of this.listeners)listener();}
  private setPrompt(prompt:'required'|'offered'|null){this.prompt=prompt;this.notify();}
  private setSession(user:SessionUser|null){this.current=user;this.notify();}
  async needsSetup(){return (await this.storage.listAccounts()).length===0;}
  async setup(name:string,identifier:string,password:string,confirm:string){const clean=validateAccount(name,identifier,password,confirm);const account=await newAccount(clean.name,clean.identifier,password,'SUPER_ADMIN');await this.storage.createAdmin(account);this.prompt='required';this.setSession(this.toSession(account));}
  async signIn(identifier:string,password:string){if(Date.now()<this.lockedUntil)throw new Error('Too many attempts. Try again shortly.');const account=await this.storage.findAccount(identifier.trim().toLowerCase());const valid=account&&password&&equal(await hash(password,account.salt,account.iterations),account.hash);if(!valid){this.failures++;if(this.failures>=5)this.lockedUntil=Date.now()+30_000;throw new Error('Username or password is incorrect.');}if(!account.active)throw new Error('This account is deactivated.');this.failures=0;this.lockedUntil=0;this.pendingCode=null;this.prompt=account.role==='SUPER_ADMIN'&&!account.recovery?'offered':null;this.setSession(this.toSession(account));}
  signOut(){this.pendingCode=null;this.prompt=null;this.setSession(null);}
  can(permission:Permission){return this.current?.permissions.includes(permission)??false;}
  async require(permission:Permission){const current=this.current;if(!current)throw new Error('Sign in to continue.');const account=await this.storage.getAccount(current.id);if(!this.current||this.current.id!==current.id)throw new Error('Sign in to continue.');if(!account?.active||account.role!==current.role){this.signOut();throw new Error('Account is no longer active. Sign in again.');}const session=this.toSession(account);if(!session.permissions.includes(permission))throw new Error(`Permission required: ${permission}.`);if(current.permissions.join(',')!==session.permissions.join(','))this.setSession(session);}
  async users(){await this.require('MANAGE_USERS');return (await this.storage.listAccounts()).map(({id,name,identifier,role,active,createdAt,granted})=>({id,name,identifier,role,active,createdAt,granted}));}
  async createEmployee(name:string,identifier:string,password:string,confirm:string,granted:Permission[]){await this.require('MANAGE_USERS');const clean=validateAccount(name,identifier,password,confirm);const account=await newAccount(clean.name,clean.identifier,password,'EMPLOYEE',granted);await this.storage.createEmployeeAccount(account);}
  async setGrants(id:string,granted:Permission[]){await this.require('MANAGE_USERS');const account=await this.employee(id);await this.storage.updateAccount({...account,granted:normalizeGrants(granted)});}
  async setActive(id:string,active:boolean){await this.require('MANAGE_USERS');const account=await this.employee(id);await this.storage.updateAccount({...account,active});}
  async resetPassword(id:string,password:string,confirm:string){await this.require('MANAGE_USERS');const account=await this.employee(id);validateAccount(account.name,account.identifier,password,confirm);const salt=hex(crypto.getRandomValues(new Uint8Array(16)));const iterations=600_000;await this.storage.updateAccount({...account,salt,iterations,hash:await hash(password,salt,iterations)});}
  async recoveryStatus(){await this.require('MANAGE_USERS');const account=await this.storage.getAccount(this.current!.id);return account?.recovery?.createdAt??null;}
  dismissRecoveryOffer(){if(this.prompt==='offered')this.setPrompt(null);}
  async startRecoveryCode(password?:string){await this.require('MANAGE_USERS');const admin=await this.storage.getAccount(this.current!.id);if(!admin||admin.role!=='SUPER_ADMIN')throw new Error('Administrator account unavailable.');if(this.prompt!=='required'){
    if(Date.now()<this.lockedUntil)throw new Error('Too many attempts. Try again shortly.');
    if(!password||!equal(await hash(password,admin.salt,admin.iterations),admin.hash)){this.failures++;if(this.failures>=5)this.lockedUntil=Date.now()+30_000;throw new Error('Administrator password is incorrect.');}this.failures=0;this.lockedUntil=0;
  }
    this.pendingCode=generateRecoveryCode();return formatRecoveryCode(this.pendingCode);
  }
  async confirmRecoveryCode(typed:string){await this.require('MANAGE_USERS');const code=this.pendingCode;if(!code)throw new Error('Generate a recovery code first.');if(!equal(normalizeRecoveryCode(code),normalizeRecoveryCode(typed)))throw new Error('The code does not match. Copy it before confirming.');const admin=await this.storage.getAccount(this.current!.id);if(!admin||admin.role!=='SUPER_ADMIN')throw new Error('Administrator account unavailable.');const salt=hex(crypto.getRandomValues(new Uint8Array(16))),iterations=600_000;
    await this.storage.replaceRecoveryAccount({...admin,recovery:{salt,hash:await hash(code,salt,iterations),iterations,createdAt:Date.now()}},admin.recovery?.hash??null);
    this.pendingCode=null;this.setPrompt(null);
  }
  async resetAdminWithRecovery(codeText:string,password:string,confirm:string){if(this.current)throw new Error('Sign out before resetting the administrator password.');if(Date.now()<this.codeLockedUntil)throw new Error('Too many recovery attempts. Try again shortly.');const admin=(await this.storage.listAccounts()).find(a=>a.role==='SUPER_ADMIN');if(!admin?.recovery)throw new Error('No recovery code is set for this administrator.');validateAccount(admin.name,admin.identifier,password,confirm);
    const code=normalizeRecoveryCode(codeText);const proof=admin.recovery;const correct=validRecoveryCode(code)&&equal(await hash(code,proof.salt,proof.iterations),proof.hash);
    if(!correct){this.codeFailures++;if(this.codeFailures>=5)this.codeLockedUntil=Date.now()+30_000;throw new Error('Recovery code is incorrect.');}
    const newCode=generateRecoveryCode(),salt=hex(crypto.getRandomValues(new Uint8Array(16))),recoverySalt=hex(crypto.getRandomValues(new Uint8Array(16))),iterations=600_000;
    await this.storage.replaceRecoveryAccount({...admin,salt,hash:await hash(password,salt,iterations),iterations,recovery:{salt:recoverySalt,hash:await hash(newCode,recoverySalt,iterations),iterations,createdAt:Date.now()}},proof.hash);
    this.codeFailures=0;this.codeLockedUntil=0;this.failures=0;this.lockedUntil=0;return formatRecoveryCode(newCode);
  }
  private async employee(id:string){const account=await this.storage.getAccount(id);if(!account||account.role!=='EMPLOYEE')throw new Error('Employee no longer exists.');return account;}
  private toSession(account:StoredAccount):SessionUser{return {id:account.id,name:account.name,role:account.role,permissions:permissionsFor(account.role,account.granted)};}
}
