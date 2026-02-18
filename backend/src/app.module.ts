import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ImportsModule } from './imports/imports.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'postgres', // Name of the docker container
      port: 5432,
      username: 'dev',
      password: 'dev',
      database: 'csv_import',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      autoLoadEntities: true,
      synchronize: true,
    }),
    ImportsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
