import { Global, Module } from '@nestjs/common';
import { NumberingService } from './numbering.service.js';

@Global()
@Module({
  providers: [NumberingService],
  exports: [NumberingService],
})
export class NumberingModule {}
