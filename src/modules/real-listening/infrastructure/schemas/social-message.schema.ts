import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type SocialMessageDocument = HydratedDocument<SocialMessage>;

@Schema({ _id: false })
export class RawContent {
  @Prop(String) source_id: string;
  @Prop(String) source_name: string;
  @Prop(Boolean) save_import: boolean;
  @Prop({ type: MongooseSchema.Types.Mixed }) data: any;
}

@Schema({
  collection: 'social_messages',
  timestamps: false,
})
export class SocialMessage {
  @Prop(String) dayOfWeek: string;
  @Prop(String) createdate: string;
  @Prop(Number) createdate_timestamp: number;
  @Prop(Date) createAtUnix: Date;
  @Prop(String) updatedate: string;
  @Prop(Number) updatedate_timestamp: number;

  @Prop({ type: String, index: true }) publisheddate: string;
  @Prop(Number) publisheddate_timestamp: number;

  @Prop({ type: String, default: 'show' }) visibility: string;
  @Prop({ type: String, default: 'none' }) status: string;

  @Prop({ type: String, index: 'hashed' }) code: string;
  @Prop(String) channel: string;
  @Prop({ type: MongooseSchema.Types.Mixed }) content: any;
  @Prop(Number) hour: number;
  @Prop(String) domain: string;
  @Prop({ type: String, default: 'unread' }) statusMessage: string;
  @Prop(String) intent: string;
  @Prop(String) speakerType: string;

  @Prop([String]) postFormat: string[];
  @Prop({ type: [String], index: true }) keywords: string[];
  @Prop([String]) sentiments: string[];
  @Prop([String]) tags: string[];
  @Prop([String]) keyword_sentiment: string[];
  @Prop([String]) keyword_tag: string[];
  @Prop([String]) sentiment_tag: string[];

  @Prop(Number) arukasScore: number;
  @Prop({ type: MongooseSchema.Types.Mixed }) sendTo: any;
  @Prop([]) logEngagement: any[];
  @Prop([]) engagementOvertime: any[];
  @Prop(Number) totalEngagement: number;
  @Prop(Number) totalView: number;
  @Prop(String) trackingPost: string;

  @Prop([]) source: any[];
  @Prop([]) prnews: any[];
  @Prop(Boolean) isMention: boolean;
  @Prop(Boolean) isBrandOwner: boolean;
  @Prop([]) issues: any[];

  @Prop([String]) prTags: string[];
  @Prop(String) prSentiment: string;
  @Prop([String]) tagsPr: string[];
  @Prop({ type: String, default: 'show' }) prVisibility: string;
  @Prop({ type: String, default: 'unread' }) prStatusMessage: string;

  @Prop({ type: [String], index: true }) account_ids: string[];
  @Prop(Number) follower: number;
  @Prop(String) provinceName: string;
  @Prop({ type: MongooseSchema.Types.Mixed }) place: any;
  @Prop(Number) yearNow: number;
  @Prop(String) pageName: string;

  @Prop([String]) highlight_keyword: string[];
  @Prop([String]) highlight_junk_keyword: string[];

  @Prop({ type: Date, index: true }) publishedAtUnix: Date;

  @Prop([]) rptnews: any[];
  @Prop(Boolean) isRptMention: boolean;
  @Prop(Boolean) isRptBrandOwner: boolean;
  @Prop([]) rptissues: any[];
  @Prop([String]) rptTags: string[];
  @Prop(String) rptSentiment: string;
  @Prop([String]) tagsRpt: string[];
  @Prop({ type: String, default: 'show' }) rptVisibility: string;
  @Prop({ type: String, default: 'unread' }) rptStatusMessage: string;

  @Prop({ type: RawContent }) rawContent: RawContent;
  @Prop({ type: MongooseSchema.Types.Mixed }) center_data: any;
}

export const SocialMessageSchema = SchemaFactory.createForClass(SocialMessage);

// SocialMessageSchema.index({ publishedAtUnix: -1 });
// SocialMessageSchema.index({ publishedAtUnix: 1, account_ids: 1 });
// SocialMessageSchema.index({ publishedAtUnix: 1, keywords: 1 });
// SocialMessageSchema.index({ publishedAtUnix: -1, account_ids: 1 });
// SocialMessageSchema.index({ publishedAtUnix: -1, keywords: 1 });
