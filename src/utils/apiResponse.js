class ApiResponse {
  constructor(success, message, data = null, meta = null) {
    this.success = success;
    this.message = message;
    this.data = data;
    this.meta = meta;
    this.timestamp = new Date().toISOString();
  }

  static success(message, data = null, meta = null) {
    return new ApiResponse(true, message, data, meta);
  }

  static error(message, data = null) {
    return new ApiResponse(false, message, data);
  }

  static paginated(message, data, pagination) {
    return new ApiResponse(true, message, data, { pagination });
  }

  toJSON() {
    return {
      success: this.success,
      message: this.message,
      data: this.data,
      meta: this.meta,
      timestamp: this.timestamp,
    };
  }
}

const responseHelpers = {
  created: (message, data) => ApiResponse.success(message, data),
  ok: (message, data) => ApiResponse.success(message, data),
  paginated: (message, data, pagination) => ApiResponse.paginated(message, data, pagination),
  badRequest: (message = 'Bad Request') => ApiResponse.error(message),
  unauthorized: (message = 'Unauthorized') => ApiResponse.error(message),
  forbidden: (message = 'Forbidden') => ApiResponse.error(message),
  notFound: (message = 'Not Found') => ApiResponse.error(message),
  conflict: (message = 'Conflict') => ApiResponse.error(message),
  internalError: (message = 'Internal Server Error') => ApiResponse.error(message),
};

export { ApiResponse };
export default responseHelpers;