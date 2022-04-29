class InvalidTokenException extends Error {
  status: number;
  constructor() {
    super();
    this.message = 'account_activation_failure';
    this.status = 400;
  }
}
export default InvalidTokenException;
