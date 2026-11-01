import {useEffect,useState} from 'react';
import type {ProductPhotoService} from '../application/productPhotoService';
import {productPhotoUrl} from '../domain/productPhotos';

export function ProductPhotoField({label,value,photos,onChange}:{label:string;value:string|null|undefined;photos:ProductPhotoService;onChange:(id:string|null)=>void}){
  const [url,setUrl]=useState(''),[error,setError]=useState('');
  useEffect(()=>{let active=true,created='';if(value)void photos.load(value).then(blob=>{if(active&&blob){created=productPhotoUrl(blob);setUrl(created);}else if(active)setUrl('');}).catch(()=>active&&setUrl(''));else setUrl('');return()=>{active=false;if(created)URL.revokeObjectURL(created);};},[value,photos]);
  async function choose(file:File|null){if(!file)return;setError('');try{onChange(await photos.save(file));}catch(e){setError(e instanceof Error?e.message:'Could not save this image.');}}
  return <div className="product-photo-field"><label>{label}<input type="file" accept="image/*" onChange={e=>{const file=e.target.files?.[0]??null;e.target.value='';void choose(file);}}/></label>{url&&<img className="product-photo-preview" src={url} alt={`${label} preview`}/>}{value&&<button type="button" className="secondary" onClick={()=>{setError('');onChange(null);}}>Remove image</button>}{error&&<small className="error" role="alert">{error}</small>}</div>;
}

export function ProductPhotoThumb({photoId,photos,alt='Product photo'}:{photoId?:string|null;photos:ProductPhotoService;alt?:string}){
  const [url,setUrl]=useState('');
  useEffect(()=>{let active=true,created='';if(photoId)void photos.load(photoId).then(blob=>{if(active&&blob){created=productPhotoUrl(blob);setUrl(created);}else if(active)setUrl('');}).catch(()=>active&&setUrl(''));else setUrl('');return()=>{active=false;if(created)URL.revokeObjectURL(created);};},[photoId,photos]);
  return url?<img className="product-photo-thumb" src={url} alt={alt}/>:null;
}
