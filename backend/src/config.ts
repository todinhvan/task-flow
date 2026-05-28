import { Logger } from '@nestjs/common';
import { validateSync } from 'class-validator';
import 'dotenv/config';
import fs from 'fs';
import { BaseConfiguration } from './shared/configurations/base.config';

if (!fs.existsSync('.env')) {
  Logger.error('.env file is missing.');
  process.exit(1);
}

class Configuration extends BaseConfiguration {}

const envConfig = new Configuration();

const errors = validateSync(envConfig);
if (errors.length > 0) {
  Logger.error('Configuration validation failed. Please check the following errors:');
  Logger.error(errors.map((error) => Object.values(error.constraints || {}).join(', ')));
  process.exit(1);
}

export default envConfig;
