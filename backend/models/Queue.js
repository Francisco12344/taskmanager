const mongoose = require('mongoose');

const queueSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    number: { type: String, required: true },
    type: { type: String, enum: ['regular', 'priority'], required: true },
    issuedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['waiting', 'serving', 'completed', 'no-show'], default: 'waiting' },
    estimatedTime: { type: Number, required: true },
    priority: { type: Number, default: 0 },
    servedAt: { type: Date },
    completedAt: { type: Date },
    noShowAt: { type: Date }
}, {
    timestamps: true
});

module.exports = mongoose.model('Queue', queueSchema);

// queue 4