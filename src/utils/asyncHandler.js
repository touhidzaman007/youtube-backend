const asyncHandler = (requestHandler) => {
  (req, res, next) => {
    return Promise.resolve(requestHandler(req, res, next)).catch(next);
  };
};

export { asyncHandler };
