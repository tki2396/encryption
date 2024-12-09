import { PrivateKey, PublicKey } from "@signalapp/libsignal-client";

export interface SerializedPreKeyBundle {
  registrationId: number;
  deviceId: number;
  preKeyId: number | null;
  preKey: string | null;        // base64 encoded
  signedPreKeyId: number;
  signedPreKey: string;         // base64 encoded
  signedPreKeySignature: string; // base64 encoded
  identityKey: string;          // base64 encoded
  kyberPreKeyId: number | null;
  kyberPreKey: string | null;   // base64 encoded
  kyberPreKeySignature: string | null; // base64 encoded
}

export interface IdentityKeyPair {
  publicKey: PublicKey;
  privateKey: PrivateKey;
}
