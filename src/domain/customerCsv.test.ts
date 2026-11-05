import {describe,expect,it} from 'vitest';
import {customersCsv,previewCustomerCsv} from './customerCsv';
import type {BillingCustomer} from './billing';

const amit:BillingCustomer={id:'c1',name:'Amit Kumar',phone:'+91 98765 43210',email:null,gstin:null,stateCode:null,address:'12, MG Road',notes:null,creditLimitPaise:'2500000',balancePaise:'650000',onHold:false,createdAt:0};
describe('customer CSV',()=>{
  it('exports readable rows with outstanding and last purchase',()=>{const csv=customersCsv([amit],new Map([['c1',new Date(2026,10,4,12).getTime()]]));const [head,row]=csv.trim().split('\r\n');expect(head).toBe('name,phone,email,gstin,state_code,address,notes,credit_limit,opening_balance,outstanding,last_purchase');expect(row).toBe(`Amit Kumar,"'+91 98765 43210",,,,"12, MG Road",,25000.00,,6500.00,2026-11-04`);});
  it('reads common column names, skips duplicates by phone and flags missing names',()=>{const rows=previewCustomerCsv('Customer Name,Mobile,Credit Limit,Opening Balance\nNeha Traders,9845011223,"50,000",21300\nAmit again,9876543210,,\n,999,,\nNeha Traders,98450 11223,,',[amit]);expect(rows.map(r=>[r.row,r.draft?.name,r.duplicate??false,!!r.issue])).toEqual([[2,'Neha Traders',false,false],[3,'Amit again',true,false],[4,undefined,false,true],[5,'Neha Traders',true,false]]);expect(rows[0]!.draft).toMatchObject({phone:'9845011223',creditLimit:'50000',openingBalance:'21300'});});
  it('round-trips its own export',()=>{const rows=previewCustomerCsv(customersCsv([amit],new Map()),[]);expect(rows[0]!.draft).toMatchObject({name:'Amit Kumar',phone:'+91 98765 43210',address:'12, MG Road',creditLimit:'25000.00'});});
});
