const mongoose = require('mongoose');

const atsCacheSchema = new mongoose.Schema(
  {
    jdHash: { type: String, required: true, unique: true, index: true },
    parsedData: { type: Object, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AtsCache', atsCacheSchema);
