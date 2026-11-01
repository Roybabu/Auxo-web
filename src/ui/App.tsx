import { HashRouter, NavLink, Route, Routes } from 'react-router-dom';
import { ShopService } from '../application/shopService';
import { CatalogService } from '../application/catalogService';
import { SalesService } from '../application/salesService';
import { LocalDatabase } from '../infrastructure/localDatabase';
import { reports } from '../domain/reports';
import { Pending, Table } from './primitives';
import { ShopPage } from './ShopPage';
import { InventoryPage, ProductsPage } from './CatalogPages';
import { SalesPage } from './SalesPage';
import { CustomerAccountsPage } from './CustomerAccountsPage';
const database = new LocalDatabase();
const service = new ShopService(database);
const catalog = new CatalogService(database);
const sales = new SalesService(database,database);
const modules = [['pos','POS billing'],['restaurant','Restaurant'],['products','Products'],['inventory','Inventory'],['customers','Customers'],['suppliers','Suppliers'],['purchases','Purchases'],['gst','GST reports'],['closing','Day-end closing'],['employees','Employees'],['backups','Backups']] as const;
export default function App() {
  return <HashRouter><div className="workspace"><aside><strong>AUXO</strong><span className="edition">Genesis · functional skeleton</span><nav aria-label="Main navigation">
    <NavLink to="/" end>Overview</NavLink>{modules.map(([path,label])=><NavLink key={path} to={`/${path}`}>{label}</NavLink>)}
    <NavLink to="/reports">Reports</NavLink><NavLink to="/settings">Settings</NavLink>
  </nav></aside><main><Routes>
    <Route path="/" element={<section><h1>AUXO Web</h1><p>A fresh workspace for your business.</p><p>This is the first foundation build. Business settings can be saved locally. Billing and the other modules are not available yet.</p><NavLink className="action" to="/settings">Set up store details</NavLink></section>}/>
    {modules.filter(([path])=>path!=='products'&&path!=='inventory'&&path!=='pos'&&path!=='customers').map(([path,label])=><Route key={path} path={`/${path}`} element={<Pending title={label}/>}/>)}
    <Route path="/pos" element={<SalesPage sales={sales} shops={service}/>}/>
    <Route path="/customers" element={<CustomerAccountsPage sales={sales}/>}/>
    <Route path="/products" element={<ProductsPage service={catalog}/>}/>
    <Route path="/inventory" element={<InventoryPage service={catalog}/>}/>
    <Route path="/settings" element={<ShopPage service={service}/>}/>
    <Route path="/reports" element={<section><h1>Reports</h1><p>The 13 Android reports are listed below. Report calculations and exports are not implemented yet.</p><Table headings={['Report','Scope','Availability']}>{reports.map(([id,label,period])=><tr key={id}><td>{label}</td><td>{period?'Date range':'Current position'}</td><td>Not implemented</td></tr>)}</Table></section>}/>
    <Route path="*" element={<section><h1>Page not found</h1><NavLink to="/">Return to overview</NavLink></section>}/>
  </Routes></main></div></HashRouter>;
}
