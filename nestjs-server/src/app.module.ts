import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ValuesModule } from './values/values.module';
import { NotesModule } from './notes/notes.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.PGHOST || 'postgres',
      port: parseInt(process.env.PGPORT || '5432', 10),
      username: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'postgres_password',
      database: process.env.PGDATABASE || 'postgres',
      autoLoadEntities: true,
      synchronize: false,
    }),
    ValuesModule,
    NotesModule,
  ],
})
export class AppModule {}
