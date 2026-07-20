const asyncHandler = require('../utils/asyncHandler');
const supportService = require('../services/support');

const submitFeedback = asyncHandler(async (req, res) => {
  const result = await supportService.submitFeedback(req.body);

  res.status(201).json({
    success: true,
    ...result,
  });
});

module.exports = {
  submitFeedback,
};
