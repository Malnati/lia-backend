export type ErrorCode = 'bad_request' | 'unauthorized' | 'forbidden' | 'not_found' | 'internal_error';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: ErrorCode = statusToCode(status)
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

function statusToCode(status: number): ErrorCode {
  if (status === 400 || status === 422) return 'bad_request';
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  return 'internal_error';
}

export const badRequest = (message: string) => new HttpError(400, message, 'bad_request');
export const unauthorized = (message: string) => new HttpError(401, message, 'unauthorized');
export const forbidden = (message: string) => new HttpError(403, message, 'forbidden');
export const notFound = (message: string) => new HttpError(404, message, 'not_found');
