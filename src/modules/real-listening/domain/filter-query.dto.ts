import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsString,
} from 'class-validator';
import {
  AiDetect,
  ConditionTemplate,
  FavoriteMessage,
  Intent,
  Language,
  PostFormat,
  Sentiment,
  SortBy,
  Source,
  SpeakerType,
  StatusMessage,
  TrackingPost,
  Visibility,
} from './social-enum';

export class FilterQueryDTO {
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @IsArray()
  channel: string[];

  @IsArray()
  keywords: string[];

  @IsArray()
  tags: string[];

  @IsString()
  metric: string;

  @IsArray()
  @IsEnum(SortBy)
  sortBy: SortBy;

  @IsArray()
  @IsEnum(ConditionTemplate)
  condition: ConditionTemplate[];

  @IsArray()
  @IsEnum(Sentiment, { each: true })
  sentiment: Sentiment[];

  @IsArray()
  @IsEnum(StatusMessage, { each: true })
  statusMessage: StatusMessage[];

  @IsArray()
  @IsEnum(Visibility, { each: true })
  visibility: Visibility[];

  @IsArray()
  @IsEnum(Source, { each: true })
  source: Source[];

  @IsArray()
  @IsEnum(FavoriteMessage, { each: true })
  favoriteMessage: FavoriteMessage[];

  @IsArray()
  @IsEnum(PostFormat, { each: true })
  postFormat: PostFormat[];

  @IsArray()
  @IsEnum(Intent, { each: true })
  intent: Intent[];

  @IsArray()
  @IsEnum(SpeakerType, { each: true })
  speakerType: SpeakerType[];

  @IsEnum(TrackingPost, { each: true })
  trackingPost: TrackingPost[];

  @IsArray()
  filterBy: string[];

  @IsArray()
  @IsEnum(Language, { each: true })
  language: Language[];

  @IsArray()
  @IsEnum(AiDetect, { each: true })
  detectedBy: AiDetect[];
}

