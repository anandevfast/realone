import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { JwtPayload } from './types/jwt-payload.type';
import { TypeConfigService } from 'src/config/typed-config.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: TypeConfigService,
  ) {}

  // TODO: เปลี่ยนเป็นเรียก UsersRepository จริง (Mongo/MySQL) ภายหลัง
  private async mockFindUserByEmail(email: string) {
    // ตัวอย่าง password hash (ห้าม hardcode ในโปรดจริง)
    const passwordHash = await bcrypt.hash('password123', 10);
    if (email !== 'admin@realsmart.co.th') return null;

    return {
      id: 'user_001',
      email,
      passwordHash,
      roles: ['admin'],
    };
  }
  async login(email: string, password: string) {
    const user = await this.mockFindUserByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
    };

    console.log('AUTH CONFIG =', this.config.auth);
    const { secret, expiresIn } = this.config.auth.jwt;
    const accessToken = await this.jwt.signAsync(payload, {
      secret,
      expiresIn,
    });

    return { accessToken };
  }
}
