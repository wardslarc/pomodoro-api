// services/twoFactorService.js
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';

class TwoFactorService {
  static generateSecret(email) {
    return speakeasy.generateSecret({
      name: `Reflective Pomodoro (${email})`,
      issuer: "Reflective Pomodoro"
    });
  }

  static async generateQRCode(otpauthUrl) {
    return await qrcode.toDataURL(otpauthUrl);
  }

  static verifyToken(secret, token) {
    return speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: 1
    });
  }
}

export default TwoFactorService;