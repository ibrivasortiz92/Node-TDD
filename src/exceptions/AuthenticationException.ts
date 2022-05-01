class AuthenticationException extends Error {
  status: number;
  constructor(message?: string) {
    super(message || 'authentication_failure');
    this.status = 401;
  }
}

export default AuthenticationException;
