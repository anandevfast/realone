import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';

import { MessagesModule } from './features/messages/messages.module';
import { AnalyticsModule } from './features/analytics/analytics.module';
import { SentimentModule } from './features/sentiment/sentiment.module';
import { InfluencerModule } from './features/influencer/influencer.module';
import { TrendModule } from './features/trend/trend.module';
import { TimeModule } from './features/time/time.module';
import { LocationModule } from './features/location/location.module';

const FEATURE_MODULES = [
  MessagesModule,
  AnalyticsModule,
  SentimentModule,
  InfluencerModule,
  TrendModule,
  TimeModule,
  LocationModule,
];

@Module({
  imports: [
    ...FEATURE_MODULES,
    RouterModule.register([
      {
        path: 'real-listening',
        module: RealListeningModule,
        children: FEATURE_MODULES.map((module) => ({
          path: '/',
          module,
        })),
      },
    ]),
  ],
})
export class RealListeningModule {}
