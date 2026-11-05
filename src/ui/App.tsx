import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { HashRouter, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ShopService } from '../application/shopService';
import { CatalogService } from '../application/catalogService';
import { SalesService } from '../application/salesService';
import { AuthService } from '../application/authService';
import { LocalDatabase } from '../infrastructure/localDatabase';
import { AuthorizedStorage } from '../infrastructure/authorizedStorage';
import type { Permission } from '../domain/access';
import { Pending } from './primitives';
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
const modules:[string,string,Permission][]=[['pos','Billing','SELL'],['products','Products','MANAGE_PRODUCTS'],['inventory','Inventory','VIEW_STOCK_RECORDS'],['stock-alerts','Stock alerts / reorder','VIEW_STOCK_RECORDS'],['stock-count','Stock count','ADJUST_STOCK'],['customers','Customers','MANAGE_CUSTOMERS'],['suppliers','Suppliers','MANAGE_SUPPLIERS'],['purchases','Purchases','MANAGE_PURCHASES'],['gst','GST reports','GST_REPORT'],['closing','Day-end closing','CLOSE_DAY'],['loyalty','Customer loyalty','MANAGE_LOYALTY'],['employees','Employees','MANAGE_USERS'],['backups','Backups','BACKUP_AND_RESTORE']];
type NavItem=[path:string,label:string,permission:Permission|null];
const navGroups:{label:string;items:NavItem[]}[]=[
  {label:'Home',items:[['/','Overview',null]]},
  {label:'Billing',items:[['/pos','Billing','SELL']]},
  {label:'Stock',items:[['/products','Products','MANAGE_PRODUCTS'],['/inventory','Inventory','VIEW_STOCK_RECORDS'],['/stock-alerts','Stock alerts / reorder','VIEW_STOCK_RECORDS'],['/stock-count','Stock count','ADJUST_STOCK'],['/categories','Product categories','MANAGE_SETTINGS']]},
  {label:'People',items:[['/customers','Customers','MANAGE_CUSTOMERS'],['/suppliers','Suppliers','MANAGE_SUPPLIERS'],['/employees','Employees','MANAGE_USERS'],['/loyalty','Customer loyalty','MANAGE_LOYALTY']]},
  {label:'Reports',items:[['/reports','Reports','VIEW_REPORTS'],['/gst','GST reports','GST_REPORT'],['/closing','Day-end closing','CLOSE_DAY'],['/activity','Activity log','VIEW_ACTIVITY_LOG']]},
  {label:'More',items:[['/purchases','Purchases','MANAGE_PURCHASES'],['/backups','Backups','BACKUP_AND_RESTORE'],['/settings','Settings','MANAGE_SETTINGS'],['/quick-unlock','Quick unlock',null],['/recovery','Recovery code','MANAGE_USERS']]}
];
const railIcons:Record<string,ReactNode>={
  Home:<path d="M3 11l9-8 9 8M5 10v10h14V10"/>,
  Billing:<><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h4"/></>,
  Stock:<path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8"/>,
  People:<><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6M16 4.5a3.5 3.5 0 010 7M18 14c2.4.6 3.5 2.6 3.5 6"/></>,
  Reports:<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>,
  More:<><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></>
};
function useVisibleGroups(){
  const {pathname}=useLocation();
  const groups=navGroups.map(group=>({label:group.label,items:group.items.filter(([,,permission])=>permission===null||auth.can(permission))})).filter(group=>group.items.length>0);
  const activeGroup=groups.find(group=>group.items.some(([path])=>path==='/'?pathname==='/':pathname===path||pathname.startsWith(path+'/')))??groups[0];
  return {groups,activeGroup};
}
function Rail(){
  const {groups,activeGroup}=useVisibleGroups();
  return <nav className="rail" aria-label="Main navigation"><div className="brand"><svg width="44" height="44" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="13" fill="#167D55"/><path d="M20 31V19M20 19c0-5 3-8 8-8 0 5-3 8-8 8zM20 24c0-4-2.5-6.5-7-6.5 0 4 2.5 6.5 7 6.5z" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
    {groups.map(group=><NavLink key={group.label} to={group.items[0]![0]} end={group.label==='Home'} className={group===activeGroup?'rail-link active':'rail-link'}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{railIcons[group.label]}</svg><span>{group.label}</span></NavLink>)}
    <div className="rail-spacer"/>
    <button type="button" className="rail-link" onClick={()=>auth.lock()}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="3"/><path d="M8 11V8a4 4 0 018 0v3"/></svg><span>Lock</span></button>
  </nav>;
}
function TopBar({user}:{user:{name:string;role:string}}){
  const {activeGroup}=useVisibleGroups();
  return <header className="topbar"><div className="topbar-row">
    {activeGroup&&activeGroup.items.length>1?<nav className="subnav" aria-label={`${activeGroup.label} pages`}>{activeGroup.items.map(([path,label])=><NavLink key={path} to={path}>{label}</NavLink>)}</nav>:<strong className="topbar-title">{activeGroup?.label==='Home'?'Overview':activeGroup?.label}</strong>}
    <div className="topbar-user"><span className="user-chip">{user.name}<small>{user.role==='SUPER_ADMIN'?'Super Admin':'Employee'}</small></span><span className="avatar" aria-hidden="true">{user.name.slice(0,1).toUpperCase()}</span><button type="button" className="secondary" onClick={()=>void auth.signOut().catch(error=>window.alert(error instanceof Error?error.message:'Could not record sign out.'))}>Sign out</button></div></div>
  </header>;
}
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
  return <HashRouter><div className="workspace"><Rail/><div className="content"><TopBar user={user}/><main>{folderAccessNeeded&&<p role="status" className="backup-due-banner"><strong>Scheduled backups need access to your backup folder again.</strong> <a href="#/backups">Open Backups</a> and click Allow folder access.</p>}<Routes>
    <Route path="/" element={auth.can('VIEW_DASHBOARD')?<DashboardPage service={dashboard}/>:<EmployeeOverview name={user.name}/>}/>
    {modules.filter(([path])=>!['products','inventory','pos','restaurant','customers','employees','backups','suppliers','purchases','gst','closing','loyalty','stock-count','stock-alerts'].includes(path)).map(([path,label,permission])=><Route key={path} path={`/${path}`} element={<Guard permission={permission}><Pending title={label}/></Guard>}/>)}
    <Route path="/pos" element={<Guard permission="SELL"><SalesPage sales={sales} shops={shops} photos={productPhotos} quotations={quotations} canReturn={auth.can('PROCESS_RETURN')} employee={user.role==='EMPLOYEE'}/></Guard>}/>
    <Route path="/restaurant" element={<Navigate to="/pos" replace/>}/>
    <Route path="/customers" element={<Guard permission="MANAGE_CUSTOMERS"><CustomerAccountsPage sales={sales} shops={shops} canReceive={auth.can('RECEIVE_ACCOUNT_PAYMENT')}/></Guard>}/>
    <Route path="/products" element={<Guard permission="MANAGE_PRODUCTS"><ProductsPage service={catalog} photos={productPhotos}/></Guard>}/>
    <Route path="/products/import" element={<Guard permission="MANAGE_PRODUCTS"><ProductImportPage service={catalog}/></Guard>}/>
    <Route path="/products/:productId/labels" element={<Guard permission="MANAGE_PRODUCTS"><LabelPrintPage service={catalog}/></Guard>}/>
    <Route path="/inventory" element={<Guard permission="VIEW_STOCK_RECORDS"><InventoryPage service={catalog} shops={shops}/></Guard>}/>
    <Route path="/stock-alerts" element={<Guard permission="VIEW_STOCK_RECORDS"><StockAlertsPage catalog={catalog} purchasing={purchasing} canReorder={auth.can('MANAGE_PURCHASES')}/></Guard>}/>
    <Route path="/stock-count" element={<Guard permission="ADJUST_STOCK"><StockCountPage service={stockCount}/></Guard>}/>
    <Route path="/employees" element={<Guard permission="MANAGE_USERS"><EmployeesPage auth={auth}/></Guard>}/>
    <Route path="/settings" element={<Guard permission="MANAGE_SETTINGS"><ShopPage service={shops} photos={productPhotos}/></Guard>}/>
    <Route path="/categories" element={<Guard permission="MANAGE_SETTINGS"><CategoriesPage service={categories}/></Guard>}/>
    <Route path="/quick-unlock" element={<QuickUnlockPage auth={auth}/>}/>
    <Route path="/recovery" element={<Guard permission="MANAGE_USERS"><RecoveryRoute/></Guard>}/>
    <Route path="/suppliers" element={<Guard permission="MANAGE_SUPPLIERS"><SuppliersPage service={purchasing}/></Guard>}/>
    <Route path="/purchases" element={<Guard permission="MANAGE_PURCHASES"><PurchasesPage service={purchasing} canReceive={auth.can('RECEIVE_GOODS')}/></Guard>}/>
    <Route path="/backups" element={<Guard permission="BACKUP_AND_RESTORE"><BackupPage shared={sharedBackups} scheduled={scheduledBackups}/></Guard>}/>
    <Route path="/reports" element={<Guard permission="VIEW_REPORTS"><ReportsPage service={reporting}/></Guard>}/>
    <Route path="/gst" element={<Guard permission="GST_REPORT"><GstReportPage service={reporting}/></Guard>}/>
    <Route path="/closing" element={<Guard permission="CLOSE_DAY"><DayEndPage service={dayEnd} user={user.name}/></Guard>}/>
    <Route path="/loyalty" element={<Guard permission="MANAGE_LOYALTY"><LoyaltySettingsPage service={loyalty}/></Guard>}/>
    <Route path="/activity" element={<Guard permission="VIEW_ACTIVITY_LOG"><ActivityLogPage service={activityLog}/></Guard>}/>
    <Route path="*" element={<section><h1>Page not found</h1><NavLink to="/">Return to overview</NavLink></section>}/>
  </Routes></main></div></div></HashRouter>;
}
