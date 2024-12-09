import { ProtocolAddress } from '@signalapp/libsignal-client';
import {
  InMemoryIdentityKeyStore,
  InMemoryKyberPreKeyStore,
  InMemoryPreKeyStore,
  InMemorySessionStore,
  InMemorySignedPreKeyStore,
  SignalProtocolManager
} from './protocol';


async function createSignalProtocolManager(userId: string, deviceId: number = 1) {
  // 1. Generate registration ID (this would normally be stored)
  const registrationId = Math.floor(Math.random() * 65535);

  // 2. Create temporary manager to generate identity keys
  const tempManager = new SignalProtocolManager(
    0, '', 0,
    new InMemorySessionStore(),
    new InMemoryPreKeyStore(),
    new InMemorySignedPreKeyStore(),
    new InMemoryKyberPreKeyStore(),
    new InMemoryIdentityKeyStore(null as any, 0)
  );

  // 3. Generate identity key pair
  const identityKeyPair = await tempManager.generateIdentityKeyPair();

  // 4. Create actual stores
  const stores = {
    sessionStore: new InMemorySessionStore(),
    preKeyStore: new InMemoryPreKeyStore(),
    signedPreKeyStore: new InMemorySignedPreKeyStore(),
    kyberPreKeyStore: new InMemoryKyberPreKeyStore(),
    identityKeyStore: new InMemoryIdentityKeyStore(
      identityKeyPair.privateKey,
      registrationId
    )
  };

  // 5. Create and return the actual protocol manager
  return new SignalProtocolManager(
    registrationId,
    userId,
    deviceId,
    stores.sessionStore,
    stores.preKeyStore,
    stores.signedPreKeyStore,
    stores.kyberPreKeyStore,
    stores.identityKeyStore
  );
}

// Example usage:
async function main() {
  // Create two users
  const alice = await createSignalProtocolManager('alice-uuid');
  const bob = await createSignalProtocolManager('bob-uuid');

  // Generate Bob's pre-key bundle (this would normally be stored on a server)
  const bobPreKeyBundle = await bob.createPreKeyBundle();
  SignalProtocolManager.validatePreKeyBundle(bobPreKeyBundle)
  // Alice processes Bob's pre-key bundle to establish a session
  const bobAddress = ProtocolAddress.new('bob-uuid', 1);
  await alice.processPreKeyBundle(bobPreKeyBundle, bobAddress);

  const hasSession = await alice.hasSession(bobAddress);
  console.log("Session established:", hasSession);

  if (!hasSession) {
    throw new Error("Failed to establish session");
  }
  // Now Alice can encrypt messages to Bob
  const message = "Hello, Bob! This is a secret message.";
  const encryptedMessage = await alice.encryptMessage(bobAddress, message);

  // Bob can decrypt Alice's message
  const aliceAddress = ProtocolAddress.new('alice-uuid', 1);
  const decryptedMessage = await bob.decryptMessage(aliceAddress, encryptedMessage);

  console.log('Original message:', message);
  console.log('Decrypted message:', decryptedMessage);
}

main().catch(console.error);