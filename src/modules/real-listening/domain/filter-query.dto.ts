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
  @IsString()
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
  @Type(() => AdvanceSearchDTO)
  advanceSearch?: AdvanceSearchDTO;

}

