import type {AuthService} from './authService';
import type {LocalDatabase} from '../infrastructure/localDatabase';
export class ActivityLogService{
 constructor(private readonly storage:LocalDatabase,private readonly auth:AuthService){}
 async recent(){await this.auth.require('VIEW_ACTIVITY_LOG');return this.storage.listRecentAudit(300);}
}
