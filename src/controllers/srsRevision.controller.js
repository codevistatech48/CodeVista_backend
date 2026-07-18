const asyncHandler = require("../utils/asyncHandler");
const srsRevisionService = require("../services/srsRevision.service");

/* ============================================================================
   USER
============================================================================ */

// Create Revision
const createRevision = asyncHandler(async (req, res) => {
  const revision = await srsRevisionService.createRevision(
    req.params.srsId,
    req.user._id,
    req.body
  );

  res.status(201).json({
    success: true,
    data: revision,
  });
});

// Get all revisions of an SRS
const getRevisions = asyncHandler(async (req, res) => {
  const revisions = await srsRevisionService.getRevisions(
    req.params.srsId,
    req.user._id,
    req.user.role === "admin"
  );

  res.json({
    success: true,
    data: revisions,
  });
});

// Get one revision
const getRevision = asyncHandler(async (req, res) => {
  const revision = await srsRevisionService.getRevision(
    req.params.revisionId,
    req.user._id,
    req.user.role === "admin"
  );

  res.json({
    success: true,
    data: revision,
  });
});

// User accepts estimated cost
const acceptCost = asyncHandler(async (req, res) => {
  const revision = await srsRevisionService.acceptRevisionCost(
    req.params.revisionId,
    req.user._id
  );

  res.json({
    success: true,
    data: revision,
  });
});

// User rejects estimated cost
const rejectCost = asyncHandler(async (req, res) => {
  const revision = await srsRevisionService.rejectRevisionCost(
    req.params.revisionId,
    req.user._id
  );

  res.json({
    success: true,
    data: revision,
  });
});

// User adds comment
const addComment = asyncHandler(async (req, res) => {
  const revision = await srsRevisionService.addComment(
    req.params.revisionId,
    req.user,
    req.body
  );

  res.json({
    success: true,
    data: revision,
  });
});

/* ============================================================================
   ADMIN
============================================================================ */

// Approve / Reject revision
const reviewRevision = asyncHandler(async (req, res) => {
  const revision = await srsRevisionService.reviewRevision(
    req.params.revisionId,
    req.user,
    req.body
  );

  res.json({
    success: true,
    data: revision,
  });
});

// Update estimated cost
const updateCost = asyncHandler(async (req, res) => {
  const revision = await srsRevisionService.updateRevisionCost(
    req.params.revisionId,
    req.user,
    req.body
  );

  res.json({
    success: true,
    data: revision,
  });
});

// Assign developer
const assignDeveloper = asyncHandler(async (req, res) => {
  const revision = await srsRevisionService.assignDeveloper(
    req.params.revisionId,
    req.user,
    req.body
  );

  res.json({
    success: true,
    data: revision,
  });
});

// Update workflow status
const updateWorkflowStatus = asyncHandler(async (req, res) => {
  const revision = await srsRevisionService.updateWorkflowStatus(
    req.params.revisionId,
    req.user,
    req.body
  );

  res.json({
    success: true,
    data: revision,
  });
});

// Merge revision into project
const mergeRevision = asyncHandler(async (req, res) => {
  const revision = await srsRevisionService.mergeRevision(
    req.params.revisionId,
    req.user
  );

  res.json({
    success: true,
    data: revision,
  });
});

// Admin comment
const addAdminComment = asyncHandler(async (req, res) => {
  const revision = await srsRevisionService.addAdminComment(
    req.params.revisionId,
    req.user,
    req.body
  );

  res.json({
    success: true,
    data: revision,
  });
});

// Delete revision
const deleteRevision = asyncHandler(async (req, res) => {
  await srsRevisionService.deleteRevision(
    req.params.revisionId,
    req.user
  );

  res.json({
    success: true,
    message: "Revision deleted successfully.",
  });
});

module.exports = {
  createRevision,
  getRevisions,
  getRevision,

  acceptCost,
  rejectCost,

  reviewRevision,
  updateCost,

  assignDeveloper,
  updateWorkflowStatus,
  mergeRevision,

  addComment,
  addAdminComment,

  deleteRevision,
};