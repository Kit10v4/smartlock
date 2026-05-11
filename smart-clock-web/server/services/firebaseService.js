module.exports = {
  async uploadFile(_file) {
    throw new Error("Firebase upload is not configured yet. Use /api/upload routes or provide Firebase credentials.");
  }
};
