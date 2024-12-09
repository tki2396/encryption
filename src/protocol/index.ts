import {
  IdentityKeyStore,
  KEMKeyPair,
  KyberPreKeyRecord,
  KyberPreKeyStore,
  PreKeyBundle,
  PreKeyRecord,
  PreKeySignalMessage,
  PreKeyStore,
  PrivateKey,
  processPreKeyBundle,
  ProtocolAddress,
  SessionStore,
  signalDecrypt,
  signalDecryptPreKey,
  signalEncrypt,
  SignalMessage,
  SignedPreKeyRecord,
  SignedPreKeyStore,
} from '@signalapp/libsignal-client';
import {
  InMemoryIdentityKeyStore,
  InMemoryKyberPreKeyStore,
  InMemoryPreKeyStore,
  InMemorySessionStore,
  InMemorySignedPreKeyStore
} from './key-stores';
import { IdentityKeyPair } from './types';

class SignalProtocolManager {
  private registrationId: number;
  private address: ProtocolAddress;
  private sessionStore: SessionStore;
  private preKeyStore: PreKeyStore;
  private signedPreKeyStore: SignedPreKeyStore;
  private kyberPreKeyStore: KyberPreKeyStore;
  private identityKeyStore: IdentityKeyStore;

  constructor(
    registrationId: number,
    addressStr: string,
    deviceId: number,
    sessionStore: SessionStore,
    preKeyStore: PreKeyStore,
    signedPreKeyStore: SignedPreKeyStore,
    kyberPreKeyStore: KyberPreKeyStore,
    identityKeyStore: IdentityKeyStore
  ) {
    this.registrationId = registrationId;
    this.address = ProtocolAddress.new(addressStr, deviceId);
    this.sessionStore = sessionStore;
    this.preKeyStore = preKeyStore;
    this.signedPreKeyStore = signedPreKeyStore;
    this.kyberPreKeyStore = kyberPreKeyStore;
    this.identityKeyStore = identityKeyStore;
  }

  async generateIdentityKeyPair(): Promise<IdentityKeyPair> {
    const privateKey = await PrivateKey.generate();
    const publicKey = privateKey.getPublicKey();
    return { privateKey, publicKey };
  }

  async generatePreKeys(start: number, count: number): Promise<PreKeyRecord[]> {
    const preKeys: PreKeyRecord[] = [];
    for (let i = start; i < start + count; i++) {
      const privateKey = await PrivateKey.generate();
      const publicKey = privateKey.getPublicKey();
      const preKey = PreKeyRecord.new(i, publicKey, privateKey);
      preKeys.push(preKey);
      await this.preKeyStore.savePreKey(i, preKey);
    }
    return preKeys;
  }

  async generateSignedPreKey(
    identityKey: PrivateKey,
    signedPreKeyId: number
  ): Promise<SignedPreKeyRecord> {
    const privateKey = PrivateKey.generate();
    const publicKey = privateKey.getPublicKey();

    // Create signature using identity key
    const signature = identityKey.sign(publicKey.serialize());

    console.log("Generating signed prekey...");
    console.log("Signature length:", signature.length);

    const signedPreKey = SignedPreKeyRecord.new(
      signedPreKeyId,
      Date.now(),
      publicKey,
      privateKey,
      signature
    );

    // Verify signature before proceeding
    const verificationResult = identityKey.getPublicKey().verify(
      publicKey.serialize(),
      signature
    );
    console.log("Signature verification:", verificationResult);

    await this.signedPreKeyStore.saveSignedPreKey(signedPreKeyId, signedPreKey);
    return signedPreKey;
  }

  async createPreKeyBundle(): Promise<PreKeyBundle> {
    console.log("\nStarting PreKeyBundle creation...");

    const identityKey = await this.identityKeyStore.getIdentityKey();
    console.log("Got identity key");

    const preKeyId = Math.floor(Math.random() * 16777215);
    const signedPreKeyId = Math.floor(Math.random() * 16777215);
    const kyberPreKeyId = Math.floor(Math.random() * 16777215);

    // Generate and verify prekeys
    const preKeys = await this.generatePreKeys(preKeyId, 1);
    const preKey = preKeys[0];
    const signedPreKey = await this.generateSignedPreKey(identityKey, signedPreKeyId);

    // Verify signature again before bundle creation
    const signatureVerification = identityKey.getPublicKey().verify(
      signedPreKey.publicKey().serialize(),
      signedPreKey.signature()
    );

    console.log("Final signature verification before bundle creation:", signatureVerification);

    if (!signatureVerification) {
      throw new Error("Signature verification failed before bundle creation");
    }

    const kyberPreKey = await this.generateKyberPreKey(identityKey, kyberPreKeyId);
    try {
      const bundle = PreKeyBundle.new(
        this.registrationId,
        this.address.deviceId(),
        preKeyId,
        preKey.publicKey(),
        signedPreKeyId,
        signedPreKey.publicKey(),
        signedPreKey.signature(),
        identityKey.getPublicKey(),
        kyberPreKeyId,
        kyberPreKey.publicKey(),
        kyberPreKey.signature()
      );
      // Final verification of the bundle
      const finalVerification = bundle.signedPreKeySignature().length > 0 &&
        identityKey.getPublicKey().verify(
          bundle.signedPreKeyPublic().serialize(),
          bundle.signedPreKeySignature()
        );

      console.log("Final bundle signature verification:", finalVerification);

      if (!finalVerification) {
        throw new Error("Bundle signature verification failed");
      }
      return bundle;
    } catch (error) {
      console.error("Error creating PreKeyBundle:", error);
      throw error;
    }
  }

  async generateKyberPreKey(
    identityKey: PrivateKey,
    kyberPreKeyId: number
  ): Promise<KyberPreKeyRecord> {
    const keyPair = await KEMKeyPair.generate();
    const publicKey = keyPair.getPublicKey();
    const signature = identityKey.sign(publicKey.serialize());

    const kyberPreKey = KyberPreKeyRecord.new(
      kyberPreKeyId,
      Date.now(),
      keyPair,
      signature
    );

    await this.kyberPreKeyStore.saveKyberPreKey(kyberPreKeyId, kyberPreKey);
    return kyberPreKey;
  }

  async processPreKeyBundle(
    preKeyBundle: PreKeyBundle,
    recipientAddress: ProtocolAddress
  ): Promise<void> {
    console.log("Starting processPreKeyBundle...");

    // Verify all components
    console.log("Bundle components:", {
      registrationId: preKeyBundle.registrationId(),
      deviceId: preKeyBundle.deviceId(),
      preKeyId: preKeyBundle.preKeyId(),
      signedPreKeyId: preKeyBundle.signedPreKeyId()
    });

    // Save the identity key
    const identityKey = preKeyBundle.identityKey();
    await this.identityKeyStore.saveIdentity(recipientAddress, identityKey);
    console.log("Identity key saved");

    // Process the bundle using the library's function
    try {
      await processPreKeyBundle(
        preKeyBundle,
        recipientAddress,
        this.sessionStore,
        this.identityKeyStore,
        new Date()
      );
      console.log("processPreKeyBundle completed successfully");
    } catch (error) {
      console.error("Error in processPreKeyBundle:", error);
      if (error instanceof Error) {
        console.error("Stack trace:", error.stack);
      }
      throw error;
    }
  }

  async encryptMessage(
    recipientAddress: ProtocolAddress,
    message: string
  ): Promise<Buffer> {
    try {
      const messageBuffer = Buffer.from(message, 'utf8');
      const ciphertext = await signalEncrypt(
        messageBuffer,
        recipientAddress,
        this.sessionStore,
        this.identityKeyStore
      );
      return ciphertext.serialize();
    } catch (error) {
      console.error('Encryption error:', error);
      throw error;
    }
  }

  async decryptMessage(
    senderAddress: ProtocolAddress,
    encryptedMessage: Buffer
  ): Promise<string> {
    try {
      // First try to decrypt as a SignalMessage
      const signalMessage = SignalMessage.deserialize(encryptedMessage);
      const plaintext = await signalDecrypt(
        signalMessage,
        senderAddress,
        this.sessionStore,
        this.identityKeyStore
      );
      return plaintext.toString('utf8');
    } catch (error) {
      // If that fails, try as a PreKeySignalMessage
      try {
        const preKeySignalMessage = PreKeySignalMessage.deserialize(encryptedMessage);
        const plaintext = await signalDecryptPreKey(
          preKeySignalMessage,
          senderAddress,
          this.sessionStore,
          this.identityKeyStore,
          this.preKeyStore,
          this.signedPreKeyStore,
          this.kyberPreKeyStore
        );
        return plaintext.toString('utf8');
      } catch (preKeyError) {
        console.error('Decryption error:', preKeyError);
        throw preKeyError;
      }
    }
  }

  async hasSession(recipientAddress: ProtocolAddress): Promise<boolean> {
    const session = await this.sessionStore.getSession(recipientAddress);
    return session !== null && session.hasCurrentState();
  }

  static validatePreKeyBundle(bundle: PreKeyBundle): void {
    console.log("\nValidating PreKeyBundle...");

    const identityKey = bundle.identityKey();
    console.log("Identity Key present:", !!identityKey);

    const signedPreKey = bundle.signedPreKeyPublic();
    console.log("Signed PreKey present:", !!signedPreKey);

    const signature = bundle.signedPreKeySignature();
    console.log("Signature present:", !!signature);
    console.log("Signature length:", signature.length);

    try {
      const serializedKey = signedPreKey.serialize();
      console.log("Serialized signed prekey length:", serializedKey.length);

      const isValid = identityKey.verify(serializedKey, signature);
      console.log("Signature verification:", isValid);

      if (!isValid) {
        throw new Error("PreKeyBundle signature verification failed");
      }
    } catch (error) {
      console.error("Error during signature verification:", error);
      throw error;
    }
  }
}

export {
  InMemoryIdentityKeyStore, InMemoryKyberPreKeyStore, InMemoryPreKeyStore, InMemorySessionStore, InMemorySignedPreKeyStore, SignalProtocolManager, type IdentityKeyPair
};
