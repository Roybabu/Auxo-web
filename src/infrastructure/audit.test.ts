import 'fake-indexeddb/auto';
import {expect,it} from 'vitest';
import {LocalDatabase} from './localDatabase';
import {AuthService} from '../application/authService';
import {ActivityLogService} from '../application/activityLogService';
import {ShopService} from '../application/shopService';
import {AuthorizedStorage} from './authorizedStorage';

it('persists recent activity, includes it in snapshots, and restores it with backups',async()=>{
 const db=new LocalDatabase(`audit-${crypto.randomUUID()}`);
 await db.recordAudit({id:'admin-1',name:'Owner',role:'SUPER_ADMIN'},'SALE_RECORDED','invoice','invoice-1','Sale INV/1, total 1200 paise',100);
 await db.recordAudit({id:'staff-1',name:'Staff',role:'EMPLOYEE'},'STOCK_CHANGED','variant','variant-1','Stock changed by -2',200);
 const rows=await db.listRecentAudit();expect(rows.map(row=>row.action)).toEqual(['STOCK_CHANGED','SALE_RECORDED']);
 const snapshot=await db.snapshot();expect(snapshot.auditLog).toHaveLength(2);
 await db.replaceSnapshot({...snapshot,auditLog:[snapshot.auditLog[0]!]});expect(await db.listRecentAudit()).toHaveLength(1);
 await db.close();
});

it('requires the activity-log permission to view entries',async()=>{
 const db=new LocalDatabase(`audit-access-${crypto.randomUUID()}`),auth=new AuthService(db),service=new ActivityLogService(db,auth);
 await expect(service.recent()).rejects.toThrow(/Sign in/);
 await auth.setup('Owner','owner.audit','Strong-Password-483','Strong-Password-483');
 const shops=new ShopService(new AuthorizedStorage(db,auth));await shops.save({storeName:'Audit Shop',address:''});
 const summaries=(await service.recent()).map(row=>row.summary);expect(summaries).toContain('Saved business settings for Audit Shop');expect(summaries).toContain('Owner set up the administrator account');
 await db.close();
});
