module.exports = function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({valid : false ,data : null , messages: ['Invalid JSON in request body. Please check your syntax.'] });
  }
  if (err.status === 403 && err.message === 'Not allowed by CORS') {
    return res.status(403).json('Not allowed by CORS');
  }
  console.error('Unhandled request error', err);
  return res.status(500).json('Internal Server Error');
};
