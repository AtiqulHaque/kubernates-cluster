import { Controller, Get } from '@nestjs/common';
import { ValuesService } from './values.service';

@Controller()
export class ValuesController {
  constructor(private readonly valuesService: ValuesService) {}

  @Get()
  health() {
    return { status: 'ok', service: 'nestjs-server' };
  }

  @Get('values')
  findAll() {
    return this.valuesService.findAll();
  }
}
