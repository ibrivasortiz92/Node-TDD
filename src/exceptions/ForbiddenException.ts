class ForbiddenException extends Error {
  status: number;
  constructor(message?: string) {
    super();
    this.status = 403;
    this.message = message || 'inactive_authentication_failure';
  }
}
export default ForbiddenException;
