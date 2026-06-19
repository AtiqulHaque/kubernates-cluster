import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class ValuesService {
  constructor(@InjectDataSource() private dataSource: DataSource) {}

  async findAll() {
    return this.dataSource.query(
      'SELECT number FROM values ORDER BY number ASC',
    );
  }
}
