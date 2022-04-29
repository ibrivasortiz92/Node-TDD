class EmailException extends Error {
  status: number;
  constructor() {
    super();
    this.message = 'email_failure';
    this.status = 502;
  }
}
export default EmailException;
