class FileSizeException extends Error {
  status: number;
  constructor() {
    super();
    this.status = 400;
    this.message = 'attachment_size_limit';
  }
}
export default FileSizeException;
