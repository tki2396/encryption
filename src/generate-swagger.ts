import fs from 'fs';
import path from 'path';
import swaggerJSDoc from 'swagger-jsdoc';
import { fileURLToPath } from 'url';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Signal Protocol API',
      version: '1.0.0',
    },
  },
  apis: ['./src/index.ts'],
};

const swaggerSpec = swaggerJSDoc(options);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputPath = path.resolve(__dirname, './swagger.json');

fs.writeFileSync(outputPath, JSON.stringify(swaggerSpec, null, 2), 'utf-8');

console.log('Swagger JSON file generated at', outputPath);