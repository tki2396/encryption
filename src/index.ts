// src/server.ts
import { PreKeyBundle, ProtocolAddress } from '@signalapp/libsignal-client';
import express, { Request, Response } from 'express';
import {
  InMemoryIdentityKeyStore,
  InMemoryKyberPreKeyStore,
  InMemoryPreKeyStore,
  InMemorySessionStore,
  InMemorySignedPreKeyStore,
  SignalProtocolManager,
} from './protocol';
import { deserializePreKeyBundle, serializePreKeyBundle } from './protocol/utils';

const app = express();
app.use(express.json());

// Store Signal Protocol Managers for each user
const userManagers = new Map<string, SignalProtocolManager>();

// Initialize a new Signal Protocol Manager for a user
async function initializeManager(userId: string): Promise<SignalProtocolManager> {
  const registrationId = Math.floor(Math.random() * 65535);

  // Create temporary manager to generate identity keys
  const tempManager = new SignalProtocolManager(
    0, '', 0,
    new InMemorySessionStore(),
    new InMemoryPreKeyStore(),
    new InMemorySignedPreKeyStore(),
    new InMemoryKyberPreKeyStore(),
    new InMemoryIdentityKeyStore(null as any, 0)
  );

  const identityKeyPair = await tempManager.generateIdentityKeyPair();

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

  return new SignalProtocolManager(
    registrationId,
    userId,
    1, // Default device ID
    stores.sessionStore,
    stores.preKeyStore,
    stores.signedPreKeyStore,
    stores.kyberPreKeyStore,
    stores.identityKeyStore
  );
}

// Register a new user
app.post('/register', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
    }

    if (userManagers.has(userId)) {
      res.status(409).json({ error: 'User already registered' });
    }

    const manager = await initializeManager(userId);
    userManagers.set(userId, manager);

    // Generate and return the pre-key bundle
    const preKeyBundle = await manager.createPreKeyBundle();

    res.json({
      userId,
      preKeyBundle: serializePreKeyBundle(preKeyBundle)
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Get a user's pre-key bundle
app.get('/prekey/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const manager = userManagers.get(userId);

    if (!manager) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const preKeyBundle = await manager.createPreKeyBundle();
    res.json({
      userId,
      preKeyBundle: serializePreKeyBundle(preKeyBundle)
    });
  } catch (error) {
    console.error('PreKey bundle error:', error);
    res.status(500).json({ error: 'Failed to get PreKey bundle' });
  }
});

// Process a pre-key bundle to establish a session
app.post('/session', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, recipientId, preKeyBundle } = req.body;

    if (!userId || !recipientId || !preKeyBundle) {
      res.status(400).json({ error: 'Missing required parameters' });
      return
    }

    const manager = userManagers.get(userId);
    if (!manager) {
      res.status(404).json({ error: 'User not found' });
      return
    }

    const recipientAddress = ProtocolAddress.new(recipientId, 1);
    // const preKeyBundleBuffer = Buffer.from(preKeyBundle, 'base64');

    await manager.processPreKeyBundle(
      deserializePreKeyBundle(preKeyBundle),
      recipientAddress
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Session establishment error:', error);
    res.status(500).json({ error: 'Failed to establish session' });
  }
});

// Send an encrypted message
app.post('/send', async (req: Request, res: Response): Promise<void> => {
  try {
    const { senderId, recipientId, message } = req.body;

    if (!senderId || !recipientId || !message) {
      res.status(400).json({ error: 'Missing required parameters' });
      return
    }

    const manager = userManagers.get(senderId);
    if (!manager) {
      res.status(404).json({ error: 'Sender not found' });
      return
    }

    const recipientAddress = ProtocolAddress.new(recipientId, 1);
    const encryptedMessage = await manager.encryptMessage(recipientAddress, message);

    res.json({
      encryptedMessage: encryptedMessage.toString('base64')
    });
  } catch (error) {
    console.error('Message encryption error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Receive and decrypt a message
app.post('/receive', async (req: Request, res: Response): Promise<void> => {
  try {
    const { recipientId, senderId, encryptedMessage } = req.body;

    if (!recipientId || !senderId || !encryptedMessage) {
      res.status(400).json({ error: 'Missing required parameters' });
      return
    }

    const manager = userManagers.get(recipientId);
    if (!manager) {
      res.status(404).json({ error: 'Recipient not found' });
      return
    }

    const senderAddress = ProtocolAddress.new(senderId, 1);
    const messageBuffer = Buffer.from(encryptedMessage, 'base64');

    const decryptedMessage = await manager.decryptMessage(
      senderAddress,
      messageBuffer
    );

    res.json({ message: decryptedMessage });
  } catch (error) {
    console.error('Message decryption error:', error);
    res.status(500).json({ error: 'Failed to decrypt message' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Signal Protocol API server running on port ${PORT}`);
});