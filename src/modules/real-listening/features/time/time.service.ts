import { BadRequestException, Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
dayjs.extend(isoWeek);

import { TimeRepository, TimeRawItem } from '../../infrastructure/repositories/time.repository';
import { TimeFilterDTO } from './dto/time-filter.dto';

@Injectable()
export class TimeService {
  constructor(private readonly timeRepository: TimeRepository) {}

  async query(dto: TimeFilterDTO) {
    try {
      const rawData = await this.timeRepository.getTimeData(dto);

      if (dto.chartName) {
        return this.processChart(dto.chartName, rawData, dto);
      }
      return this.processAllCharts(rawData, dto);
    } catch (error: any) {
      throw new BadRequestException([error?.message ?? String(error)]);
    }
  }

  private processChart(chartName: string, data: TimeRawItem[], dto: TimeFilterDTO): any {
    switch (chartName) {
      case 'volumeBytime':
        return volumeByTimeChart(data, dto);
      case 'volumeByday':
        return volumeByDayChart(data, dto);
      case 'volumeByday&time':
        return volumeByDayAndTimeChart(data, dto);
      case 'heatmapBytime':
        return heatmapByTimeChart(data, dto);
      case 'heatmapByday':
        return heatmapByDayChart(data, dto);
      default:
        return null;
    }
  }

  private processAllCharts(data: TimeRawItem[], dto: TimeFilterDTO): any {
    return {
      volumeBytime: volumeByTimeChart(data, dto),
      volumeByday: volumeByDayChart(data, dto),
      heatmapByday: heatmapByDayChart(data, dto),
      heatmapBytime: heatmapByTimeChart(data, dto),
      volumeByDayAndTime: volumeByDayAndTimeChart(data, dto),
    };
  }
}

/* =====================================================================
 * Time Chart Processing Functions (pure, testable)
 * ===================================================================== */

const ALL_HOURS = ['00','01','02','03','04','05','06','07','08','09','10','11',
  '12','13','14','15','16','17','18','19','20','21','22','23'];
const ALL_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getKeywordsFromTimeData(data: TimeRawItem[], dto: TimeFilterDTO): string[] {
  const all = [...new Set(data.map((d) => d._id.keywords).filter(Boolean))];
  return dto.keywords?.length ? dto.keywords.filter((k) => all.includes(k)) : all;
}

function getFilterHours(dto: TimeFilterDTO): number[] {
  return ALL_HOURS.map((_, i) => i);
}

export function volumeByTimeChart(data: TimeRawItem[], dto: TimeFilterDTO): any {
  const keywords = getKeywordsFromTimeData(data, dto);
  const filterHours = getFilterHours(dto);
  const counts = Array(24).fill(0);

  for (const item of data) {
    const hour = item._id.hour;
    if (!filterHours.includes(+hour)) continue;
    if (!keywords.includes(item._id.keywords)) continue;
    counts[hour] += item.count;
  }

  const series = [{ name: 'volumeBytime', data: counts }];
  const filteredSeries = series.filter((s) => !s.data.every((d) => d === 0));
  return { series: filteredSeries, xAxis: { categories: ALL_HOURS } };
}

export function volumeByDayChart(data: TimeRawItem[], dto: TimeFilterDTO): any {
  const keywords = getKeywordsFromTimeData(data, dto);
  const filterHours = getFilterHours(dto);
  const counts = Array(7).fill(0);

  for (const item of data) {
    const hour = item._id.hour;
    if (!filterHours.includes(+hour)) continue;
    if (!keywords.includes(item._id.keywords)) continue;

    let day = dayjs(item._id.date).isoWeekday();
    if (day === 7) day = 0;
    counts[day] += item.count;
  }

  const series = [{ name: 'volumeByday', data: counts }];
  const filteredSeries = series.filter((s) => !s.data.every((d) => d === 0));
  return { series: filteredSeries, xAxis: { categories: ALL_DAYS } };
}

export function heatmapByDayChart(data: TimeRawItem[], dto: TimeFilterDTO): any {
  const keywords = getKeywordsFromTimeData(data, dto);
  const filterHours = getFilterHours(dto);

  const seriesData = keywords.map((keyword) => {
    const dayCounts = Array(7).fill(0);
    for (const item of data) {
      if (item._id.keywords !== keyword) continue;
      if (!filterHours.includes(+item._id.hour)) continue;
      let day = dayjs(item._id.date).isoWeekday();
      if (day === 7) day = 0;
      dayCounts[day] += item.count;
    }
    return { name: keyword, fullLabel: keyword, data: dayCounts };
  });

  const filteredSeries = seriesData.filter((s) => !s.data.every((d) => d === 0));
  return { series: filteredSeries, xAxis: { categories: ALL_DAYS } };
}

export function heatmapByTimeChart(data: TimeRawItem[], dto: TimeFilterDTO): any {
  const keywords = getKeywordsFromTimeData(data, dto);
  const filterHours = getFilterHours(dto);

  const seriesData = keywords.map((keyword) => {
    const hourCounts = Array(24).fill(0);
    for (const item of data) {
      if (item._id.keywords !== keyword) continue;
      const hour = +item._id.hour;
      if (!filterHours.includes(hour)) continue;
      hourCounts[hour] += item.count;
    }
    return { name: keyword, fullLabel: keyword, data: hourCounts };
  });

  const filteredSeries = seriesData.filter((s) => !s.data.every((d) => d === 0));
  return { series: filteredSeries, xAxis: { categories: ALL_HOURS } };
}

export function volumeByDayAndTimeChart(data: TimeRawItem[], dto: TimeFilterDTO): any {
  const keywords = getKeywordsFromTimeData(data, dto);
  const filterHours = getFilterHours(dto);

  const heatmapData: { x: number; y: number; value: number }[] = [];

  for (const item of data) {
    if (!keywords.includes(item._id.keywords)) continue;
    const hour = +item._id.hour;
    if (!filterHours.includes(hour)) continue;
    let day = dayjs(item._id.date).isoWeekday();
    if (day === 7) day = 0;

    const existing = heatmapData.find((d) => d.x === hour && d.y === day);
    if (existing) {
      existing.value += item.count;
    } else {
      heatmapData.push({ x: hour, y: day, value: item.count });
    }
  }

  return {
    data: heatmapData,
    xAxis: { categories: ALL_HOURS },
    yAxis: { categories: ALL_DAYS },
  };
}
