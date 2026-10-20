const mongoose = require('mongoose');

const vectorEmbeddingSchema = new mongoose.Schema(
  {
    docHash: { type: String, required: true, unique: true, index: true },
    docType: { type: String, enum: ['resume', 'job_description', 'bullet', 'requirement'], default: 'bullet', required: true },
    modelName: { type: String, default: 'gemini-embedding-001' },
    dimensions: { type: Number, default: 768 },
    embedding: { type: [Number], required: true },
    textSnippet: { type: String }
  },
  { timestamps: true }
);

vectorEmbeddingSchema.methods.cosineSimilarity = function(otherEmbedding) {
  const vecA = this.embedding;
  const vecB = otherEmbedding;
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

module.exports = mongoose.model('VectorEmbedding', vectorEmbeddingSchema);
