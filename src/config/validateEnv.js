import dotenv from 'dotenv';
dotenv.config();

const required = [
  'MONGODB_URI',
  'REDIS_URL',
  'SERPAPI_KEY',
  'GEMINI_API_KEY',
  'PORT'
];

required.forEach((key) => {
  if (!process.env[key]) {
    console.error(`❌ Fatal Error: ${key} is missing in environment variables.`);
    process.exit(1);
  }
});

console.log('✅ All environment variables validated.');
