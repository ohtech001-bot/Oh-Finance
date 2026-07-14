import { Global, Module } from '@nestjs/common';
import { LedgerController } from './ledger.controller.js';
import { LedgerQueryService } from './ledger-query.service.js';
import { LedgerService } from './ledger.service.js';

/**
 * وحدة دفتر الحركات.
 *
 * `@Global` عمدًا: `LedgerService` هي الطريق الوحيد لكتابة قيد محاسبي،
 * وتحتاجها وحدات الزبائن والطلبات والدفعات. جعلها عامة يجنّبنا استيرادها
 * في كل وحدة — ويجعل من الواضح أنها بنية تحتية لا وحدة أعمال عادية.
 */
@Global()
@Module({
  controllers: [LedgerController],
  providers: [LedgerService, LedgerQueryService],
  exports: [LedgerService],
})
export class LedgerModule {}
