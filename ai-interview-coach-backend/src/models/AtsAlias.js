const mongoose = require('mongoose');

const atsAliasSchema = new mongoose.Schema(
  {
    term: { type: String, required: true, lowercase: true, index: true },
    resumePhrase: { type: String, required: true, lowercase: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AtsAlias', atsAliasSchema);
