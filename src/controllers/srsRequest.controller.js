const asyncHandler = require('../utils/asyncHandler');
const srsRequestService = require('../services/srsRequest.service');

const createSrsRequest = asyncHandler(async (req, res) => {
  const request = await srsRequestService.createSrsRequest(req.body, req.user._id);
  res.status(201).json({ success: true, request });
});

const getStatus = asyncHandler(async (req, res) => {
  const request = await srsRequestService.getLatestStatus(req.user._id);
  res.json({ success: true, request });
});

const review = asyncHandler(async (req, res) => {
  const request = await srsRequestService.reviewSrsRequest(
    req.params.id,
    req.user._id,
    req.body.status,
    req.body.adminNote
  );
  res.json({ success: true, request });
});

module.exports = { createSrsRequest, getStatus, review };
