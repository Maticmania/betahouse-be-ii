import AgentKYC from '../../models/AgentKYC.js';
import User from '../../models/User.js';
import cloudinary from '../../config/cloudinary.config.js';
import { createNotification } from '../../services/notification.js';
import { v4 as uuidv4 } from 'uuid';

// Submit KYC (User with 'user' role, upgrades to 'agent' on approval)
const submitKYC = async (req, res) => {
  try {
    if (req.user.role !== 'user') {
      return res.status(403).json({ message: 'Only users can submit KYC to become agents' });
    }

    const existingKYC = await AgentKYC.findOne({ user: req.user._id });
    if (existingKYC) {
      return res.status(400).json({ message: 'KYC already submitted' });
    }

    const { fullName, phone, address, idType, idNumber } = req.body;
    const { idImage, selfieWithCode, voice } = req.files || {};

    // Validate file uploads
    if (!idImage || !selfieWithCode) {
      return res.status(400).json({ message: 'ID image and selfie with code are required' });
    }

    // Upload files to Cloudinary
    const idImageResult = await cloudinary.uploader.upload(idImage[0].path, {
      folder: 'real-estate/kyc/id',
    });

    const selfieResult = await cloudinary.uploader.upload(selfieWithCode[0].path, {
      folder: 'real-estate/kyc/selfie',
    });

    const voiceResult = voice
      ? await cloudinary.uploader.upload(voice[0].path, {
          folder: 'real-estate/kyc/voice',
          resource_type: 'video',
        })
      : null;

    // Generate verification code for selfie
    const verificationCode = uuidv4().slice(0, 8);

    const kyc = new AgentKYC({
      user: req.user._id,
      fullName,
      phone,
      address,
      idType,
      idNumber,
      idImage: idImageResult.secure_url,
      selfieWithCode: selfieResult.secure_url,
      voice: voiceResult ? voiceResult.secure_url : null,
      verificationCode,
    });

    await kyc.save();

    // Notify admins
    const admins = await User.find({ role: 'admin' });
    for (const admin of admins) {
      await createNotification(
        admin._id,
        'kyc_submitted',
        `New KYC submission by ${fullName} awaits review.`,
        kyc._id
      );
    }

    res.status(201).json({ message: 'KYC submitted, pending approval', kyc });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Check KYC status (User/Agent)
const getKYCStatus = async (req, res) => {
  try {
    const kyc = await AgentKYC.findOne({ user: req.user._id }).select(
      '-idImage -selfieWithCode -voice'
    );
    if (!kyc) {
      return res.status(404).json({ message: 'No KYC submission found' });
    }

    res.status(200).json(kyc);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Review KYC (Admin only)
const reviewKYC = async (req, res) => {
  try {
    const { kycId } = req.params;
    const { status, rejectionReason } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const kyc = await AgentKYC.findById(kycId);
    if (!kyc) {
      return res.status(404).json({ message: 'KYC not found' });
    }

    kyc.status = status;
    kyc.reviewedAt = Date.now();
    kyc.reviewer = req.user._id;
    if (status === 'rejected') {
      kyc.rejectionReason = rejectionReason || 'No reason provided';
    }

    // Update user role to 'agent' on approval
    if (status === 'approved') {
      const user = await User.findById(kyc.user);
      user.role = 'agent';
      await user.save();
    }

    await kyc.save();

    // Notify user
    await createNotification(
      kyc.user,
      `kyc_${status}`,
      `Your KYC submission has been ${status}. ${
        status === 'rejected' ? `Reason: ${kyc.rejectionReason}` : ''
      }`,
      kyc._id
    );

    res.status(200).json({ message: `KYC ${status}`, kyc });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// List KYC submissions (Admin only)
const listKYCs = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const query = status ? { status } : {};

    const kycs = await AgentKYC.find(query)
      .populate('user', 'email profile.name')
      .populate('reviewer', 'profile.name')
      .sort({ submittedAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .select('-idImage -selfieWithCode -voice')
      .lean();

    const total = await AgentKYC.countDocuments(query);

    res.status(200).json({
      kycs,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export { submitKYC, getKYCStatus, reviewKYC, listKYCs };