import * as agentService from './agent.service.js';

const submitKYC = async (req, res) => {
  try {
    const kyc = await agentService.submitKYC(req.user, req.body, req.files, req.app.get('io'), req.app.get('onlineUsers'));
    res.status(201).json({ message: 'KYC submitted, pending approval', kyc });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getKYCStatus = async (req, res) => {
  try {
    const kyc = await agentService.getKYCStatus(req.user._id);
    res.status(200).json(kyc);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const reviewKYC = async (req, res) => {
  try {
    const { kycId } = req.params;
    const { status, rejectionReason } = req.body;
    const kyc = await agentService.reviewKYC(kycId, status, rejectionReason, req.user._id, req.app.get('io'), req.app.get('onlineUsers'));
    res.status(200).json({ message: `KYC ${status}`, kyc });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const listKYCs = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const result = await agentService.listKYCs(page, limit, status);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export { submitKYC, getKYCStatus, reviewKYC, listKYCs };