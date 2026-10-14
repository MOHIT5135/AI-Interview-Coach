const mongoose = require('mongoose');

const interviewSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, required: true },
    difficulty: { type: String, required: true },
    status: { type: String, enum: ['in_progress', 'completed'], default: 'in_progress', index: true },
    totalQuestions: { type: Number, default: 5 },
    questionsAnswered: { type: Number, default: 0 },
    overallScore: { type: Number, default: null },
    strengths: [{ type: String }],
    weaknesses: [{ type: String }],
    summary: { type: String },
    resumeText: { type: String, default: '' }, // Store resume for reference
    resumeSummary: { type: String, default: '' }, // Concise ~150 word technical summary
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('InterviewSession', interviewSessionSchema);
