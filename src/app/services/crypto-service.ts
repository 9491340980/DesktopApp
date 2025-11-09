import { Injectable } from '@angular/core';
import * as CryptoJS from 'crypto-js';
@Injectable({
  providedIn: 'root',
})
export class CryptoService {
   // Security key for encryption/decryption
  public securityKey: string = '7061737323313233';

  constructor() {}

  /**
   * Encrypt value using AES encryption
   * @param value - The string to encrypt
   * @param securityKey - Optional security key (uses default if not provided)
   * @returns Encrypted string
   */
  encrypt(value: string, securityKey?: string): string {
    const key = securityKey || this.securityKey;

    if (value && key) {
      try {
        const keyUtf8 = CryptoJS.enc.Utf8.parse(key);
        const ivUtf8 = CryptoJS.enc.Utf8.parse(key);

        const encrypted = CryptoJS.AES.encrypt(
          CryptoJS.enc.Utf8.parse(value),
          keyUtf8,
          {
            keySize: 128 / 8,
            iv: ivUtf8,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
          }
        );

        return encrypted.toString();
      } catch (error) {
        console.error('Encryption error:', error);
        throw new Error('Failed to encrypt value');
      }
    }

    return value;
  }

  /**
   * Decrypt value using AES decryption
   * @param value - The encrypted string to decrypt
   * @param securityKey - Optional security key (uses default if not provided)
   * @returns Decrypted string
   */
  decrypt(value: string, securityKey?: string): string {
    const key = securityKey || this.securityKey;

    if (value && key) {
      try {
        const keyUtf8 = CryptoJS.enc.Utf8.parse(key);
        const ivUtf8 = CryptoJS.enc.Utf8.parse(key);

        const decrypted = CryptoJS.AES.decrypt(value, keyUtf8, {
          keySize: 128 / 8,
          iv: ivUtf8,
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7
        });

        return decrypted.toString(CryptoJS.enc.Utf8);
      } catch (error) {
        console.error('Decryption error:', error);
        throw new Error('Failed to decrypt value');
      }
    }

    return value;
  }

  /**
   * Set custom security key
   * @param key - New security key
   */
  setSecurityKey(key: string): void {
    this.securityKey = key;
  }

  /**
   * Get current security key
   * @returns Current security key
   */
  getSecurityKey(): string {
    return this.securityKey;
  }
}
