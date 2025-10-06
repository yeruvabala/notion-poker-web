import OpenAI from 'openai';

if (!process.env.OPENAI_API_KEY) {
  // Do not throw in module scope on Vercel build; just log.
  console.warn('OPENAI_API_KEY is not set');
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});
