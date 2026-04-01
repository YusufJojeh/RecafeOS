import { Module } from '@nestjs/common';
import { BranchCustomersController } from './branch-customers.controller';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

@Module({
  controllers: [CustomersController, BranchCustomersController],
  providers: [CustomersService],
})
export class CustomersModule {}
