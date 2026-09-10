export class AppError extends Error {
  status: number;
  code: string;

  constructor(status: number, message: string, code = 'APP_ERROR') {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}
