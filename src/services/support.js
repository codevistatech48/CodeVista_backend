const Feedback = require('../models/feedback.model');
const AppError = require('../utils/AppError');

async function submitFeedback({ name, email, message }) {
  const trimmedName = name?.trim();
  const trimmedEmail = email?.trim().toLowerCase();
  const trimmedMessage = message?.trim();

  if (!trimmedName || !trimmedEmail || !trimmedMessage) {
    throw new AppError('Name, email, and message are required', 400);
  }

  const feedback = await Feedback.create({
    name: trimmedName,
    email: trimmedEmail,
    message: trimmedMessage,
  });

  return {
    message: 'Thanks — your message has been received.',
    feedbackId: feedback._id,
  };
}

module.exports = {
  submitFeedback,
};
