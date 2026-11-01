import {PRODUCT_PHOTO_MIME,prepareProductPhoto} from '../domain/productPhotos';
import type {LocalDatabase} from '../infrastructure/localDatabase';

export class ProductPhotoService{
  constructor(private readonly db:LocalDatabase){}
  async save(file:File){const blob=await prepareProductPhoto(file),id=crypto.randomUUID();await this.db.saveProductPhoto(id,new Blob([blob],{type:PRODUCT_PHOTO_MIME}));return id;}
  load(id:string){return this.db.getProductPhoto(id);}
}
