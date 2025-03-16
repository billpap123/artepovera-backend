import { Request } from 'express';

export interface CustomRequest extends Request {
  body: any;
  params: { [key: string]: string };
  headers: any;
  user?: {
    id: number;
    username: string;
    user_type: string;
  };
}
