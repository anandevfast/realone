import { registerAs } from '@nestjs/config';

export const businessConfig = registerAs('business', () => ({
  companyPath: process.env.BUSINESS_COMPANY_PATH,
  apiUrl: process.env.BUSINESS_API_URL,
  arukasUrl: process.env.BUSINESS_ARUKAS_URL,
  exportLimit: Number(process.env.BUSINESS_EXPORT_LIMIT ?? 5000),
}));
