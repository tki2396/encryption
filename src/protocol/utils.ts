import { KEMPublicKey, PreKeyBundle, PublicKey } from "@signalapp/libsignal-client";
import { SerializedPreKeyBundle } from "./types";

export function serializePreKeyBundle(bundle: PreKeyBundle): SerializedPreKeyBundle {
  return {
    registrationId: bundle.registrationId(),
    deviceId: bundle.deviceId(),
    preKeyId: bundle.preKeyId(),
    preKey: bundle.preKeyPublic()?.serialize().toString('base64') || null,
    signedPreKeyId: bundle.signedPreKeyId(),
    signedPreKey: bundle.signedPreKeyPublic().serialize().toString('base64'),
    signedPreKeySignature: bundle.signedPreKeySignature().toString('base64'),
    identityKey: bundle.identityKey().serialize().toString('base64'),
    kyberPreKeyId: bundle.kyberPreKeyId(),
    kyberPreKey: bundle.kyberPreKeyPublic()?.serialize().toString('base64') || null,
    kyberPreKeySignature: bundle.kyberPreKeySignature()?.toString('base64') || null
  };
}

// Add a helper function to deserialize PreKeyBundle
export function deserializePreKeyBundle(serialized: SerializedPreKeyBundle): PreKeyBundle {
  return PreKeyBundle.new(
    serialized.registrationId,
    serialized.deviceId,
    serialized.preKeyId,
    serialized.preKey ? PublicKey.deserialize(Buffer.from(serialized.preKey, 'base64')) : null,
    serialized.signedPreKeyId,
    PublicKey.deserialize(Buffer.from(serialized.signedPreKey, 'base64')),
    Buffer.from(serialized.signedPreKeySignature, 'base64'),
    PublicKey.deserialize(Buffer.from(serialized.identityKey, 'base64')),
    serialized.kyberPreKeyId,
    serialized.kyberPreKey ? KEMPublicKey.deserialize(Buffer.from(serialized.kyberPreKey, 'base64')) : null,
    serialized.kyberPreKeySignature ? Buffer.from(serialized.kyberPreKeySignature, 'base64') : null
  );
}