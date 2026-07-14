import { Module } from '@nestjs/common';
import { OrderCalculator } from './order-calculator.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, OrderCalculator],
  exports: [OrdersService, OrderCalculator],
})
export class OrdersModule {}
