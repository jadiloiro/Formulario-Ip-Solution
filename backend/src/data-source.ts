import 'dotenv/config';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './config/database.config';

/** DataSource standalone usado apenas pelo CLI do TypeORM (migration:generate/run/revert). */
export default new DataSource(buildDataSourceOptions());
