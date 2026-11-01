export const PRODUCT_PHOTO_MAX_SIDE=800;
export const PRODUCT_PHOTO_MAX_BYTES=4*1024*1024;
export const PRODUCT_PHOTO_MIME='image/jpeg' as const;
export type StoredProductPhoto={id:string;blob:Blob};
export type PortableProductPhoto={id:string;mimeType:typeof PRODUCT_PHOTO_MIME;data:string};

export async function prepareProductPhoto(file:File):Promise<Blob>{
  if(!file.type.startsWith('image/'))throw new Error('Choose an image file.');
  let bitmap:ImageBitmap;try{bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});}catch{throw new Error('This image could not be opened.');}
  try{
    const scale=Math.min(1,PRODUCT_PHOTO_MAX_SIDE/Math.max(bitmap.width,bitmap.height)),width=Math.max(1,Math.round(bitmap.width*scale)),height=Math.max(1,Math.round(bitmap.height*scale));
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d');if(!context)throw new Error('Image processing is not available in this browser.');context.drawImage(bitmap,0,0,width,height);
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('This image could not be prepared.')),PRODUCT_PHOTO_MIME,0.82));
    if(blob.size>PRODUCT_PHOTO_MAX_BYTES)throw new Error('The prepared image is larger than 4 MB. Choose a smaller image.');return blob;
  }finally{bitmap.close();}
}

export function productPhotoUrl(photo:Blob){return URL.createObjectURL(photo);}
