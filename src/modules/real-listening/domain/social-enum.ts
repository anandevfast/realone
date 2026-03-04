export enum Sentiment {
  POSITIVE = 'positive',
  NEGATIVE = 'negative',
  NEUTRAL = 'neutral',
}

export enum ResultBy {
  Keyword = 'keyword',
  Monitor = 'monitor',
  Image = 'image',
  Voice = 'voice',
  Video = 'video',
  Backtrack = 'backtrack',
  Manual = 'manual',
}

export enum AiDetect {
  Logo = 'logo',
  Ocr = 'ocr',
  Object = 'object',
}

export enum StatusMessage {
  Read = 'read',
  Unread = 'unread',
}

export enum Visibility {
  Hide = 'hind',
  Show = 'show',
}

export enum SpeakerType {
  Brand = 'brand',
  ClientBrand = 'client brand',
  GeneralBrand = 'general brand',
  Publisher = 'publisher',
  Influencer = 'influencer',
  Politic = 'politic',
  Government = 'government',
  Consumer = 'consumer',
  Foundation = 'foundation',
  Other = 'other',
}

export enum Intent {
  Information = 'information',
  Enquiry = 'enquiry',
  Complaint = 'complaint',
  Compliment = 'compliment',
  Recommendation = 'recommendation',
  Participation = 'participation',
  Intention = 'intention',
}

export enum FavoriteMessage {
  Favorite = 'favorite',
  Unfavorite = 'Unfavorite',
}

export enum PostFormat {
  Text = 'text',
  Image = 'image',
  Link = 'link',
  Tag = 'tag',
  Video = 'video',
}

export enum TrackingPost {
  Active = 'activeTracking',
  Stopped = 'stoppedTracking',
}

export enum AdvanceSearchOperator {
  EQ = '=',
  GT = '>',
  GTE = '>=',
  LT = '<',
  LTE = '<=',
}

export enum Language {
  TH = 'th',
  EN = 'en',
}

export enum ConditionTemplate {
  AND = 'and',
  OR = 'or',
  AND_NOT = 'keywordAndNotMonitor',
}

export enum SortBy {
  NEWEST_DATES = 'publisheddate-desc',
  OLDEST_DATES = 'publisheddate-asc',
  MOST_ENGAGEMENT = 'totalEngagement-desc',
  LESS_ENGAGEMENT = 'totalEngagement-asc',
  MOST_VIEW = 'totalView-desc',
  LESS_VIEW = 'totalView-asc',
  MOST_FOLLOWERS = 'follower-desc',
  LESS_FOLLOWERS = 'follower-asc',
}

