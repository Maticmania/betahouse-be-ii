import * as userService from "./user.service.js";
// List users (Admin only)
const listUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, role } = req.query;
    const result = await userService.listUsers(page, limit, role);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update profile (self)
const updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const profileData = req.body;
    const user = await userService.updateProfile(userId, profileData);

    res.status(200).json({
      message: "Profile updated",
      user: user.toObject({ getters: true }),
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    const statusCode = error.message === "User not found" ? 404 : 500;
    res.status(statusCode).json({ message: error.message });
  }
};

//update email
const updateEmail = async (req, res) => {
  try {
    const userId = req.user._id;
    const { email } = req.body;

    const result = await userService.updateEmail(userId, email);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error updating email:", error);
    const statusCode =
      error.message === "User not found"
        ? 404
        : error.message === "Email is already taken"
        ? 400
        : 500;
    res.status(statusCode).json({ message: error.message });
  }
};

//Update password
const updatePassword = async (req, res) => {
  try {
    const userId = req.user._id;
    const { currentPassword, newPassword } = req.body;
    const io = req.app.get("io");
    const onlineUsers = req.app.get("onlineUsers");

    const result = await userService.updatePassword(
      userId,
      currentPassword,
      newPassword,
      io,
      onlineUsers
    );
    res.status(200).json(result);
  } catch (error) {
    console.error("Error updating password:", error);
    const statusCode =
      error.message === "User not found"
        ? 404
        : error.message === "Incorrect current password"
        ? 400
        : 500;
    res.status(statusCode).json({ message: error.message });
  }
};

// Update user profile (Admin only)
const updateUserProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const profileData = req.body;
    const adminRole = req.user.role;
    const io = req.app.get("io");
    const onlineUsers = req.app.get("onlineUsers");

    const user = await userService.updateUserProfile(
      id,
      profileData,
      adminRole,
      io,
      onlineUsers
    );

    res.status(200).json({
      message: "User profile updated",
      user: user.toObject({ getters: true }),
    });
  } catch (error) {
    const statusCode =
      error.message === "User not found"
        ? 404
        : error.message.includes("Not authorized") ||
          error.message.includes("Only admins")
        ? 403
        : 500;
    res.status(statusCode).json({ message: error.message });
  }
};

//delete user (self) verify password before deleting
const deleteUserSelf = async (req, res) => {
  try {
    const userId = req.user._id;
    const { password } = req.body;

    const result = await userService.deleteUserSelf(userId, password);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error deleting user:", error);
    const statusCode =
      error.message === "User not found"
        ? 404
        : error.message === "Incorrect password"
        ? 400
        : 500;
    res.status(statusCode).json({ message: error.message });
  }
};

// Delete user (Admin only)
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user._id;

    const result = await userService.deleteUser(id, currentUserId);
    res.status(200).json(result);
  } catch (error) {
    const statusCode =
      error.message === "User not found"
        ? 404
        : error.message === "Cannot delete yourself"
        ? 403
        : 500;
    res.status(statusCode).json({ message: error.message });
  }
};

// Add agent review (User only)
const addAgentReview = async (req, res) => {
  try {
    const { agentId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user._id;
    const username = req.user.username;
    const io = req.app.get("io");
    const onlineUsers = req.app.get("onlineUsers");

    const agent = await userService.addAgentReview(
      agentId,
      userId,
      username,
      rating,
      comment,
      io,
      onlineUsers
    );

    res.status(200).json({ message: "Review added", agent });
  } catch (error) {
    const statusCode =
      error.message === "Agent not found"
        ? 404
        : error.message === "Cannot review yourself"
        ? 403
        : error.message === "Rating must be between 1 and 5"
        ? 400
        : 500;
    res.status(statusCode).json({ message: error.message });
  }
};

// Get agent profile (Public)
const getAgentProfile = async (req, res) => {
  try {
    const { agentId } = req.params;
    const agent = await userService.getAgentProfile(agentId);
    res.status(200).json(agent);
  } catch (error) {
    const statusCode = error.message === "Agent not found" ? 404 : 500;
    res.status(statusCode).json({ message: error.message });
  }
};

//get all agents (Public)
const getAllAgents = async (req, res) => {
  try {
    const agents = await userService.getAllAgents();
    res.status(200).json(agents);
  } catch (error) {
    const statusCode = error.message === "No agents found" ? 404 : 500;
    res.status(statusCode).json({ message: error.message });
  }
};

export {
  listUsers,
  updateProfile,
  updateUserProfile,
  deleteUser,
  addAgentReview,
  getAgentProfile,
  getAllAgents,
  deleteUserSelf,
  updateEmail,
  updatePassword,
};
