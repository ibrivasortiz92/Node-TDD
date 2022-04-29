class NotFoundException {
  status: number;
  message: string;
  constructor(message: string) {
    this.status = 404;
    this.message = message;
  }
}

export default NotFoundException;
