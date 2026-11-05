import {Link} from 'react-router-dom';
import type {Permission} from '../domain/access';
import {Icon,type IconName} from './icons';

type Tile=[to:string,title:string,detail:string,icon:IconName,permission:Permission|null];
const GROUPS:[string,Tile[]][]=[
  ['Store',[
    ['/settings','Settings','Store details, tax, receipts, credit rules and printing.','more','MANAGE_SETTINGS'],
    ['/categories','Product categories','Turn categories on or off and manage sub-categories.','layers','MANAGE_SETTINGS'],
    ['/backups','Backups','Create, schedule and restore encrypted backups.','cloud','BACKUP_AND_RESTORE']
  ]],
  ['Stock tools',[
    ['/products','Products','Add and edit products, variants, prices and barcodes.','box','MANAGE_PRODUCTS'],
    ['/products/import','Import products','Bring in a product list from a CSV file.','upload','MANAGE_PRODUCTS'],
    ['/inventory','Stock adjustments','Receive stock, record damage and correct counts.','layers','VIEW_STOCK_RECORDS'],
    ['/stock-count','Stock count','Count shelves and post the differences.','clipboard','ADJUST_STOCK'],
    ['/purchases','Purchases','Purchase orders and goods received from suppliers.','truck','MANAGE_PURCHASES']
  ]],
  ['Customers',[
    ['/loyalty','Customer loyalty','Points earned on sales and how they are redeemed.','gift','MANAGE_LOYALTY']
  ]],
  ['Security',[
    ['/quick-unlock','Quick unlock','Set a PIN to open AUXO on this device.','key',null],
    ['/recovery','Recovery code','Create a new recovery code for the Super Admin.','shield','MANAGE_USERS'],
    ['/employees','Staff accounts','Add staff and choose what each person can do.','people','MANAGE_USERS']
  ]]
];

export function MorePage({can}:{can:(permission:Permission)=>boolean}){
  return <section className="page-section more-page"><h1 className="sr-only">More</h1>
    {GROUPS.map(([group,tiles])=>{const visible=tiles.filter(tile=>tile[4]===null||can(tile[4]));if(!visible.length)return null;return <div key={group} className="more-group"><h2 className="section-label">{group}</h2><div className="more-grid">{visible.map(([to,title,detail,icon])=><Link key={to} to={to} className="more-tile"><span className="more-icon"><Icon name={icon} size={22}/></span><span><strong>{title}</strong><small>{detail}</small></span><Icon name="chevronRight" size={18} className="more-arrow"/></Link>)}</div></div>;})}
  </section>;
}
