import express from 'express';
import UserRouter from './routes/UserRouter';
import AuthenticationRouter from './routes/AuthenticationRouter';
import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import middleware from 'i18next-http-middleware';
import ErrorHandler from './middlewares/ErrorHandler';
import tokenAuthentication from './middlewares/tokenAuthentication';
import FileService from './services/FileService';
import config from 'config';
import path from 'path';
import logger from './utils/logger';

const uploadDir: string = config.get('uploadDir');
const profileDir: string = config.get('profileDir');
const profileFolder = path.join('.', uploadDir, profileDir);

const ONE_YEAR_IN_MILLIS = 365 * 24 * 60 * 60 * 1000;

i18next
  .use(Backend)
  .use(middleware.LanguageDetector)
  .init({
    fallbackLng: 'en',
    lng: 'en',
    ns: ['translation'],
    defaultNS: 'translation',
    backend: {
      loadPath: './locales/{{lng}}/{{ns}}.json',
    },
    detection: {
      lookupHeader: 'accept-language',
    },
  })
  .then(() => {
    logger.info('Locales running ...');
  })
  .catch(() => {
    logger.error('Locales not initialized');
  });

FileService.createFolders();

const app = express();

app.use(middleware.handle(i18next));
app.use(express.json({ limit: '3mb' }));

app.use('/images', express.static(profileFolder, { maxAge: ONE_YEAR_IN_MILLIS }));

app.use(tokenAuthentication);
app.use(UserRouter);
app.use(AuthenticationRouter);

app.use(ErrorHandler);

export default app;
