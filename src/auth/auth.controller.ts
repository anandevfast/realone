import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { LoginDTO } from './dto/login.dto';
import { RateLimit } from 'src/core/rate-limit/rate-limit.decorator';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDTO) {
    return this.auth.login(dto.email, dto.password);
  }

  @Get('me')
  @RateLimit({ limit: 10, window: 60 })
  async me(@Req() req: any) {
    return req.user;
  }
}
