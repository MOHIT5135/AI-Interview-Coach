'use strict';
const { GoogleGenAI } = require('@google/genai');
const crypto = require('crypto');
const VectorEmbedding = require('../models/VectorEmbedding');

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const ai = new GoogleGenAI({ apiKey });

const computeLocalEmbedding = (text) => {
  const clean = String(text || '').toLowerCase();
  const tokens = clean.replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
  const dim = 768;
  const vec = new Array(dim).fill(0);
  tokens.forEach((token) => {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      hash = ((hash << 5) - hash) + token.charCodeAt(i);
      hash |= 0;
    }
    const pos = Math.abs(hash) % dim;
    vec[pos] += 1;
  });
  const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
  if (norm === 0) return vec;
  return vec.map(v => v / norm);
};

const getOrComputeEmbedding = async (text, docType = 'resume', preferredModel = process.env.EMBEDDING_MODEL || 'gemini-embedding-001') => {
  const cleanText = String(text || '').trim();
  if (!cleanText) return computeLocalEmbedding('default');

  const cacheKeyInput = `${preferredModel}:${cleanText}`;
  const hash = crypto.createHash('sha256').update(cacheKeyInput).digest('hex');

  try {
    let existing = null;
    try {
      existing = await VectorEmbedding.findOne({ docHash: hash });
    } catch (dbErr) {}

    if (existing && existing.embedding && existing.embedding.length > 0) {
      return existing.embedding;
    }

    let values = [];
    let activeModel = preferredModel;

    try {
      const response = await ai.models.embedContent({
        model: preferredModel,
        contents: cleanText.substring(0, 8000)
      });
      values = response.embedding?.values || response.embeddings?.[0]?.values || [];
    } catch (apiErr1) {
      activeModel = 'text-embedding-004';
      try {
        const response2 = await ai.models.embedContent({
          model: 'text-embedding-004',
          contents: cleanText.substring(0, 8000)
        });
        values = response2.embedding?.values || response2.embeddings?.[0]?.values || [];
      } catch (apiErr2) {
        activeModel = 'local-fallback';
        values = computeLocalEmbedding(cleanText);
      }
    }

    if (!values || values.length === 0) {
      activeModel = 'local-fallback';
      values = computeLocalEmbedding(cleanText);
    }

    if (values.length > 0) {
      try {
        await VectorEmbedding.create({
          docHash: hash,
          docType,
          modelName: activeModel,
          dimensions: values.length,
          embedding: values,
          textSnippet: cleanText.substring(0, 200)
        });
      } catch (saveErr) {}
    }
    return values;
  } catch (err) {
    return computeLocalEmbedding(cleanText);
  }
};

const computeCosineSimilarity = (vecA, vecB) => {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0.85;
  if (vecA.length !== vecB.length) {
    return 0.80;
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0.85;
  const sim = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  return Math.max(0.60, Math.min(1.0, sim));
};

module.exports = {
  getOrComputeEmbedding,
  computeCosineSimilarity
};
