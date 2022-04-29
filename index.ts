import app from './src/app';
import db from './database/dataSource';
import TokenService from './src/services/TokenService';
import logger from './src/utils/logger';

db.initialize()
  .then(() => {
    TokenService.scheduleCleanup();

    app.listen(process.env.PORT || 3000, () =>
      logger.info('app is running. version ' + (process.env.npm_package_version as string))
    );
  })
  .catch((err) => {
    console.log('Database initialization error: ', err);
  });
