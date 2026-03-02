import { Module } from '@nestjs/common';

import { PublisherQueryController } from './controllers/publisher-query.controller';
// import { PublisherBookmarkController } from './controllers/publisher-bookmark.controller';
// import { SummaryController } from './controllers/summary.controller';
// import { TemplateController } from './controllers/template.controller';
// import { TagController } from './controllers/tag.controller';
// import { AiController } from './controllers/ai.controller';
// import { SystemController } from './controllers/system.controller';

import { PublisherQueryService } from './services/publisher-query.service';
// import { PublisherBookmarkService } from './services/publisher-bookmark.service';
// import { SummaryService } from './services/summary.service';
// import { TemplateService } from './services/template.service';
// import { TagService } from './services/tag.service';
// import { AiService } from './services/ai.service';
// import { SystemService } from './services/system.service';

@Module({
  controllers: [
    PublisherQueryController,
    // PublisherBookmarkController,
    // SummaryController,
    // TemplateController,
    // TagController,
    // AiController,
    // SystemController,
  ],
  providers: [
    PublisherQueryService,
    // PublisherBookmarkService,
    // SummaryService,
    // TemplateService,
    // TagService,
    // AiService,
    // SystemService,
  ],
})
export class RealMediaModule {}
