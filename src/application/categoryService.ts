import type {ProductCategory} from '../domain/catalog';
import type {ShopCategory} from '../domain/categories';
import type {AuthService} from './authService';
import type {LocalDatabase} from '../infrastructure/localDatabase';
export class CategoryService{
 constructor(private readonly db:LocalDatabase,private readonly auth:AuthService){}
 async list(){await this.auth.require('MANAGE_SETTINGS');return this.db.listCategories();}
 async needsSetup(){await this.auth.require('MANAGE_SETTINGS');return this.db.needsCategorySetup();}
 async applySetup(enabledIds:Set<string>){await this.auth.require('MANAGE_SETTINGS');return this.db.applyCategorySetup(enabledIds,this.auth.getSnapshot());}
 async add(name:string,profile:ProductCategory){await this.auth.require('MANAGE_SETTINGS');return this.db.addCategory(name,profile,this.auth.getSnapshot());}
 async rename(id:string,name:string){await this.auth.require('MANAGE_SETTINGS');return this.db.renameCategory(id,name,this.auth.getSnapshot());}
 async setEnabled(id:string,enabled:boolean){await this.auth.require('MANAGE_SETTINGS');return this.db.setCategoryEnabled(id,enabled,this.auth.getSnapshot());}
 async remove(id:string){await this.auth.require('MANAGE_SETTINGS');return this.db.deleteCategory(id,this.auth.getSnapshot());}
 async addSubcategory(categoryId:string,name:string){await this.auth.require('MANAGE_SETTINGS');return this.db.addSubcategory(categoryId,name,this.auth.getSnapshot());}
 async renameSubcategory(categoryId:string,subcategoryId:string,name:string){await this.auth.require('MANAGE_SETTINGS');return this.db.renameSubcategory(categoryId,subcategoryId,name,this.auth.getSnapshot());}
 async removeSubcategory(categoryId:string,subcategoryId:string){await this.auth.require('MANAGE_SETTINGS');return this.db.deleteSubcategory(categoryId,subcategoryId,this.auth.getSnapshot());}
}
