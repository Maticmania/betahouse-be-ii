import AgentKYC from '../../models/AgentKYC.js';
import User from '../../models/User.js';
import {cloudinary} from '../../config/cloudinary.config.js';
import { createNotification } from '../../services/notification.js';

const submitKYC = async (user, kycData, files, io, onlineUsers) => {
  if (user.role !== 'user') {
    throw new Error('Only users can submit KYC to become agents');
  }

  const existingKYC = await AgentKYC.findOne({ user: user._id });
  if (existingKYC) {
    throw new Error('KYC already submitted');
  }

  const { fullName, phone, address, idType, idNumber, verificationCode} = kycData;
  const { idImage, selfieWithCode } = files || {};

  if (!idImage || !selfieWithCode) {
    throw new Error('ID image and selfie with code are required');
  }

  const idImageResult = await cloudinary.uploader.upload(idImage[0].path, {
    folder: 'real-estate/kyc/id',
  });

  const selfieResult = await cloudinary.uploader.upload(selfieWithCode[0].path, {
    folder: 'real-estate/kyc/selfie',
  });

  const kyc = new AgentKYC({
    user: user._id,
    fullName,
    phone,
    address,
    idType,
    idNumber,
    idImage: idImageResult.secure_url,
    selfieWithCode: selfieResult.secure_url,
    verificationCode,
  });

  await kyc.save();

  const admins = await User.find({ role: 'admin' });
  for (const admin of admins) {
    await createNotification(
      io,
      onlineUsers,
      admin._id,
      'kyc_submitted',
      `New KYC submission by ${fullName} awaits review.`,
      kyc._id,
      'New KYC Submission',
      'AgentKYC'
    );
  }

  return kyc;
};

const getKYCStatus = async (userId) => {
  const kyc = await AgentKYC.findOne({ user: userId }).select(
    '-idImage -selfieWithCode'
  );
  if (!kyc) {
    throw new Error('No KYC submission found');
  }
  return kyc;
};

const reviewKYC = async (kycId, status, rejectionReason, reviewerId, io, onlineUsers) => {
  if (!['approved', 'rejected'].includes(status)) {
    throw new Error('Invalid status');
  }

  const kyc = await AgentKYC.findById(kycId);
  if (!kyc) {
    throw new Error('KYC not found');
  }

  kyc.status = status;
  kyc.reviewedAt = Date.now();
  kyc.reviewer = reviewerId;
  if (status === 'rejected') {
    kyc.rejectionReason = rejectionReason || 'No reason provided';
  }

  if (status === 'approved') {
    const user = await User.findById(kyc.user);
    user.role = 'agent';
    await user.save();
  }

  await kyc.save();

  await createNotification(
    io,
    onlineUsers,
    kyc.user,
    `kyc_${status}`,
    `Your KYC submission has been ${status}. ${status === 'rejected' ? `Reason: ${kyc.rejectionReason}` : ''}`,
    kyc._id,
    'KYC Status Update',
    'AgentKYC'
  );

  return kyc;
};

const listKYCs = async (page, limit, status) => {
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

  return {
    kycs,
    total,
    page: Number(page),
    pages: Math.ceil(total / limit),
  };
};

export { submitKYC, getKYCStatus, reviewKYC, listKYCs };
