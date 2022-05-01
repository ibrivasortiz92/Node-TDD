import request from 'supertest';

export interface Response<T> extends request.Response {
  body: T;
}

export interface OptionInterface {
  language?: string;
  auth?: {
    email: string;
    password: string;
  };
  token?: string;
  query?: object;
}

export interface DynamicTestInterface {
  language: string;
  message: string;
}

interface ErrorInterface<T> {
  path: string;
  message: string;
  timestamp: number;
  validationErrors: Partial<T>;
}
