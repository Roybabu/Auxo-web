import {useEffect,useRef,useState} from 'react';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import type {InvoiceRecord} from '../domain/billing';
import {formatMoney} from '../domain/money';
import type {ReceiptLanguage,ReceiptPaper} from '../domain/shop';
import type {ProductPhotoService} from '../application/productPhotoService';
import {productPhotoUrl} from '../domain/productPhotos';

const words:Record<ReceiptLanguage,Record<string,string>>={
  en:{invoice:'Invoice',credit:'Credit note',date:'Date',customer:'Customer',item:'Item',qty:'Qty',rate:'Rate',amount:'Amount',subtotal:'Subtotal',discount:'Discount',taxable:'Taxable value',cgst:'CGST',sgst:'SGST',igst:'IGST',total:'Grand total',payments:'Payment',savings:'You saved',returnOf:'Return of'},
  hi:{invoice:'बिल',credit:'क्रेडिट नोट',date:'तारीख',customer:'ग्राहक',item:'वस्तु',qty:'मात्रा',rate:'दर',amount:'राशि',subtotal:'उप-योग',discount:'छूट',taxable:'कर योग्य राशि',cgst:'सीजीएसटी',sgst:'एसजीएसटी',igst:'आईजीएसटी',total:'कुल राशि',payments:'भुगतान',savings:'आपकी बचत',returnOf:'वापसी'},
  bn:{invoice:'বিল',credit:'ক্রেডিট নোট',date:'তারিখ',customer:'গ্রাহক',item:'পণ্য',qty:'পরিমাণ',rate:'দর',amount:'টাকা',subtotal:'উপমোট',discount:'ছাড়',taxable:'করযোগ্য মূল্য',cgst:'সিজিএসটি',sgst:'এসজিএসটি',igst:'আইজিএসটি',total:'মোট',payments:'পেমেন্ট',savings:'আপনার সাশ্রয়',returnOf:'ফেরত'},
  as:{invoice:'বিল',credit:'ক্ৰেডিট নোট',date:'তাৰিখ',customer:'গ্ৰাহক',item:'সামগ্ৰী',qty:'পৰিমাণ',rate:'দৰ',amount:'মূল্য',subtotal:'উপ-মুঠ',discount:'ৰেহাই',taxable:'কৰযোগ্য মূল্য',cgst:'চিজিএছটি',sgst:'এছজিএছটি',igst:'আইজিএছটি',total:'মুঠ',payments:'পৰিশোধ',savings:'আপোনাৰ সঞ্চয়',returnOf:'ঘূৰাই দিয়া'},
};

export function ReceiptPrint({invoice,photos}:{invoice:InvoiceRecord;photos?:ProductPhotoService}){
  const options=invoice.seller.receipt??{paper:'THERMAL_80' as ReceiptPaper,footer:'Thank you for shopping with us!',showHsn:true,showTaxBreakup:true,showCustomer:true,showSavings:true,showBarcode:true,showUpiQr:true,language:'en' as ReceiptLanguage};
  const text=words[options.language]??words.en;
  const barcode=useRef<SVGSVGElement|null>(null);
  const [qr,setQr]=useState('');
  const [logoUrl,setLogoUrl]=useState('');
  const isReturn=invoice.type==='RETURN';
  const upiUri=invoice.seller.upiId&&!isReturn?`upi://pay?${new URLSearchParams({pa:invoice.seller.upiId,pn:invoice.seller.upiPayeeName||invoice.seller.storeName,am:(Number(invoice.grandTotalPaise)/100).toFixed(2),cu:'INR',tn:`Invoice ${invoice.number}`})}`:'';
  useEffect(()=>{if(!options.showBarcode||!barcode.current)return;try{JsBarcode(barcode.current,invoice.number,{format:'CODE128',displayValue:true,fontSize:11,margin:2,height:35});}catch{barcode.current.replaceChildren();}},[invoice.number,options.showBarcode]);
  useEffect(()=>{let live=true;if(upiUri&&options.showUpiQr)QRCode.toDataURL(upiUri,{width:180,margin:1}).then(value=>{if(live)setQr(value);}).catch(()=>{if(live)setQr('');});else setQr('');return()=>{live=false;};},[upiUri,options.showUpiQr]);
  useEffect(()=>{let live=true,created='';const id=invoice.seller.storeLogoPhotoId;if(id&&photos)void photos.load(id).then(blob=>{if(live&&blob){created=productPhotoUrl(blob);setLogoUrl(created);}else if(live)setLogoUrl('');}).catch(()=>live&&setLogoUrl(''));else setLogoUrl('');return()=>{live=false;if(created)URL.revokeObjectURL(created);};},[invoice.seller.storeLogoPhotoId,photos]);
  const showCustomer=options.showCustomer&&invoice.customer;
  const savings=BigInt(invoice.discountPaise||'0');
  return <article className={`receipt-print-output receipt-paper-${options.paper}`}>
    <header>{logoUrl&&<img className="store-logo-print" src={logoUrl} alt={`${invoice.seller.storeName} logo`}/>}<h1>{invoice.seller.storeName}</h1>{invoice.seller.address&&<div>{invoice.seller.address}</div>}{invoice.seller.phone&&<div>{invoice.seller.phone}</div>}{invoice.seller.gstin&&<div>GSTIN: {invoice.seller.gstin}</div>}{invoice.seller.fssai&&<div>FSSAI: {invoice.seller.fssai}</div>}</header>
    <hr/><h2>{isReturn?text.credit:text.invoice} {invoice.number}</h2><div>{text.date}: {new Date(invoice.createdAt).toLocaleString()}</div>{invoice.originalInvoiceNumber&&<div>{text.returnOf}: {invoice.originalInvoiceNumber}</div>}
    {showCustomer&&<div>{text.customer}: {invoice.customer!.name}{invoice.customer!.phone?` · ${invoice.customer!.phone}`:''}</div>}
    <table><thead><tr><th>{text.item}{options.showHsn?' / HSN':''}</th><th>{text.qty}</th><th>{text.rate}</th><th>{text.amount}</th></tr></thead><tbody>{invoice.lines.map((line,index)=><tr key={`${line.productId}-${index}`}><td>{line.name}{line.variantLabel?` · ${line.variantLabel}`:''}{options.showHsn&&line.hsnCode?` · ${line.hsnCode}`:''}</td><td>{line.quantity}</td><td>{formatMoney(BigInt(line.unitPricePaise))}</td><td>{formatMoney(BigInt(line.totalPaise))}</td></tr>)}</tbody></table>
    <section className="receipt-totals"><div><span>{text.subtotal}</span><b>{formatMoney(BigInt(invoice.subtotalPaise))}</b></div>{savings>0n&&<div><span>{text.discount}</span><b>{formatMoney(savings)}</b></div>}{options.showSavings&&savings>0n&&<div><span>{text.savings}</span><b>{formatMoney(savings)}</b></div>}{options.showTaxBreakup&&<><div><span>{text.taxable}</span><b>{formatMoney(BigInt(invoice.taxablePaise))}</b></div>{BigInt(invoice.cgstPaise)!==0n&&<div><span>{text.cgst}</span><b>{formatMoney(BigInt(invoice.cgstPaise))}</b></div>}{BigInt(invoice.sgstPaise)!==0n&&<div><span>{text.sgst}</span><b>{formatMoney(BigInt(invoice.sgstPaise))}</b></div>}{BigInt(invoice.igstPaise)!==0n&&<div><span>{text.igst}</span><b>{formatMoney(BigInt(invoice.igstPaise))}</b></div>}</>}<div className="receipt-grand-total"><span>{text.total}</span><b>{formatMoney(BigInt(invoice.grandTotalPaise))}</b></div></section>
    <div>{text.payments}: {invoice.payments.map(payment=>`${payment.method} ${formatMoney(BigInt(payment.amountPaise))}`).join(' · ')||'—'}</div>
    {options.showBarcode&&<svg className="receipt-barcode" ref={barcode} aria-label={`Invoice barcode ${invoice.number}`}/>}
    {upiUri&&options.showUpiQr&&qr&&<div className="receipt-qr"><img src={qr} alt={`UPI payment QR for ${formatMoney(BigInt(invoice.grandTotalPaise))}`}/><small>Scan to pay {formatMoney(BigInt(invoice.grandTotalPaise))}</small></div>}
    {options.footer&&<footer>{options.footer}</footer>}
  </article>;
}
