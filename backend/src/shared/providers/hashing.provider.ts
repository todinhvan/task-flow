import envConfig from '@/config';
import { Injectable } from '@nestjs/common';
import { compare, hash } from 'bcrypt';

@Injectable()
export class HashingProvider {
  hash(value: string) {
    return hash(value, envConfig.SaltRounds);
  }

  compare(value: string, hashedValue: string) {
    return compare(value, hashedValue);
  }
}
