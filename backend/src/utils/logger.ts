import winston from "winston";
import { config, isProduction } from "../config";

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  errors({ stack: true }),
  printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    if (stack) log += `\n${stack}`;
    if (Object.keys(meta).length) log += ` ${JSON.stringify(meta)}`;
    return log;
  })
);

const prodFormat = combine(timestamp(), errors({ stack: true }), json());

export const logger = winston.createLogger({
  level: config.NODE_ENV === "test" ? "silent" : "info",
  format: isProduction ? prodFormat : devFormat,
  defaultMeta: { service: "school-mgmt-api" },
  transports: [
    new winston.transports.Console(),
    // In production, add file transports or log to STDOUT for cloud collection
    ...(isProduction
      ? []
      : [
          new winston.transports.File({
            filename: "logs/error.log",
            level: "error",
            maxsize: 5_000_000,
            maxFiles: 5,
          }),
        ]),
  ],
});

// HTTP request logger format for Morgan
export const morganStream = {
  write: (message: string) => logger.http(message.trim()),
};
