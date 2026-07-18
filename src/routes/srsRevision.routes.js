const express = require("express");
const router = express.Router();

const revisionController = require("../controllers/srsRevision.controller");

const authenticate = require("../middlewares/auth");
const { authorize } = require("../middlewares/admin");

/*
|--------------------------------------------------------------------------
| USER ROUTES
|--------------------------------------------------------------------------
*/

// Create a revision for an accepted SRS
router.post(
  "/:srsId/revisions",
  authenticate,
  revisionController.createRevision
);

// Get all revisions of an SRS
router.get(
  "/:srsId/revisions",
  authenticate,
  revisionController.getRevisions
);

// Get one revision
router.get(
  "/revisions/:revisionId",
  authenticate,
  revisionController.getRevision
);

// Accept additional cost
router.patch(
  "/revisions/:revisionId/accept-cost",
  authenticate,
  revisionController.acceptCost
);

// Reject additional cost
router.patch(
  "/revisions/:revisionId/reject-cost",
  authenticate,
  revisionController.rejectCost
);

// Add user comment
router.post(
  "/revisions/:revisionId/comments",
  authenticate,
  revisionController.addComment
);

/*
|--------------------------------------------------------------------------
| ADMIN ROUTES
|--------------------------------------------------------------------------
*/

// Review revision
router.patch(
  "/revisions/:revisionId/review",
  authenticate,
  authorize("admin"),
  revisionController.reviewRevision
);

// Update estimated cost
router.patch(
  "/revisions/:revisionId/cost",
  authenticate,
  authorize("admin"),
  revisionController.updateCost
);

// Assign developer
router.patch(
  "/revisions/:revisionId/assign",
  authenticate,
  authorize("admin"),
  revisionController.assignDeveloper
);

// Change workflow status
router.patch(
  "/revisions/:revisionId/status",
  authenticate,
  authorize("admin"),
  revisionController.updateWorkflowStatus
);

// Merge revision into project
router.patch(
  "/revisions/:revisionId/merge",
  authenticate,
  authorize("admin"),
  revisionController.mergeRevision
);

// Admin comment
router.post(
  "/revisions/:revisionId/comments",
  authenticate,
  authorize("admin"),
  revisionController.addAdminComment
);

// Delete revision (optional)
router.delete(
  "/revisions/:revisionId",
  authenticate,
  authorize("admin"),
  revisionController.deleteRevision
);

module.exports = router;