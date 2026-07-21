const mongoose = require('mongoose');
const SrsRequest = require('../models/srsRequest.model');
const Project = require('../models/project.model');
const AppError = require('../utils/AppError');
const { createNotification, notifyAdmins } = require('./notification.service');
const ActivityLog = require('../models/activityLog.model');
const { createActivityLog } = require('./activityLog.service');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

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

function idOrError(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Invalid id', 400);
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

    // Log activity for the user
    try {
      await createActivityLog({
        actorId: userId,
        action: 'srs.submitted',
        description: `SRS request submitted for "${request.projectName}"`,
        entity: 'SrsRequest',
        entityId: request._id,
        performerRole: 'user',
        metadata: { projectName: request.projectName, status: request.status },
      });
    } catch (_error) {
      // Activity logging failure should not fail the request.
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

async function getSrsPdfPath(id, userId, isAdmin) {
  idOrError(id);
  const request = await SrsRequest.findById(id);
  if (!request) throw new AppError('SRS request not found', 404);

  // Access control: users can only download their own SRS, admins can download any
  if (!isAdmin && String(request.user) !== String(userId)) {
    throw new AppError('You are not authorized to access this SRS request', 403);
  }

  // Check uploads directory for any PDF associated with this SRS
  const uploadDir = path.resolve(__dirname, '../../uploads');
  const files = fs.readdirSync(uploadDir).filter((f) => f.startsWith(String(request._id)) && f.endsWith('.pdf'));

  if (files.length > 0) {
    return { filePath: path.join(uploadDir, files[0]), filename: `SRS_${request.projectName || request._id}.pdf` };
  }

  // Generate PDF dynamically from SRS request data
  const filename = `SRS_${request.projectName || request._id}.pdf`;
  const filePath = path.join(uploadDir, `${request._id}_${Date.now()}.pdf`);

  try {
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    doc.fontSize(20).font('Helvetica-Bold').text('Software Requirements Specification', { align: 'center' });
    doc.moveDown();
    doc.fontSize(16).text(request.projectName, { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(14).font('Helvetica-Bold').text('Client Information');
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica');
    doc.text(`Full Name: ${request.fullName}`);
    doc.text(`Email: ${request.email}`);
    if (request.company) doc.text(`Company: ${request.company}`);
    if (request.phone) doc.text(`Phone: ${request.phone}`);
    doc.moveDown();

    doc.fontSize(14).font('Helvetica-Bold').text('Project Details');
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica');
    doc.text(`Project Type: ${request.projectType}`);
    doc.text(`Status: ${request.status.toUpperCase()}`);
    doc.moveDown();

    doc.fontSize(14).font('Helvetica-Bold').text('Project Summary');
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica');
    doc.text(request.summary || 'No summary provided.', { width: 500 });
    doc.moveDown();

    if (request.goals) {
      doc.fontSize(14).font('Helvetica-Bold').text('Goals');
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica');
      doc.text(request.goals, { width: 500 });
      doc.moveDown();
    }

    if (request.audience) {
      doc.fontSize(14).font('Helvetica-Bold').text('Target Audience');
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica');
      doc.text(request.audience, { width: 500 });
      doc.moveDown();
    }

    doc.fontSize(14).font('Helvetica-Bold').text('Features & Requirements');
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica');
    doc.text(request.features || 'No features specified.', { width: 500 });
    doc.moveDown();

    if (request.userRoles) {
      doc.fontSize(14).font('Helvetica-Bold').text('User Roles');
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica');
      doc.text(request.userRoles, { width: 500 });
      doc.moveDown();
    }

    if (request.integrations) {
      doc.fontSize(14).font('Helvetica-Bold').text('Integrations');
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica');
      doc.text(request.integrations, { width: 500 });
      doc.moveDown();
    }

    if (request.technology) {
      doc.fontSize(14).font('Helvetica-Bold').text('Technology Stack');
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica');
      doc.text(request.technology, { width: 500 });
      doc.moveDown();
    }

    if (request.timeline) {
      doc.fontSize(14).font('Helvetica-Bold').text('Timeline');
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica');
      doc.text(request.timeline, { width: 500 });
      doc.moveDown();
    }

    if (request.budget) {
      doc.fontSize(14).font('Helvetica-Bold').text('Budget');
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica');
      doc.text(request.budget, { width: 500 });
      doc.moveDown();
    }

    if (request.notes) {
      doc.fontSize(14).font('Helvetica-Bold').text('Additional Notes');
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica');
      doc.text(request.notes, { width: 500 });
      doc.moveDown();
    }

    if (request.adminNote) {
      doc.fontSize(14).font('Helvetica-Bold').text('Admin Review Notes');
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica');
      doc.text(request.adminNote, { width: 500 });
      doc.moveDown();
    }

    doc.moveDown(2);
    doc.fontSize(9).font('Helvetica').fillColor('gray').text('This document was auto-generated by CodeVista.', { align: 'center' });

    doc.end();

    return new Promise((resolve, reject) => {
      stream.on('finish', () => resolve({ filePath, filename }));
      stream.on('error', reject);
    });
  } catch (error) {
    throw new AppError('Failed to generate PDF', 500);
  }
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

  // Set revision tracking fields when accepted
  if (status === 'accepted') {
    request.approvedAt = new Date();
    request.freeRevisionUntil = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days from now
  }

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

  // Auto-create a project when SRS request is accepted
  if (status === 'accepted') {
    const existingProject = await Project.findOne({ srsRequest: request._id });
    if (!existingProject) {
      try {
        const techArray = request.technology
          ? request.technology.split(',').map((t) => t.trim()).filter(Boolean)
          : [];

        const project = await Project.create({
          name: request.projectName,
          projectName: request.projectName,
          description: request.summary || '',
          srsRequest: request._id,
          user: request.user,
          status: 'planning',
          progress: 0,
          priority: 'medium',
          technologyStack: techArray,
          timeline: [
            { stage: 'accepted', status: 'completed', date: new Date() },
            { stage: 'planning', status: 'pending', date: new Date() },
            { stage: 'ui_design', status: 'pending', date: new Date() },
            { stage: 'development', status: 'pending', date: new Date() },
            { stage: 'testing', status: 'pending', date: new Date() },
            { stage: 'deployment', status: 'pending', date: new Date() },
            { stage: 'completed', status: 'pending', date: new Date() },
          ],
        });

        // Log activity for project creation
        try {
          await createActivityLog({
            actorId: request.user,
            action: 'project.created',
            description: `Project "${project.projectName}" created from accepted SRS`,
            entity: 'Project',
            entityId: project._id,
            projectId: project._id,
            performerRole: 'system',
            metadata: { projectName: project.projectName, srsRequestId: request._id },
          });
        } catch (_error) {
          // Activity logging failure should not fail the review
        }
      } catch (error) {
        console.error('Failed to create project for accepted SRS:', error);
      }
    }
  }

  return request;
}

module.exports = {
  createSrsRequest,
  getLatestStatus,
  getSrsPdfPath,
  reviewSrsRequest,
  toStatusResponse,
};