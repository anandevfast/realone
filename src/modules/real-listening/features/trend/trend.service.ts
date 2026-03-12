import { BadRequestException, Injectable } from '@nestjs/common';

import { TrendRepository } from '../../infrastructure/repositories/trend.repository';
import { TrendFilterDTO } from './dto/trend-filter.dto';
import { Metric } from '../../domain/social-enum';

@Injectable()
export class TrendService {
  constructor(private readonly trendRepository: TrendRepository) {}

  async query(dto: TrendFilterDTO) {
    try {
      if (dto.chartName) {
        return this.processChart(dto.chartName, dto);
      }
      return this.processAllCharts(dto);
    } catch (error: any) {
      throw new BadRequestException([error?.message ?? String(error)]);
    }
  }

  private async processChart(
    chartName: string,
    dto: TrendFilterDTO,
  ): Promise<any> {
    switch (chartName) {
      case 'shareSpeakerType':
        return this.getShareOfSpeakerType(dto);
      case 'shareIntent':
        return this.getShareOfIntent(dto);
      case 'hostagetop100':
        return this.trendRepository
          .getTop100Hashtags(dto)
          .then((r) => r.filter((item) => item.name !== '#'));
      case 'top100Words':
        return this.trendRepository
          .getTop100Words(dto)
          .then((r) => r.filter((item) => item.name !== '#'));
      case 'gender':
        return this.getGenderDemography(dto);
      case 'genderAge': {
        const [gender, genderAge] = await Promise.all([
          this.getGenderDemography(dto),
          this.getGenderAge(dto),
        ]);
        return { gender, genderAge };
      }
      default:
        return null;
    }
  }

  private async processAllCharts(dto: TrendFilterDTO): Promise<any> {
    const [
      speakerData,
      intentData,
      top100hasgtags,
      topWords,
      genderRaw,
      genderAgeRaw,
    ] = await Promise.all([
      this.trendRepository.getSpeakerTypeData(dto),
      this.trendRepository.getIntentData(dto),
      this.trendRepository.getTop100Hashtags(dto),
      this.trendRepository.getTop100Words(dto),
      this.trendRepository.getGenderData(dto),
      this.trendRepository.getGenderAgeData(dto),
    ]);

    return {
      shareOfSpeakerType: buildTypeChart(speakerData, dto),
      shareOfIntent: buildTypeChart(intentData, dto),
      top100hasgtags: top100hasgtags.filter((item) => item.name !== '#'),
      topWords: topWords.filter((item) => item.name !== '#'),
      gender: buildGenderResult(genderRaw),
      genderAge: buildGenderAgeResult(genderAgeRaw),
    };
  }

  private async getShareOfSpeakerType(dto: TrendFilterDTO): Promise<any> {
    const data = await this.trendRepository.getSpeakerTypeData(dto);
    return buildTypeChart(data, dto);
  }

  private async getShareOfIntent(dto: TrendFilterDTO): Promise<any> {
    const data = await this.trendRepository.getIntentData(dto);
    return buildTypeChart(data, dto);
  }

  private async getGenderDemography(dto: TrendFilterDTO): Promise<any> {
    const raw = await this.trendRepository.getGenderData(dto);
    return buildGenderResult(raw);
  }

  private async getGenderAge(dto: TrendFilterDTO): Promise<any> {
    const raw = await this.trendRepository.getGenderAgeData(dto);
    return buildGenderAgeResult(raw);
  }
}

/* =====================================================================
 * Trend Chart Processing Functions (pure, testable)
 * ===================================================================== */

export function buildTypeChart(data: any[], dto: TrendFilterDTO): any {
  const processedData = data.map((e) => ({ ...e, _id: e._id || 'none' }));

  const arr_mention = processedData.map((e) => e.mention);
  const arr_engagement = processedData.map((e) => e.totalEngagement);
  const arr_engagement_view = processedData.map((e) => e.engagementView);
  const arr_name = processedData.map((e) => e._id);

  const result: any = {
    y_axis: [{ name: 'mention', type: 'column', data: arr_mention }],
    x_axis: arr_name,
  };

  if (!dto.metric || dto.metric === 'mention' || dto.metric === 'engagement') {
    result.y_axis.push({
      name: 'engagement',
      type: 'spline',
      data: arr_engagement,
    });
  } else if (dto.metric === Metric.Engagement_View) {
    result.y_axis.push({
      name: 'engagement views',
      type: 'spline',
      data: arr_engagement_view,
    });
  }

  return result;
}

export function buildGenderResult(raw: any[]): any {
  const GENDERS = ['male', 'female', 'unknown'];
  const result: any = { data: [] };
  let sumValue = 0;

  for (const g of GENDERS) {
    const found = raw.find((r) => r.gender === g);
    const value = found?.value ?? 0;
    sumValue += value;
    result.data.push({ gender: g, value });
  }

  if (sumValue === 0) {
    result.percent_male = 0;
    result.percent_female = 0;
    result.percent_unknown = 0;
  } else {
    for (const item of result.data) {
      result[`percent_${item.gender}`] = parseFloat(
        ((item.value / sumValue) * 100).toFixed(2),
      ).toString();
    }
  }

  return result;
}

export function buildGenderAgeResult(raw: any[]): any {
  const AGE_CATEGORIES = [
    '11-20',
    '21-30',
    '31-40',
    '41-50',
    '51-60',
    '> 60',
    'unknown',
  ];
  const series = [
    { name: 'male', data: Array(AGE_CATEGORIES.length).fill(0) },
    { name: 'female', data: Array(AGE_CATEGORIES.length).fill(0) },
    { name: 'unknown', data: Array(AGE_CATEGORIES.length).fill(0) },
  ];

  for (const el of raw) {
    const idx = AGE_CATEGORIES.indexOf(el.ageRange);
    if (idx !== -1) {
      series[0].data[idx] = el.male ?? 0;
      series[1].data[idx] = el.female ?? 0;
      series[2].data[idx] = el.unknown ?? 0;
    }
  }

  const validIndices = AGE_CATEGORIES.map((_, i) =>
    series.some((s) => s.data[i] > 0) ? i : -1,
  ).filter((i) => i !== -1);

  return {
    xAxis: { categories: validIndices.map((i) => AGE_CATEGORIES[i]) },
    series: series.map((s) => ({
      name: s.name,
      data: validIndices.map((i) => s.data[i]),
    })),
  };
}
