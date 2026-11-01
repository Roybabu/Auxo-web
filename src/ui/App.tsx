import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { HashRouter, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
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
import { BackupService } from '../application/backupService';
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

const database=new LocalDatabase();const auth=new AuthService(database);const secured=new AuthorizedStorage(database,auth);
const shops=new ShopService(secured),catalog=new CatalogService(secured),sales=new SalesService(secured,secured);
const backups=new BackupService(database,auth);const purchasing=new PurchasingService(secured);const reporting=new ReportingService(database,auth);const dayEnd=new DayEndService(database,auth);const loyalty=new LoyaltyService(secured,auth);
const activityLog=new ActivityLogService(database,auth);
const stockCount=new StockCountService(database,auth);
const categories=new CategoryService(database,auth);
const modules:[string,string,Permission][]=[['pos','POS billing','SELL'],['restaurant','Restaurant','SELL'],['products','Products','MANAGE_PRODUCTS'],['inventory','Inventory','VIEW_STOCK_RECORDS'],['stock-count','Stock count','ADJUST_STOCK'],['customers','Customers','MANAGE_CUSTOMERS'],['suppliers','Suppliers','MANAGE_SUPPLIERS'],['purchases','Purchases','MANAGE_PURCHASES'],['gst','GST reports','GST_REPORT'],['closing','Day-end closing','CLOSE_DAY'],['loyalty','Customer loyalty','MANAGE_LOYALTY'],['employees','Employees','MANAGE_USERS'],['backups','Backups','BACKUP_AND_RESTORE']];
function Guard({permission,children}:{permission:Permission;children:ReactNode}){return auth.can(permission)?<>{children}</>:<section><h1>Access denied</h1><p>Your account does not have permission to open this area.</p></section>}
function RecoveryRoute(){const navigate=useNavigate();return <RecoverySetupPage auth={auth} onDone={()=>navigate('/settings')}/>;}
export default function App(){
  const user=useSyncExternalStore(auth.subscribe,auth.getSnapshot),recoveryPrompt=useSyncExternalStore(auth.subscribe,auth.getRecoveryPrompt);const [setup,setSetup]=useState<boolean|null>(null),[bootError,setBootError]=useState('');
  useEffect(()=>{auth.needsSetup().then(setSetup).catch(e=>setBootError(e instanceof Error?e.message:'Local accounts could not be opened.'));},[]);
  useEffect(()=>{const onRestore=(event:StorageEvent)=>{if(event.key==='auxo-genesis-restored')void auth.signOut().catch(()=>{});};window.addEventListener('storage',onRestore);return()=>window.removeEventListener('storage',onRestore);},[]);
  useEffect(()=>{if(user)setSetup(false);},[user]);
  if(bootError)return <main className="auth-screen"><section><h1>Local data unavailable</h1><p role="alert">{bootError}</p></section></main>;
  if(setup===null)return <main className="auth-screen"><section>Opening local accounts…</section></main>;
  if(!user)return <AuthPage auth={auth} setup={setup}/>;
  if(recoveryPrompt)return <main className="auth-screen"><RecoverySetupPage auth={auth} required={recoveryPrompt==='required'}/></main>;
  return <HashRouter><div className="workspace"><aside><strong>AUXO</strong><span className="edition">Genesis · functional skeleton</span><p>{user.name}<small className="muted">{user.role==='SUPER_ADMIN'?'Super Admin':'Employee'}</small></p><button type="button" className="secondary" onClick={()=>void auth.signOut().catch(error=>window.alert(error instanceof Error?error.message:'Could not record sign out.'))}>Sign out</button><nav aria-label="Main navigation">
    <NavLink to="/" end>Overview</NavLink>{modules.filter(([, ,permission])=>auth.can(permission)).map(([path,label])=><NavLink key={path} to={`/${path}`}>{label}</NavLink>)}
    {auth.can('VIEW_REPORTS')&&<NavLink to="/reports">Reports</NavLink>}{auth.can('VIEW_ACTIVITY_LOG')&&<NavLink to="/activity">Activity log</NavLink>}{auth.can('MANAGE_SETTINGS')&&<NavLink to="/categories">Product categories</NavLink>}{auth.can('MANAGE_SETTINGS')&&<NavLink to="/settings">Settings</NavLink>}{auth.can('MANAGE_USERS')&&<NavLink to="/recovery">Recovery code</NavLink>}
  </nav></aside><main><Routes>
    <Route path="/" element={<section><h1>AUXO Web</h1><p>Local business workspace. Choose a module from the navigation.</p></section>}/>
    {modules.filter(([path])=>!['products','inventory','pos','restaurant','customers','employees','backups','suppliers','purchases','gst','closing','loyalty','stock-count'].includes(path)).map(([path,label,permission])=><Route key={path} path={`/${path}`} element={<Guard permission={permission}><Pending title={label}/></Guard>}/>)}
    <Route path="/pos" element={<Guard permission="SELL"><SalesPage sales={sales} shops={shops} canReturn={auth.can('PROCESS_RETURN')} employee={user.role==='EMPLOYEE'}/></Guard>}/>
    <Route path="/restaurant" element={<Guard permission="SELL"><SalesPage sales={sales} shops={shops} canReturn={auth.can('PROCESS_RETURN')} employee={user.role==='EMPLOYEE'} restaurantMode/></Guard>}/>
    <Route path="/customers" element={<Guard permission="MANAGE_CUSTOMERS"><CustomerAccountsPage sales={sales} canReceive={auth.can('RECEIVE_ACCOUNT_PAYMENT')}/></Guard>}/>
    <Route path="/products" element={<Guard permission="MANAGE_PRODUCTS"><ProductsPage service={catalog}/></Guard>}/>
    <Route path="/inventory" element={<Guard permission="VIEW_STOCK_RECORDS"><InventoryPage service={catalog}/></Guard>}/>
    <Route path="/stock-count" element={<Guard permission="ADJUST_STOCK"><StockCountPage service={stockCount}/></Guard>}/>
    <Route path="/employees" element={<Guard permission="MANAGE_USERS"><EmployeesPage auth={auth}/></Guard>}/>
    <Route path="/settings" element={<Guard permission="MANAGE_SETTINGS"><ShopPage service={shops}/></Guard>}/>
    <Route path="/categories" element={<Guard permission="MANAGE_SETTINGS"><CategoriesPage service={categories}/></Guard>}/>
    <Route path="/recovery" element={<Guard permission="MANAGE_USERS"><RecoveryRoute/></Guard>}/>
    <Route path="/suppliers" element={<Guard permission="MANAGE_SUPPLIERS"><SuppliersPage service={purchasing}/></Guard>}/>
    <Route path="/purchases" element={<Guard permission="MANAGE_PURCHASES"><PurchasesPage service={purchasing} canReceive={auth.can('RECEIVE_GOODS')}/></Guard>}/>
    <Route path="/backups" element={<Guard permission="BACKUP_AND_RESTORE"><BackupPage service={backups}/></Guard>}/>
    <Route path="/reports" element={<Guard permission="VIEW_REPORTS"><ReportsPage service={reporting}/></Guard>}/>
    <Route path="/gst" element={<Guard permission="GST_REPORT"><GstReportPage service={reporting}/></Guard>}/>
    <Route path="/closing" element={<Guard permission="CLOSE_DAY"><DayEndPage service={dayEnd} user={user.name}/></Guard>}/>
    <Route path="/loyalty" element={<Guard permission="MANAGE_LOYALTY"><LoyaltySettingsPage service={loyalty}/></Guard>}/>
    <Route path="/activity" element={<Guard permission="VIEW_ACTIVITY_LOG"><ActivityLogPage service={activityLog}/></Guard>}/>
    <Route path="*" element={<section><h1>Page not found</h1><NavLink to="/">Return to overview</NavLink></section>}/>
  </Routes></main></div></HashRouter>;
}
