import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { HashRouter, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ShopService } from '../application/shopService';
import { CatalogService } from '../application/catalogService';
import { SalesService } from '../application/salesService';
import { AuthService } from '../application/authService';
import { LocalDatabase } from '../infrastructure/localDatabase';
import { AuthorizedStorage } from '../infrastructure/authorizedStorage';
import type { Permission } from '../domain/access';
import { ShopPage } from './ShopPage';
import { InventoryPage, ProductsPage } from './CatalogPages';
import { SalesPage } from './SalesPage';
import { CustomerAccountsPage } from './CustomerAccountsPage';
import { AuthPage, EmployeesPage, RecoverySetupPage } from './AuthPages';
import { SharedBackupService } from '../application/sharedBackupService';
import { ScheduledBackupService } from '../application/scheduledBackupService';
import { IndexedDbScheduleStore, NonExtractableKeyWrapper, openBrowserFolder } from '../infrastructure/scheduledBackupStore';
import { BackupPage } from './BackupPage';
import { SuppliersPage, PurchasesPage } from './PurchasingPages';
import { PurchasingService } from '../application/purchasingService';
import { ReportingService } from '../application/reportingService';
import { DayEndService } from '../application/dayEndService';
import { ReportsPage, GstReportPage } from './ReportsPages';
import { DayEndPage } from './DayEndPage';
import { LoyaltyService } from '../application/loyaltyService';
import { LoyaltySettingsPage } from './LoyaltySettingsPage';
import {ActivityLogService} from '../application/activityLogService';
import {ActivityLogPage} from './ActivityLogPage';
import {StockCountService} from '../application/stockCountService';
import {StockCountPage} from './StockCountPage';
import {CategoryService} from '../application/categoryService';
import {CategoriesPage} from './CategoriesPage';
import {CategorySetupPage} from './CategorySetupPage';
import {ProductImportPage} from './ProductImportPage';
import {LabelPrintPage} from './LabelPrintPage';
import {ProductPhotoService} from '../application/productPhotoService';
import {QuotationService} from '../application/quotationService';
import {DashboardService} from '../application/dashboardService';
import {NotificationService} from '../application/notificationService';
import {Header,PageTabs,Sidebar,type TabLink} from './Shell';
import {ExpiringPage,StockAlertsListPage,StockItemsPage,StockTabs} from './StockPages';
import {MorePage} from './MorePage';
import {DashboardPage,EmployeeOverview} from './DashboardPage';
import {StockAlertsPage} from './StockAlertsPage';
import {LockScreen,QuickUnlockPage} from './QuickUnlockPages';

const database=new LocalDatabase();const auth=new AuthService(database);const secured=new AuthorizedStorage(database,auth);
const shops=new ShopService(secured),catalog=new CatalogService(secured,shops),sales=new SalesService(secured,secured);
// Removes the saved copies from the retired automatic restore points (this browser only).
if(typeof indexedDB!=='undefined')indexedDB.deleteDatabase('auxo-genesis-auto-backups');
const sharedBackups=new SharedBackupService(database,auth);const scheduleStore=new IndexedDbScheduleStore();const scheduledBackups=new ScheduledBackupService({store:scheduleStore,wrapper:new NonExtractableKeyWrapper(scheduleStore),openFolder:openBrowserFolder,exportFile:passphrase=>sharedBackups.export(passphrase,{record:false}),requireAccess:()=>auth.require('BACKUP_AND_RESTORE')});const purchasing=new PurchasingService(secured);const reporting=new ReportingService(database,auth);const dayEnd=new DayEndService(database,auth);const loyalty=new LoyaltyService(secured,auth);
const activityLog=new ActivityLogService(database,auth);
const quotations=new QuotationService(database,auth);
const productPhotos=new ProductPhotoService(database);
const stockCount=new StockCountService(database,auth);
const categories=new CategoryService(database,auth);
const dashboard=new DashboardService(database,auth);
const notifications=new NotificationService(database,auth);
const can=(permission:Permission)=>auth.can(permission);
const listCategories=()=>catalog.listCategories();
function Tabbed({tabs,label,children}:{tabs:TabLink[];label:string;children:ReactNode}){return <div className="tabbed-page"><PageTabs tabs={tabs} label={label}/>{children}</div>;}
function peopleTabs():TabLink[]{return ([['/customers','Customers','MANAGE_CUSTOMERS'],['/suppliers','Suppliers','MANAGE_SUPPLIERS'],['/employees','Staff','MANAGE_USERS']] as [string,string,Permission][]).filter(([,,p])=>auth.can(p)).map(([to,label])=>({to,label}));}
function reportTabs():TabLink[]{return ([['/reports','Reports','VIEW_REPORTS'],['/gst','GST','GST_REPORT'],['/closing','Day-end closing','CLOSE_DAY'],['/activity','Activity log','VIEW_ACTIVITY_LOG']] as [string,string,Permission][]).filter(([,,p])=>auth.can(p)).map(([to,label])=>({to,label}));}
function PeopleHome(){const first=peopleTabs()[0]?.to??(auth.can('MANAGE_LOYALTY')?'/loyalty':'/');return <Navigate to={first} replace/>;}
function Guard({permission,children}:{permission:Permission;children:ReactNode}){return auth.can(permission)?<>{children}</>:<section><h1>Access denied</h1><p>Your account does not have permission to open this area.</p></section>}
function RecoveryRoute(){const navigate=useNavigate();return <RecoverySetupPage auth={auth} onDone={()=>navigate('/settings')}/>;}
export default function App(){
  const user=useSyncExternalStore(auth.subscribe,auth.getSnapshot),locked=useSyncExternalStore(auth.subscribe,auth.getLocked),recoveryPrompt=useSyncExternalStore(auth.subscribe,auth.getRecoveryPrompt);const [setup,setSetup]=useState<boolean|null>(null),[needsCategorySetup,setNeedsCategorySetup]=useState<boolean|null>(null),[bootError,setBootError]=useState('');
  useEffect(()=>{auth.needsSetup().then(setSetup).catch(e=>setBootError(e instanceof Error?e.message:'Local accounts could not be opened.'));},[]);
  useEffect(()=>{if(!user){setNeedsCategorySetup(false);return;}categories.needsSetup().then(setNeedsCategorySetup).catch(e=>setBootError(e instanceof Error?e.message:'Local categories could not be opened.'));},[user?.id]);
  useEffect(()=>{const onRestore=(event:StorageEvent)=>{if(event.key==='auxo-genesis-restored')void auth.signOut().catch(()=>{});};window.addEventListener('storage',onRestore);return()=>window.removeEventListener('storage',onRestore);},[]);
  useEffect(()=>{if(!user||!auth.can('BACKUP_AND_RESTORE'))return;const check=()=>{void scheduledBackups.runIfDue().catch(()=>{});};check();const timer=window.setInterval(check,60_000);window.addEventListener('focus',check);return()=>{window.clearInterval(timer);window.removeEventListener('focus',check);};},[user?.id]);
  const [folderAccessNeeded,setFolderAccessNeeded]=useState(false);
  useEffect(()=>{if(!user||!auth.can('BACKUP_AND_RESTORE'))return;const check=()=>{void scheduledBackups.status().then(st=>setFolderAccessNeeded(st.settings.enabled&&st.folderName!==null&&st.permission!=='granted')).catch(()=>{});};check();const timer=window.setInterval(check,60_000);window.addEventListener('focus',check);return()=>{window.clearInterval(timer);window.removeEventListener('focus',check);};},[user?.id]);
  useEffect(()=>{if(user)setSetup(false);},[user]);
  if(bootError)return <main className="auth-screen"><section><h1>Local data unavailable</h1><p role="alert">{bootError}</p></section></main>;
  if(setup===null)return <main className="auth-screen"><section>Opening local accounts…</section></main>;
  if(!user)return <AuthPage auth={auth} setup={setup} shared={sharedBackups}/>;
  if(recoveryPrompt)return <main className="auth-screen"><RecoverySetupPage auth={auth} required={recoveryPrompt==='required'}/></main>;
  if(needsCategorySetup===null)return <main className="auth-screen"><section>Opening product categories…</section></main>;
  if(needsCategorySetup)return <CategorySetupPage service={categories} onDone={()=>setNeedsCategorySetup(false)}/>;
  if(locked)return <LockScreen auth={auth} userName={user.name}/>;
  return <HashRouter><div className="workspace"><Sidebar auth={auth}/><div className="content"><Header auth={auth} shops={shops} notifications={notifications} user={user}/><main>{folderAccessNeeded&&<p role="status" className="backup-due-banner"><strong>Scheduled backups need access to your backup folder again.</strong> <a href="#/backups">Open Backups</a> and click Allow folder access.</p>}<Routes>
    <Route path="/" element={auth.can('VIEW_DASHBOARD')?<DashboardPage service={dashboard} photos={productPhotos} userName={user.name} can={can}/>:<EmployeeOverview name={user.name}/>}/>
    <Route path="/stock" element={<Guard permission="VIEW_STOCK_RECORDS"><StockTabs catalog={catalog} shops={shops} canReorder={auth.can('MANAGE_PURCHASES')}><StockItemsPage catalog={catalog} photos={productPhotos} can={can}/></StockTabs></Guard>}/>
    <Route path="/stock/alerts" element={<Guard permission="VIEW_STOCK_RECORDS"><StockTabs catalog={catalog} shops={shops} canReorder={auth.can('MANAGE_PURCHASES')}><StockAlertsListPage catalog={catalog} photos={productPhotos} can={can}/></StockTabs></Guard>}/>
    <Route path="/stock/expiring" element={<Guard permission="VIEW_STOCK_RECORDS"><StockTabs catalog={catalog} shops={shops} canReorder={auth.can('MANAGE_PURCHASES')}><ExpiringPage catalog={catalog} shops={shops} photos={productPhotos} can={can}/></StockTabs></Guard>}/>
    <Route path="/people" element={<PeopleHome/>}/>
    <Route path="/more" element={<MorePage can={can}/>}/>
    <Route path="/pos" element={<Guard permission="SELL"><SalesPage sales={sales} shops={shops} photos={productPhotos} quotations={quotations} canReturn={auth.can('PROCESS_RETURN')} employee={user.role==='EMPLOYEE'} listCategories={listCategories}/></Guard>}/>
    <Route path="/restaurant" element={<Navigate to="/pos" replace/>}/>
    <Route path="/customers" element={<Guard permission="MANAGE_CUSTOMERS"><Tabbed tabs={peopleTabs()} label="People"><CustomerAccountsPage sales={sales} shops={shops} photos={productPhotos} canReceive={auth.can('RECEIVE_ACCOUNT_PAYMENT')}/></Tabbed></Guard>}/>
    <Route path="/products" element={<Guard permission="MANAGE_PRODUCTS"><ProductsPage service={catalog} photos={productPhotos}/></Guard>}/>
    <Route path="/products/import" element={<Guard permission="MANAGE_PRODUCTS"><ProductImportPage service={catalog}/></Guard>}/>
    <Route path="/products/:productId/labels" element={<Guard permission="MANAGE_PRODUCTS"><LabelPrintPage service={catalog}/></Guard>}/>
    <Route path="/inventory" element={<Guard permission="VIEW_STOCK_RECORDS"><InventoryPage service={catalog} shops={shops}/></Guard>}/>
    <Route path="/stock-alerts" element={<Guard permission="VIEW_STOCK_RECORDS"><StockTabs catalog={catalog} shops={shops} canReorder={auth.can('MANAGE_PURCHASES')}><StockAlertsPage catalog={catalog} purchasing={purchasing} canReorder={auth.can('MANAGE_PURCHASES')}/></StockTabs></Guard>}/>
    <Route path="/stock-count" element={<Guard permission="ADJUST_STOCK"><StockCountPage service={stockCount}/></Guard>}/>
    <Route path="/employees" element={<Guard permission="MANAGE_USERS"><Tabbed tabs={peopleTabs()} label="People"><EmployeesPage auth={auth}/></Tabbed></Guard>}/>
    <Route path="/settings" element={<Guard permission="MANAGE_SETTINGS"><ShopPage service={shops} photos={productPhotos} categories={categories}/></Guard>}/>
    <Route path="/categories" element={<Guard permission="MANAGE_SETTINGS"><CategoriesPage service={categories}/></Guard>}/>
    <Route path="/quick-unlock" element={<QuickUnlockPage auth={auth}/>}/>
    <Route path="/recovery" element={<Guard permission="MANAGE_USERS"><RecoveryRoute/></Guard>}/>
    <Route path="/suppliers" element={<Guard permission="MANAGE_SUPPLIERS"><Tabbed tabs={peopleTabs()} label="People"><SuppliersPage service={purchasing}/></Tabbed></Guard>}/>
    <Route path="/purchases" element={<Guard permission="MANAGE_PURCHASES"><PurchasesPage service={purchasing} canReceive={auth.can('RECEIVE_GOODS')}/></Guard>}/>
    <Route path="/backups" element={<Guard permission="BACKUP_AND_RESTORE"><BackupPage shared={sharedBackups} scheduled={scheduledBackups}/></Guard>}/>
    <Route path="/reports" element={<Guard permission="VIEW_REPORTS"><Tabbed tabs={reportTabs()} label="Reports"><ReportsPage service={reporting}/></Tabbed></Guard>}/>
    <Route path="/gst" element={<Guard permission="GST_REPORT"><Tabbed tabs={reportTabs()} label="Reports"><GstReportPage service={reporting}/></Tabbed></Guard>}/>
    <Route path="/closing" element={<Guard permission="CLOSE_DAY"><Tabbed tabs={reportTabs()} label="Reports"><DayEndPage service={dayEnd} user={user.name}/></Tabbed></Guard>}/>
    <Route path="/loyalty" element={<Guard permission="MANAGE_LOYALTY"><LoyaltySettingsPage service={loyalty}/></Guard>}/>
    <Route path="/activity" element={<Guard permission="VIEW_ACTIVITY_LOG"><Tabbed tabs={reportTabs()} label="Reports"><ActivityLogPage service={activityLog}/></Tabbed></Guard>}/>
    <Route path="*" element={<section><h1>Page not found</h1><NavLink to="/">Return to the dashboard</NavLink></section>}/>
  </Routes></main></div></div></HashRouter>;
}
