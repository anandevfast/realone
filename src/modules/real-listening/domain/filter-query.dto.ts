import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  AiDetect,
  ConditionTemplate,
  FavoriteMessage,
  Intent,
  Language,
  PostFormat,
  Sentiment,
  SortBy,
  ResultBy,
  SpeakerType,
  StatusMessage,
  TrackingPost,
  Visibility,
  AdvanceSearchOperator,
  Metric,
} from './social-enum';

export class IncludeExcludeDTO {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  include?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  exclude?: string[];
}

export class RangeConditionDTO {
  @IsEnum(AdvanceSearchOperator)
  operator: AdvanceSearchOperator;

  @IsNumber()
  value: number;
}

export class MonitorDTO {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  facebook?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  twitter?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tiktok?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  youtube?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  instagram?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  pantip?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  blockdit?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  website?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  webboard?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  newspaper?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  magazine?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  radio?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  television?: string[];
}

export class AdvanceSearchDTO {
  @IsOptional()
  @ValidateNested()
  @Type(() => IncludeExcludeDTO)
  word?: IncludeExcludeDTO;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  is?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => IncludeExcludeDTO)
  author?: IncludeExcludeDTO;

  @IsOptional()
  @ValidateNested()
  @Type(() => RangeConditionDTO)
  engagement?: RangeConditionDTO;

  @IsOptional()
  @ValidateNested()
  @Type(() => RangeConditionDTO)
  views?: RangeConditionDTO;
}

export class FilterQueryDTO {
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @IsString()
  @IsNotEmpty()
  email: string;

  @IsOptional()
  @IsArray()
  channel: string[];

  @IsOptional()
  @IsArray()
  keywords: string[];

  @IsOptional()
  @IsArray()
  tags: string[];

  @IsOptional()
  @IsEnum(Metric)
  metric: string;

  @IsEnum(SortBy)
  sortBy: SortBy;

  @IsEnum(ConditionTemplate)
  condition: ConditionTemplate[];

  @IsOptional()
  @IsArray()
  @IsEnum(Sentiment, { each: true })
  sentiment: Sentiment[];

  @IsOptional()
  @IsArray()
  @IsEnum(StatusMessage, { each: true })
  statusMessage: StatusMessage[];

  @IsOptional()
  @IsArray()
  @IsEnum(Visibility, { each: true })
  visibility: Visibility[];

  @IsOptional()
  @IsArray()
  @IsEnum(ResultBy, { each: true })
  resultBy: ResultBy[];

  @IsOptional()
  @IsArray()
  @IsEnum(FavoriteMessage, { each: true })
  favoriteMessage: FavoriteMessage[];

  @IsOptional()
  @IsArray()
  @IsEnum(PostFormat, { each: true })
  postFormat: PostFormat[];

  @IsOptional()
  @IsArray()
  @IsEnum(Intent, { each: true })
  intent: Intent[];

  @IsOptional()
  @IsArray()
  @IsEnum(SpeakerType, { each: true })
  speakerType: SpeakerType[];

  @IsOptional()
  @IsEnum(TrackingPost, { each: true })
  trackingPost: TrackingPost[];

  @IsOptional()
  @IsArray()
  filterBy: string[];

  @IsOptional()
  @IsArray()
  @IsEnum(Language, { each: true })
  language: Language[];

  @IsOptional()
  @IsArray()
  @IsEnum(AiDetect, { each: true })
  detectedBy: AiDetect[];

  @IsOptional()
  @ValidateNested()
  @Type(() => MonitorDTO)
  monitor?: MonitorDTO;

  @IsOptional()
  @ValidateNested()
  @Type(() => AdvanceSearchDTO)
  advanceSearch?: AdvanceSearchDTO;
}
