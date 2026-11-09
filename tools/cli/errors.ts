/** An error with a message meant for the person running the CLI (no stack trace shown). */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserError';
  }
}
