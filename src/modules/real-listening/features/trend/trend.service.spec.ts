import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { TrendService } from './trend.service';
import { TrendRepository } from '../../infrastructure/repositories/trend.repository';
import { TrendFilterDTO } from './dto/trend-filter.dto';

function buildService(mockData: {
  top100domain?: any[];
  throwOn?: 'top100domain';
}) {
  const repo = {
    getTop100Domain: jest.fn().mockImplementation(async () => {
      if (mockData.throwOn === 'top100domain') {
        throw new Error('top100domain-failed');
      }
      return mockData.top100domain ?? [];
    }),
  } as unknown as TrendRepository;

  return new TrendService(repo);
}

const BASE_DTO: Partial<TrendFilterDTO> = {
  startDate: '2026-03-04T00:00:00+07:00',
  endDate: '2026-03-04T23:59:59+07:00',
  condition: 'or' as any,
  email: 'test@example.com',
};

describe('TrendService – query()', () => {
  it('returns top100domain when chartName is provided', async () => {
    const data = [{ name: 'a.com', value: 10, channel: 'facebook' }];
    const svc = buildService({ top100domain: data });

    const dto = { ...BASE_DTO, chartName: 'top100domain' } as TrendFilterDTO;
    const result = await svc.query(dto);

    expect(result).toEqual(data);
  });

  it('wraps repository errors in BadRequestException', async () => {
    const svc = buildService({ throwOn: 'top100domain' });
    const dto = { ...BASE_DTO, chartName: 'top100domain' } as TrendFilterDTO;

    await expect(svc.query(dto)).rejects.toBeInstanceOf(BadRequestException);
  });
});
