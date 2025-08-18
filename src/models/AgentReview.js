
import mongoose from 'mongoose';

const agentReviewSchema = new mongoose.Schema(
    {
        agent: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
        },
        comment: {
            type: String,
            trim: true,
        },
    },
    { timestamps: true }
);

const AgentReview = mongoose.model('AgentReview', agentReviewSchema);

export default AgentReview;
