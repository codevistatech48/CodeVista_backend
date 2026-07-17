const mongoose = require('mongoose');
const SrsRequest = require('../models/srsRequest.model');
const AppError = require('../utils/AppError');
const { createNotification, notifyAdmins } = require('./notification.service');

// User can only have one pending request at a time.
const ACTIVE_STATUSES = ['pending'];

const REVIEW_STATUSES = ['approved', 'accepted', 'rejected', 'expired'];

const REQUIRED_FIELDS = [
  'fullName',
  'email',
  'projectName',
  'projectType',
  'summary',
  'features',
];

const FORM_FIELDS = [
  'fullName',
  'company',
  'email',
  'phone',
  'projectName',
  'projectType',
  'summary',
  'goals',
  'audience',
  'features',
  'userRoles',
  'integrations',
  'technology',
  'timeline',
  'budget',
  'notes',
];

const EXPIRATION_DAYS = 7;

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function toStatusResponse(request) {
  return {
    id: String(request._id),
    status: request.status,
    projectName: request.projectName,
    createdAt: request.createdAt,
    expiresAt: request.expiresAt,
    reviewedAt: request.reviewedAt,
    adminNote: request.adminNote || null,
  };
}

async function createSrsRequest(payload = {}, userId) {
  const requestData = Object.fromEntries(
    FORM_FIELDS.map((field) => [field, normalizeText(payload[field])])
  );

  const missingField = REQUIRED_FIELDS.find(
    (field) => !requestData[field]
  );

  if (missingField) {
    throw new AppError(`${missingField} is required`, 400);
  }

  requestData.email = requestData.email.toLowerCase();

  if (!/^\S+@\S+\.\S+$/.test(requestData.email)) {
    throw new AppError('A valid email address is required', 400);
  }

  // Only allow one pending request per user.
  const existingRequest = await SrsRequest.findOne({
    user: userId,
    status: { $in: ACTIVE_STATUSES },
  });

  if (existingRequest) {
    throw new AppError(
      'You already have a pending SRS request. Please wait for it to be reviewed.',
      409,
      { request: existingRequest }
    );
  }

  const expiresAt = new Date(
    Date.now() + EXPIRATION_DAYS * 24 * 60 * 60 * 1000
  );

  try {
    const request = await SrsRequest.create({
      ...requestData,
      user: userId,
      status: 'pending',
      expiresAt,
    });

    try {
      await createNotification({
        userId,
        title: 'SRS request received',
        message: 'Your SRS request is waiting for review.',
        type: 'srs_request',
      });
    } catch (_error) {
      // Notification failure should not fail the request.
    }

    try {
      await notifyAdmins({
        title: 'New SRS request',
        message: `${request.fullName} submitted "${request.projectName}" for review.`,
        type: 'admin_srs_request',
      });
    } catch (_error) {
      // Admin notification failure should not fail the request.
    }

    return request;
  } catch (error) {
    if (error.code === 11000) {
      const existingRequest = await SrsRequest.findOne({
        user: userId,
        status: { $in: ACTIVE_STATUSES },
      });

      throw new AppError(
        'You already have a pending SRS request.',
        409,
        { request: existingRequest }
      );
    }

    if (error.name === 'ValidationError') {
      throw new AppError(
        'One or more SRS request fields are invalid',
        400
      );
    }

    throw new AppError('Unable to submit the SRS request', 500);
  }
}

async function getLatestStatus(userId) {
  const request = await SrsRequest.findOne({
    user: userId,
  }).sort({ createdAt: -1 });

  if (!request) {
    throw new AppError('No SRS request found.', 404);
  }

  // Automatically expire old pending requests.
  if (
    request.status === 'pending' &&
    request.expiresAt &&
    request.expiresAt <= new Date()
  ) {
    request.status = 'expired';
    await request.save();
  }

  return toStatusResponse(request);
}

async function reviewSrsRequest(
  requestId,
  adminId,
  status,
  adminNote
) {
  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    throw new AppError('Invalid SRS request id', 400);
  }

  if (!REVIEW_STATUSES.includes(status)) {
    throw new AppError('Invalid SRS review status', 400);
  }

  const request = await SrsRequest.findById(requestId);

  if (!request) {
    throw new AppError('SRS request not found', 404);
  }

  request.status = status;
  request.reviewedAt = new Date();
  request.reviewedBy = adminId;
  request.adminNote = normalizeText(adminNote);

  await request.save();

  try {
    await createNotification({
      userId: request.user,
      title: 'SRS request updated',
      message: `Your SRS request status is now ${status}.`,
      type: 'srs_request_status',
    });
  } catch (_error) {
    // Notification failure should not fail the review.
  }

  return request;
}

module.exports = {
  createSrsRequest,
  getLatestStatus,
  reviewSrsRequest,
  toStatusResponse,
};