function imageToRGB565(imageData, width, height) {
  const buffer = new ArrayBuffer(4 + width * height * 2);
  const view = new DataView(buffer);
  view.setUint16(0, width);
  view.setUint16(2, height);

  let offset = 4;
  for (let i = 0; i < imageData.length; i += 4) {
    const r = imageData[i];
    const g = imageData[i + 1];
    const b = imageData[i + 2];
    const rgb565 = ((r & 0xf8) << 8) | ((g & 0xfc) << 3) | (b >> 3);
    view.setUint16(offset, rgb565);
    offset += 2;
  }
  return buffer;
}

module.exports = {
  imageToRGB565
};
