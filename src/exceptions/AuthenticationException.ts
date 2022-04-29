class AuthenticationException extends Error {
  status: number;
  constructor() {
    super();
    this.status = 401;
    this.message = 'authentication_failure';
  }
}

export default AuthenticationException;
