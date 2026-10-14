const mongoose = require('mongoose');

const questionAnswerSchema = new mongoose.Schema(
  {
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewSession', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    questionNumber: { type: Number, required: true },
    question: { type: String, required: true },
    userAnswer: { type: String, required: true },
    score: { type: Number, required: true },
    goodPoints: [{ type: String }],
    missingPoints: [{ type: String }],
    idealAnswerHint: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('QuestionAnswer', questionAnswerSchema);
