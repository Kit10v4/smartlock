module.exports = {
  readFile: async () => {
    throw new Error("react-native-fs is not available in web runtime");
  }
};
