import type {AuthService} from './authService';
import type {LoyaltyRules} from '../domain/loyalty';
export interface LoyaltySettingsStorage{getLoyaltyRules():Promise<LoyaltyRules>;saveLoyaltyRules(rules:LoyaltyRules):Promise<void>}
export class LoyaltyService{constructor(private readonly storage:LoyaltySettingsStorage,private readonly auth:AuthService){}async load(){await this.auth.require('MANAGE_LOYALTY');return this.storage.getLoyaltyRules();}async save(rules:LoyaltyRules){await this.auth.require('MANAGE_LOYALTY');return this.storage.saveLoyaltyRules(rules);}}
