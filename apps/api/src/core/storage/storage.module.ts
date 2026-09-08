import { Global, Module } from '@nestjs/common';
import { StoreLogoStorageService } from './store-logo-storage.service.js';

@Global()
@Module({
  providers: [StoreLogoStorageService],
  exports: [StoreLogoStorageService],
})
export class StorageModule {}
