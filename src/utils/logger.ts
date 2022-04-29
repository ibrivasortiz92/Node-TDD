import { createLogger, transports, format } from 'winston';
import TransportStream from 'winston-transport';

const customFormat = format.combine(
  format.timestamp(),
  format.printf((info) => {
    return `${info.timestamp as string} [${info.level.toUpperCase()}]: ${info.message}`;
  })
);

const destination: TransportStream[] = [new transports.Console()];
if (process.env.NODE_ENV === 'production') {
  destination.push(
    new transports.File({
      filename: 'app.log',
    })
  );
}

const logger = createLogger({
  transports: destination,
  level: 'debug',
  format: customFormat,
  silent: process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'staging',
});

export default logger;
