import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'lia-api',
      timestamp: new Date().toISOString()
    };
  }
}
