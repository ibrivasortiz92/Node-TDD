class ValidationException extends Error {
  status: number;
  errors: { param: string; msg: string }[];
  constructor(errors: { param: string; msg: string }[]) {
    super();
    this.message = 'validation_failure';
    this.status = 400;
    this.errors = errors;
  }
}

export default ValidationException;
