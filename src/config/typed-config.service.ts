import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TypeConfigService {
  constructor(private readonly config: ConfigService) {}

  get app() {
    return this.config.get('app', { infer: true });
  }

  get auth() {
    return this.config.get('auth', { infer: true });
  }

  get database() {
    return this.config.get('database', { infer: true });
  }

  get integration() {
    return this.config.get('integration', { infer: true });
  }

  get crawling() {
    return this.config.get('crawling', { infer: true });
  }

  get business() {
    return this.config.get('business', { infer: true });
  }

  get cache() {
    return this.config.get('cache', { infer: true });
  }
}
